import { serializeCanvas } from "./serializeCanvas";
import { synchronizeFormState } from "./synchronizeFormState";
import { cleanExportDom, ExportAppearanceMode } from "./cleanExportDom";
import { captureGeometrySnapshot, GeometryDiagnostics, normalizeExactViewGeometry } from "./exactViewGeometry";

export interface CloneOptions { includeImages: boolean; appearanceMode?: ExportAppearanceMode;
    onGeometryDiagnostics?: (diagnostics: GeometryDiagnostics) => void; }

export function cloneExportRoot(root: HTMLElement, options: CloneOptions): HTMLElement {
    const snapshot = (options.appearanceMode ?? "exactView") === "exactView" ? captureGeometrySnapshot(root) : undefined;
    const clone = root.cloneNode(true) as HTMLElement;
    synchronizeFormState(root, clone);
    if (snapshot) {
        const diagnostics = normalizeExactViewGeometry(root, clone, snapshot);
        options.onGeometryDiagnostics?.(diagnostics);
    }
    if (options.includeImages) {
        normalizeImageResources(root, clone);
        serializeCanvas(root, clone);
    }
    else clone.querySelectorAll("img,canvas").forEach(element => element.remove());
    cleanExportDom(clone, options.appearanceMode ?? "exactView");
    return clone;
}

function normalizeImageResources(source: Element, clone: Element): void {
    const sourceImages = Array.from(source.querySelectorAll<HTMLImageElement>("img"));
    const cloneImages = Array.from(clone.querySelectorAll<HTMLImageElement>("img"));
    sourceImages.forEach((image, index) => {
        const target = cloneImages[index];
        if (target && image.src) target.src = image.currentSrc || image.src;
    });
    const sourceSvgImages = Array.from(source.querySelectorAll<SVGElement>("image"));
    const cloneSvgImages = Array.from(clone.querySelectorAll<SVGElement>("image"));
    sourceSvgImages.forEach((image, index) => {
        const target = cloneSvgImages[index];
        const href = image.getAttribute("href") || image.getAttribute("xlink:href");
        if (!target || !href || href.startsWith("#") || /^(data:|blob:|https?:)/i.test(href)) return;
        try { target.setAttribute("href", new URL(href, image.baseURI).href); } catch { /* Preserve unresolved source. */ }
    });
}
