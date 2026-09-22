export interface GeometryMetrics {
    captureRootClientWidth: number;
    captureRootClientHeight: number;
    captureRootScrollWidth: number;
    captureRootScrollHeight: number;
    meaningfulContentWidth: number;
    meaningfulContentHeight: number;
    visibleTextElements: number;
    visibleCharacters: number;
    runtimeValueCount: number;
    clippedTextElementCount: number;
    elementsOutsideParentBounds: number;
    collapsedParentCount: number;
}

export interface GeometryDiagnostics extends GeometryMetrics {
    visibleTextElementsBefore: number;
    visibleTextElementsAfter: number;
    visibleCharactersBefore: number;
    visibleCharactersAfter: number;
    runtimeValueCountBefore: number;
    runtimeValueCountAfter: number;
    overflowContainersExpanded: number;
    viewportContainersNormalized: number;
}

interface Rect { left: number; top: number; right: number; bottom: number; width: number; height: number }

export interface SourceElementGeometry {
    index: number;
    bounds: Rect;
    display: string;
    visibility: string;
    opacity: string;
    nearestClippingAncestorIndex: number | null;
    nearestPositionedAncestorIndex: number | null;
    textCharacters: number;
    runtimeValue: boolean;
}

export interface SourceGeometrySnapshot { entries: SourceElementGeometry[] }

function rect(element: Element): Rect {
    const value = element.getBoundingClientRect();
    return { left: value.left, top: value.top, right: value.right, bottom: value.bottom,
        width: value.width, height: value.height };
}

function excluded(element: Element): boolean {
    return Boolean(element.closest('[data-html-pdf-export-exclude="true"],[data-html-pdf-export-control="true"]'));
}

function visible(element: Element): boolean {
    if (excluded(element)) return false;
    for (let current: Element | null = element; current; current = current.parentElement) {
        const style = getComputedStyle(current);
        if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse" ||
            (style.opacity !== "" && Number(style.opacity) === 0)) return false;
    }
    return true;
}

function directCharacters(element: Element): number {
    return Array.from(element.childNodes).reduce((count, child) =>
        count + (child.nodeType === Node.TEXT_NODE ? (child.textContent ?? "").trim().length : 0), 0);
}

function hasRuntimeValue(element: Element): boolean {
    if (element instanceof HTMLInputElement) return !["hidden", "button", "submit", "reset", "file", "image"].includes(element.type) &&
        (element.type === "checkbox" || element.type === "radio" ? element.checked : Boolean(element.value));
    return element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement
        ? Boolean(element.value) : false;
}

function contentBearing(element: Element): boolean {
    return directCharacters(element) > 0 || hasRuntimeValue(element) || element.matches("img,svg,canvas");
}

function descendants(root: HTMLElement): HTMLElement[] {
    return [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];
}

export function captureGeometrySnapshot(root: HTMLElement): SourceGeometrySnapshot {
    const nodes = descendants(root);
    const rootBox = rect(root);
    const indices = new Map<Element, number>(nodes.map((node, index) => [node, index]));
    return { entries: nodes.map((node, index) => {
        const box = rect(node), style = getComputedStyle(node);
        let clipping: number | null = null, positioned: number | null = null;
        for (let ancestor = node.parentElement; ancestor && root.contains(ancestor); ancestor = ancestor.parentElement) {
            const ancestorStyle = getComputedStyle(ancestor);
            if (clipping === null && overflowClips(ancestorStyle)) clipping = indices.get(ancestor) ?? null;
            if (positioned === null && /^(relative|absolute|fixed|sticky)$/.test(ancestorStyle.position))
                positioned = indices.get(ancestor) ?? null;
            if (clipping !== null && positioned !== null) break;
        }
        return { index, bounds: { left: box.left - rootBox.left, top: box.top - rootBox.top,
            right: box.right - rootBox.left, bottom: box.bottom - rootBox.top,
            width: box.width, height: box.height },
        display: style.display, visibility: style.visibility, opacity: style.opacity,
        nearestClippingAncestorIndex: clipping, nearestPositionedAncestorIndex: positioned,
        textCharacters: visible(node) ? directCharacters(node) : 0,
        runtimeValue: visible(node) && hasRuntimeValue(node) };
    }) };
}

function contentBottoms(root: HTMLElement, elements: HTMLElement[]): Map<HTMLElement, number> {
    const bottoms = new Map<HTMLElement, number>();
    for (const element of elements) {
        if (!visible(element) || !contentBearing(element)) continue;
        const childBottom = rect(element).bottom;
        bottoms.set(element, Math.max(bottoms.get(element) ?? 0, rect(element).height));
        for (let ancestor = element.parentElement; ancestor && root.contains(ancestor); ancestor = ancestor.parentElement) {
            if (!(ancestor instanceof HTMLElement)) continue;
            bottoms.set(ancestor, Math.max(bottoms.get(ancestor) ?? 0, childBottom - rect(ancestor).top));
            if (ancestor === root) break;
        }
    }
    return bottoms;
}

function overflowClips(style: CSSStyleDeclaration): boolean {
    return /^(auto|scroll|hidden|clip)$/.test(style.overflowX || style.overflow) ||
        /^(auto|scroll|hidden|clip)$/.test(style.overflowY || style.overflow);
}

export function analyzeSourceGeometry(root: HTMLElement): GeometryMetrics {
    const rootRect = rect(root);
    const elements = descendants(root);
    const bottoms = contentBottoms(root, elements);
    let right = 0, bottom = 0, textElements = 0, characters = 0, runtimeValues = 0;
    let clipped = 0, outside = 0, collapsed = 0;
    for (const element of elements) {
        if (!visible(element)) continue;
        const box = rect(element);
        if (element !== root && element.children.length > 0 && box.height <= 1 && (bottoms.get(element) ?? 0) > 2) collapsed++;
        if (!contentBearing(element)) continue;
        const chars = directCharacters(element);
        if (chars > 0) { textElements++; characters += chars; }
        if (hasRuntimeValue(element)) runtimeValues++;
        right = Math.max(right, box.right - rootRect.left);
        bottom = Math.max(bottom, box.bottom - rootRect.top);
        const parent = element.parentElement;
        if (parent && root.contains(parent)) {
            const parentBox = rect(parent);
            if (box.right > parentBox.right + 1 || box.bottom > parentBox.bottom + 1) outside++;
        }
        for (let ancestor = parent; ancestor && root.contains(ancestor); ancestor = ancestor.parentElement) {
            const ancestorBox = rect(ancestor);
            if (overflowClips(getComputedStyle(ancestor)) &&
                (box.right > ancestorBox.right + 1 || box.bottom > ancestorBox.bottom + 1)) {
                clipped++;
                break;
            }
        }
    }
    return {
        captureRootClientWidth: Math.ceil(rootRect.width), captureRootClientHeight: Math.ceil(rootRect.height),
        captureRootScrollWidth: root.scrollWidth, captureRootScrollHeight: root.scrollHeight,
        meaningfulContentWidth: Math.max(0, Math.ceil(right)), meaningfulContentHeight: Math.max(0, Math.ceil(bottom)),
        visibleTextElements: textElements, visibleCharacters: characters, runtimeValueCount: runtimeValues,
        clippedTextElementCount: clipped, elementsOutsideParentBounds: outside, collapsedParentCount: collapsed
    };
}

function viewportLike(source: HTMLElement, style: CSSStyleDeclaration, contentBottom: number): boolean {
    const declared = `${source.style.height} ${source.style.minHeight}`;
    const explicitViewport = /(?:^|\s)(?:min-)?height\s*:\s*[^;]*vh/i.test(source.getAttribute("style") ?? "") ||
        /\b\d+(?:\.\d+)?vh\b|\b100%\b/.test(declared);
    const height = rect(source).height;
    const viewportHeight = Math.max(1, window.innerHeight);
    const computedMinHeight = Number.parseFloat(style.minHeight);
    const computedViewportMinimum = source.children.length > 0 && Number.isFinite(computedMinHeight) &&
        Math.abs(computedMinHeight - viewportHeight) < Math.max(30, viewportHeight * 0.1);
    const looksLikeShell = Math.abs(height - viewportHeight) < Math.max(30, viewportHeight * 0.1) &&
        (style.display === "flex" || (style.overflowY || style.overflow) === "auto" ||
            (style.overflowY || style.overflow) === "scroll");
    return (explicitViewport || computedViewportMinimum || looksLikeShell) && height > 0 &&
        (contentBottom < height * 0.7 || contentBottom > height + 4);
}

export function normalizeExactViewGeometry(source: HTMLElement, clone: HTMLElement,
                                           snapshot: SourceGeometrySnapshot = captureGeometrySnapshot(source)): GeometryDiagnostics {
    const before = analyzeSourceGeometry(source);
    const originals = descendants(source);
    const copies = descendants(clone);
    const bottoms = contentBottoms(source, originals);
    let overflowContainersExpanded = 0;
    let viewportContainersNormalized = 0;
    const inflatedScrollWidth = before.meaningfulContentWidth > 0 &&
        before.captureRootScrollWidth > before.meaningfulContentWidth * 1.3 &&
        before.captureRootClientWidth <= before.meaningfulContentWidth * 1.1;
    const sourceWidth = Math.max(1, before.captureRootClientWidth, before.meaningfulContentWidth,
        inflatedScrollWidth ? 0 : before.captureRootScrollWidth);
    clone.style.boxSizing = "border-box";
    clone.style.width = `${sourceWidth}px`;
    clone.style.minWidth = `${sourceWidth}px`;
    for (let index = 0; index < originals.length; index++) {
        const current = originals[index], target = copies[index];
        if (!target || !visible(current)) continue;
        const style = getComputedStyle(current);
        if (style.display === "grid" || style.display === "inline-grid") {
            target.style.display = style.display;
            if (style.gridTemplateColumns && style.gridTemplateColumns !== "none") target.style.gridTemplateColumns = style.gridTemplateColumns;
            if (style.columnGap) target.style.columnGap = style.columnGap;
            if (style.rowGap) target.style.rowGap = style.rowGap;
        } else if (style.display === "flex" || style.display === "inline-flex") {
            target.style.display = style.display;
            target.style.flexDirection = style.flexDirection;
            if (style.gap) target.style.gap = style.gap;
            if (style.alignItems) target.style.alignItems = style.alignItems;
        }
        const height = snapshot.entries[index]?.bounds.height ?? rect(current).height;
        const contentBottom = bottoms.get(current) ?? 0;
        const overflowY = style.overflowY || style.overflow;
        const overflowScrollable = /^(auto|scroll)$/.test(overflowY) &&
            Math.max(current.scrollHeight, contentBottom) > Math.max(height, current.clientHeight) + 4;
        const hiddenClipsContent = /^(hidden|clip)$/.test(overflowY) && contentBottom > height + 4 &&
            (height <= 1 || current.scrollHeight > current.clientHeight + 4);
        if (overflowScrollable || hiddenClipsContent) {
            target.style.overflow = "visible";
            target.style.maxHeight = "none";
            target.style.height = "auto";
            target.style.minHeight = "0";
            overflowContainersExpanded++;
        }
        if (viewportLike(current, style, contentBottom)) {
            target.style.height = "auto";
            target.style.minHeight = "0";
            target.style.maxHeight = "none";
            const parent = current.parentElement;
            if (parent && getComputedStyle(parent).display === "flex" && getComputedStyle(parent).flexDirection === "column") {
                target.style.flex = "0 0 auto";
            }
            viewportContainersNormalized++;
        }
    }
    const after = countCloneContent(clone, originals);
    return { ...before, visibleTextElementsBefore: before.visibleTextElements,
        visibleTextElementsAfter: after.textElements, visibleCharactersBefore: before.visibleCharacters,
        visibleCharactersAfter: after.characters, runtimeValueCountBefore: before.runtimeValueCount,
        runtimeValueCountAfter: after.runtimeValues, overflowContainersExpanded, viewportContainersNormalized };
}

function countCloneContent(clone: HTMLElement, originals: HTMLElement[]): { textElements: number; characters: number; runtimeValues: number } {
    const copies = descendants(clone);
    let textElements = 0, characters = 0, runtimeValues = 0;
    copies.forEach((element, index) => {
        if (!originals[index] || !visible(originals[index]) || !visibleInline(element)) return;
        const chars = directCharacters(element);
        if (chars > 0) { textElements++; characters += chars; }
        if (hasRuntimeValue(element)) runtimeValues++;
    });
    return { textElements, characters, runtimeValues };
}

function visibleInline(element: Element): boolean {
    for (let current: Element | null = element; current; current = current.parentElement) {
        if (!(current instanceof HTMLElement)) continue;
        if (current.style.display === "none" || current.style.visibility === "hidden" ||
            current.style.visibility === "collapse" || current.style.opacity === "0") return false;
    }
    return true;
}
