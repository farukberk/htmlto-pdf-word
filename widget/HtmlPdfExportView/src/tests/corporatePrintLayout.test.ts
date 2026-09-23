import { beforeEach, describe, expect, it } from "vitest";
import { applyCorporatePrintLayout, bindCorporateLayoutSnapshot, captureCorporateLayoutSnapshot,
    corporatePrintCss, CorporatePrintLayoutOptions, resolveCorporatePrintLayout } from "../capture/corporatePrintLayout";
import { buildHtmlDocument } from "../capture/buildHtmlDocument";

function box(element: Element, top: number, width: number, height: number): void {
    element.getBoundingClientRect = () => ({ left: 0, top, width, height, right: width, bottom: top + height,
        x: 0, y: top, toJSON: () => ({}) });
}

function options(overrides: Partial<CorporatePrintLayoutOptions> = {}): CorporatePrintLayoutOptions {
    return { orientation: "portrait", horizontalMarginMm: 10, verticalMarginMm: 12,
        smartPageBreaks: true, meaningfulSourceWidth: 1000, meaningfulSourceHeight: 3000, ...overrides };
}

function fixture(): { source: HTMLElement; clone: HTMLElement } {
    document.body.innerHTML = `<main id="report" style="width:1000px">
      <section class="pdf-section" id="one"><h2>Report Section 1</h2><div role="row"><span role="columnheader">Header</span></div><div role="row"><span role="gridcell">Value 100</span></div></section>
      <section class="pdf-section" id="two"><h2>Report Section 2</h2><div>Summary value</div></section>
      <h2 id="orphan">Report Section 3</h2><div id="first-row">First meaningful row</div>
      <article id="small" style="border:1px solid #333">Nested detail</article>
      <article id="large" style="border:1px solid #333">Long detail</article>
      <div class="pdf-page-break-before" id="explicit">Explicit next page</div>
    </main>`;
    const source = document.querySelector<HTMLElement>("#report")!;
    const dimensions: Array<[string, number, number]> = [
        ["#report", 0, 3000], ["#one", 0, 500], ["#one h2", 0, 40], ["#one [role=row]", 50, 40],
        ["#one [role=row]:last-child", 95, 40], ["#two", 550, 300], ["#two h2", 550, 40], ["#two div", 600, 80],
        ["#orphan", 1380, 40], ["#first-row", 1430, 100], ["#small", 1550, 240], ["#large", 1800, 1700],
        ["#explicit", 3550, 50]
    ];
    for (const [selector, top, height] of dimensions) box(source.matches(selector) ? source : source.querySelector(selector)!, top, 1000, height);
    const clone = source.cloneNode(true) as HTMLElement;
    return { source, clone };
}

describe("portrait-first corporate print layout", () => {
    beforeEach(() => { document.body.innerHTML = ""; });

    it("keeps Portrait default semantics and resolves explicit Portrait", () => {
        const result = resolveCorporatePrintLayout(options());
        expect(result.paperOrientation).toBe("portrait");
        expect(result.paperWidthMm).toBe(210); expect(result.paperHeightMm).toBe(297);
    });

    it("preserves explicit Landscape with symmetric page margins", () => {
        const result = resolveCorporatePrintLayout(options({ orientation: "landscape" }));
        expect(result.paperOrientation).toBe("landscape"); expect(result.paperWidthMm).toBe(297);
        expect(corporatePrintCss(result)).toContain("margin:12mm 10mm!important");
    });

    it("retains Auto as an explicit option", () => {
        expect(resolveCorporatePrintLayout(options({ orientation: "auto", meaningfulSourceWidth: 1800,
            meaningfulSourceHeight: 900 })).paperOrientation).toBe("landscape");
    });

    it("uses equal horizontal and vertical margins and centers one source-width root", () => {
        const result = resolveCorporatePrintLayout(options()); const css = corporatePrintCss(result);
        expect(css).toContain("margin:12mm 10mm!important");
        expect(css).toContain("margin-left:auto!important;margin-right:auto!important");
        expect((css.match(/html-pdf-source-width/g) ?? [])).toHaveLength(0);
    });

    it("fits a desktop width once without cropping or responsive reflow", () => {
        const result = resolveCorporatePrintLayout(options({ meaningfulSourceWidth: 1600 }));
        expect(result.finalScale).toBeCloseTo(result.printableWidth / 1600);
        const css = corporatePrintCss(result);
        expect(css).toContain("width:1600px!important");
        expect(css).not.toContain("transform:scale"); expect(css).not.toContain("max-width:100%");
    });

    it("moves an orphan heading with its first content and groups headers", () => {
        const { source, clone } = fixture();
        const snapshot = captureCorporateLayoutSnapshot(source);
        const bound = bindCorporateLayoutSnapshot(clone, snapshot);
        const result = applyCorporatePrintLayout(clone, bound, options());
        expect(clone.querySelector("#orphan")?.classList.contains("html-pdf-page-break-before")).toBe(true);
        expect(clone.querySelector("#orphan")?.classList.contains("html-pdf-keep-with-next")).toBe(true);
        expect(result.orphanBreaksPrevented).toBeGreaterThan(0);
        expect(result.tableHeaderGroups).toBeGreaterThan(0);
    });

    it("keeps a small bordered card intact and lets an oversized card split", () => {
        const { source, clone } = fixture();
        const result = applyCorporatePrintLayout(clone,
            bindCorporateLayoutSnapshot(clone, captureCorporateLayoutSnapshot(source)), options());
        expect(clone.querySelector("#small")?.classList.contains("html-pdf-avoid-break")).toBe(true);
        expect(clone.querySelector("#large")?.classList.contains("html-pdf-avoid-break")).toBe(false);
        expect(result.oversizeBlocksAllowedToSplit).toBe(1);
    });

    it("does not force every short section onto a page or stretch the last page", () => {
        const { source, clone } = fixture();
        const result = applyCorporatePrintLayout(clone,
            bindCorporateLayoutSnapshot(clone, captureCorporateLayoutSnapshot(source)), options());
        expect(clone.querySelector("#one")?.classList.contains("html-pdf-page-break-before")).toBe(false);
        expect(clone.querySelector("#two")?.classList.contains("html-pdf-page-break-before")).toBe(false);
        expect(result.forcedBreaksInserted).toBeLessThan(result.logicalSectionsFound);
        expect(corporatePrintCss(result)).not.toMatch(/justify-content\s*:\s*(space-between|stretch)/);
    });

    it("honors explicit utility classes and can disable automatic smart breaks", () => {
        const { source, clone } = fixture();
        const result = applyCorporatePrintLayout(clone,
            bindCorporateLayoutSnapshot(clone, captureCorporateLayoutSnapshot(source)), options({ smartPageBreaks: false }));
        expect(result.forcedBreaksInserted).toBe(0);
        const css = corporatePrintCss(result);
        expect(css).toContain(".pdf-page-break-before"); expect(css).toContain(".html-pdf-avoid-break");
    });

    it("emits page-box CSS after visual polish without removing content", () => {
        const { source } = fixture(); const layout = resolveCorporatePrintLayout(options());
        const html = buildHtmlDocument(source, { includeStyles: false,
            pdfVisualPolish: { hideScrollbarsInExport: true, expandRenderedScrollContent: true, trimViewportWhitespace: true },
            corporatePrintLayout: layout }, { sourceWidth: 1000, sourceHeight: 3000, orientation: "portrait" });
        expect(html).toContain("Report Section 3"); expect(html).toContain("Value 100");
        expect(html.indexOf("scrollbar-width:none")).toBeLessThan(html.indexOf("@page{size:A4 portrait"));
        expect(html).toContain("overflow:visible!important");
    });
});
