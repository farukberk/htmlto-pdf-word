import { chooseAutoOrientation } from "./measureSourceGeometry";

const PX_PER_MM = 96 / 25.4;
const A4 = { portrait: { width: 210, height: 297 }, landscape: { width: 297, height: 210 } } as const;

export interface CorporatePrintLayoutOptions {
    orientation: "portrait" | "landscape" | "auto";
    horizontalMarginMm: number;
    verticalMarginMm: number;
    smartPageBreaks: boolean;
    meaningfulSourceWidth: number;
    meaningfulSourceHeight: number;
}

interface LayoutEntry {
    top: number;
    height: number;
    display: string;
    borderWidth: number;
    heading: boolean;
    tableHeader: boolean;
    gridHeader: boolean;
}

export interface CorporateLayoutSnapshot { rootTop: number; entries: LayoutEntry[] }
export interface BoundCorporateLayoutSnapshot { rootTop: number; entries: Map<HTMLElement, LayoutEntry> }

export interface CorporatePrintDiagnostics {
    paperOrientation: "portrait" | "landscape";
    paperWidthMm: number;
    paperHeightMm: number;
    horizontalMarginMm: number;
    verticalMarginMm: number;
    printableWidth: number;
    printableHeight: number;
    meaningfulSourceWidth: number;
    meaningfulSourceHeight: number;
    finalScale: number;
    logicalSectionsFound: number;
    keepWithNextGroups: number;
    avoidBreakBlocks: number;
    forcedBreaksInserted: number;
    oversizeBlocksAllowedToSplit: number;
    tableHeaderGroups: number;
    orphanBreaksPrevented: number;
}

export function resolveCorporatePrintLayout(options: CorporatePrintLayoutOptions): CorporatePrintDiagnostics {
    const horizontal = clampMargin(options.horizontalMarginMm, 10);
    const vertical = clampMargin(options.verticalMarginMm, 12);
    const portraitWidth = (A4.portrait.width - horizontal * 2) * PX_PER_MM;
    const landscapeWidth = (A4.landscape.width - horizontal * 2) * PX_PER_MM;
    const orientation = options.orientation === "auto"
        ? chooseAutoOrientation(options.meaningfulSourceWidth, options.meaningfulSourceHeight, portraitWidth, landscapeWidth)
        : options.orientation;
    const paper = A4[orientation];
    const printableWidth = Math.max(1, paper.width - horizontal * 2) * PX_PER_MM;
    const printableHeight = Math.max(1, paper.height - vertical * 2) * PX_PER_MM;
    return {
        paperOrientation: orientation, paperWidthMm: paper.width, paperHeightMm: paper.height,
        horizontalMarginMm: horizontal, verticalMarginMm: vertical, printableWidth, printableHeight,
        meaningfulSourceWidth: Math.max(1, options.meaningfulSourceWidth),
        meaningfulSourceHeight: Math.max(1, options.meaningfulSourceHeight),
        finalScale: Math.min(1, printableWidth / Math.max(1, options.meaningfulSourceWidth)),
        logicalSectionsFound: 0, keepWithNextGroups: 0, avoidBreakBlocks: 0, forcedBreaksInserted: 0,
        oversizeBlocksAllowedToSplit: 0, tableHeaderGroups: 0, orphanBreaksPrevented: 0
    };
}

export function captureCorporateLayoutSnapshot(root: HTMLElement): CorporateLayoutSnapshot {
    const elements = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];
    return { rootTop: root.getBoundingClientRect().top, entries: elements.map(element => {
        const bounds = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
            top: bounds.top, height: bounds.height, display: style.display,
            borderWidth: numeric(style.borderTopWidth) + numeric(style.borderRightWidth) +
                numeric(style.borderBottomWidth) + numeric(style.borderLeftWidth),
            heading: /^H[1-6]$/.test(element.tagName) || element.getAttribute("role") === "heading",
            tableHeader: element.tagName === "THEAD" || element.tagName === "TH",
            gridHeader: element.getAttribute("role") === "row" && Boolean(element.querySelector("[role='columnheader']"))
        };
    }) };
}

export function bindCorporateLayoutSnapshot(clone: HTMLElement, snapshot: CorporateLayoutSnapshot): BoundCorporateLayoutSnapshot {
    const elements = [clone, ...Array.from(clone.querySelectorAll<HTMLElement>("*"))];
    return { rootTop: snapshot.rootTop, entries: new Map(elements.map((element, index) => [element, snapshot.entries[index]])) };
}

export function applyCorporatePrintLayout(clone: HTMLElement, snapshot: BoundCorporateLayoutSnapshot,
                                          options: CorporatePrintLayoutOptions): CorporatePrintDiagnostics {
    const result = resolveCorporatePrintLayout(options);
    clone.classList.add("html-pdf-corporate-print");
    clone.style.setProperty("--html-pdf-source-width", `${result.meaningfulSourceWidth}px`);
    const sourcePageHeight = result.printableHeight / result.finalScale;
    const elements = Array.from(snapshot.entries.keys()).filter(element => clone.contains(element));
    let paginationOffset = 0;
    for (const element of elements) {
        const entry = snapshot.entries.get(element)!;
        if (!visible(entry) || element === clone) continue;
        const explicitSection = element.classList.contains("pdf-section");
        const explicitKeep = element.classList.contains("pdf-keep-with-next");
        const explicitAvoid = element.classList.contains("pdf-avoid-break");
        const explicitBreak = element.classList.contains("pdf-page-break-before");
        const section = options.smartPageBreaks && (explicitSection || entry.heading);
        const header = options.smartPageBreaks && (entry.tableHeader || entry.gridHeader);
        const smallPanel = explicitAvoid || (options.smartPageBreaks && entry.borderWidth > 0 && entry.height >= 32);
        if (section) result.logicalSectionsFound++;
        if (header) result.tableHeaderGroups++;

        if (smallPanel) {
            if (entry.height <= sourcePageHeight) {
                element.classList.add("html-pdf-avoid-break"); result.avoidBreakBlocks++;
            } else result.oversizeBlocksAllowedToSplit++;
        }
        const next = nextMeaningful(element, snapshot.entries);
        const nextEntry = next ? snapshot.entries.get(next) : undefined;
        const groupHeight = Math.max(entry.height, nextEntry ? nextEntry.top + nextEntry.height - entry.top : 0, 72);
        const shouldKeep = options.smartPageBreaks && (explicitKeep || section || header);
        if (shouldKeep && nextEntry) {
            element.classList.add("html-pdf-keep-with-next"); result.keepWithNextGroups++;
        }
        const effectiveTop = Math.max(0, entry.top - snapshot.rootTop + paginationOffset);
        const remaining = sourcePageHeight - (effectiveTop % sourcePageHeight);
        const needsBreak = options.smartPageBreaks && !explicitBreak && shouldKeep && nextEntry &&
            groupHeight <= sourcePageHeight && remaining + 0.5 < groupHeight;
        if (needsBreak && effectiveTop % sourcePageHeight > 1) {
            element.classList.add("html-pdf-page-break-before");
            result.forcedBreaksInserted++;
            if (!explicitBreak) result.orphanBreaksPrevented++;
            paginationOffset += remaining;
        }
    }
    return result;
}

export function corporatePrintCss(layout: CorporatePrintDiagnostics): string {
    const orientation = layout.paperOrientation;
    return `@page{size:A4 ${orientation}!important;margin:${layout.verticalMarginMm}mm ${layout.horizontalMarginMm}mm!important}
html,body{margin:0!important;padding:0!important}
body{width:${layout.meaningfulSourceWidth}px!important;max-width:none!important}
.html-pdf-corporate-print{box-sizing:border-box!important;width:${layout.meaningfulSourceWidth}px!important;max-width:none!important;margin-left:auto!important;margin-right:auto!important}
.html-pdf-keep-with-next{break-after:avoid-page;page-break-after:avoid}
.html-pdf-avoid-break{break-inside:avoid;page-break-inside:avoid}
.html-pdf-page-break-before,.pdf-page-break-before{break-before:page;page-break-before:always}
.pdf-keep-with-next{break-after:avoid-page;page-break-after:avoid}
thead{display:table-header-group}tfoot{display:table-footer-group}`;
}

function nextMeaningful(element: HTMLElement, entries: Map<HTMLElement, LayoutEntry>): HTMLElement | undefined {
    let sibling = element.nextElementSibling as HTMLElement | null;
    while (sibling) {
        const entry = entries.get(sibling);
        if (entry && visible(entry) && (entry.height > 1 || sibling.textContent?.trim())) return sibling;
        sibling = sibling.nextElementSibling as HTMLElement | null;
    }
    const child = Array.from(element.children).find(candidate => {
        const entry = entries.get(candidate as HTMLElement); return entry && visible(entry) && entry.height > 1;
    });
    return child as HTMLElement | undefined;
}

function visible(entry: LayoutEntry): boolean { return entry.display !== "none" && entry.height > 0; }
function numeric(value: string): number { const parsed = Number.parseFloat(value); return Number.isFinite(parsed) ? parsed : 0; }
function clampMargin(value: number, fallback: number): number {
    return Number.isFinite(value) ? Math.max(0, Math.min(30, Math.round(value))) : fallback;
}
