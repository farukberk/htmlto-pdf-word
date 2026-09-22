import { beforeEach, describe, expect, it } from "vitest";
import { buildHtmlDocument } from "../capture/buildHtmlDocument";
import { cloneExportRoot } from "../capture/cloneExportRoot";
import { GeometryDiagnostics } from "../capture/exactViewGeometry";
import { pdfVisualPolishCss, PdfVisualPolishOptions } from "../capture/pdfVisualPolish";

const defaults: PdfVisualPolishOptions = {
    hideScrollbarsInExport: true, expandRenderedScrollContent: true, trimViewportWhitespace: true
};

function box(element: Element, left: number, top: number, width: number, height: number): void {
    element.getBoundingClientRect = () => ({ left, top, width, height, right: left + width, bottom: top + height,
        x: left, y: top, toJSON: () => ({}) });
}

function dimension(element: Element, name: string, value: number): void {
    Object.defineProperty(element, name, { configurable: true, value });
}

describe("shared Current View PDF visual polish", () => {
    beforeEach(() => { document.head.innerHTML = ""; document.body.innerHTML = ""; });

    it("hides vertical, horizontal, document and nested scrollbar chrome only in export HTML", () => {
        const root = document.createElement("div");
        root.innerHTML = "<section style='overflow:auto'><span>Report value</span></section>";
        document.body.append(root);
        const original = root.outerHTML;
        const clone = cloneExportRoot(root, { includeImages: true, appearanceMode: "exactView", pdfVisualPolish: defaults });
        const html = buildHtmlDocument(clone, { includeStyles: false, appearanceMode: "exactView", pdfVisualPolish: defaults });
        expect(html).toContain("html::-webkit-scrollbar");
        expect(html).toContain("body::-webkit-scrollbar");
        expect(html).toContain("::-webkit-scrollbar-thumb");
        expect(html).toContain("::-webkit-scrollbar-track");
        expect(html).toContain("::-webkit-scrollbar-corner");
        expect(html).toContain("scrollbar-width:none!important");
        expect(html).toContain("-ms-overflow-style:none!important");
        expect(html).toContain("html,body{height:auto!important;min-height:0!important;overflow:visible!important}");
        expect(html).toContain("@page");
        expect(root.outerHTML).toBe(original);
    });

    it("expands rendered report content, trims viewport filler and retains desktop columns and runtime values", () => {
        document.body.innerHTML = `<main id="root" style="height:100vh;min-height:100vh;display:flex;flex-direction:column;padding:16px">
            <section id="report" style="height:400px;overflow:auto;margin-bottom:24px">
                <div id="columns" style="display:grid;grid-template-columns:repeat(8, 1fr)"><span>Madde 1</span><span>Customer 1001</span></div>
                <textarea id="notes">Old</textarea><article>Madde 2</article></section></main>`;
        const root = document.querySelector<HTMLElement>("#root")!;
        const report = root.querySelector<HTMLElement>("#report")!;
        const columns = root.querySelector<HTMLElement>("#columns")!;
        const textarea = root.querySelector<HTMLTextAreaElement>("#notes")!;
        textarea.value = "Current visible note";
        box(root, 0, 0, 1600, 768); box(report, 0, 0, 1600, 400); box(columns, 0, 0, 1600, 100);
        box(columns.children[0], 0, 0, 200, 30); box(columns.children[1], 200, 0, 200, 30);
        box(textarea, 0, 120, 500, 150); box(root.querySelector("article")!, 0, 800, 500, 50);
        dimension(root, "scrollWidth", 1600); dimension(root, "scrollHeight", 1500);
        dimension(report, "scrollHeight", 850); dimension(report, "clientHeight", 400);
        const original = root.outerHTML;
        let diagnostics: GeometryDiagnostics | undefined;
        const clone = cloneExportRoot(root, { includeImages: true, appearanceMode: "exactView", pdfVisualPolish: defaults,
            onGeometryDiagnostics: value => { diagnostics = value; } });
        expect(clone.style.width).toBe("1600px");
        expect(clone.style.height).toBe("auto");
        expect(clone.style.padding).toBe("16px");
        expect(clone.querySelector<HTMLElement>("#report")?.style.overflow).toBe("visible");
        expect(clone.querySelector<HTMLElement>("#report")?.style.marginBottom).toBe("24px");
        expect(clone.querySelector<HTMLElement>("#columns")?.style.gridTemplateColumns).toBe("repeat(8, 1fr)");
        expect(clone.querySelector<HTMLTextAreaElement>("#notes")?.style.resize).toBe("none");
        expect(clone.querySelector<HTMLTextAreaElement>("#notes")?.value).toBe("Current visible note");
        expect(clone.textContent).toContain("Madde 2");
        expect(clone.querySelectorAll("article")).toHaveLength(1);
        expect(diagnostics?.visibleCharactersAfter).toBe(diagnostics?.visibleCharactersBefore);
        expect(diagnostics?.overflowContainersExpanded).toBeGreaterThan(0);
        expect(diagnostics?.viewportContainersNormalized).toBeGreaterThan(0);
        expect(diagnostics?.trimmedTrailingWhitespace).toBeGreaterThan(0);
        expect(root.outerHTML).toBe(original);
    });

    it("preserves unsafe virtualized and interactive scroll geometry while hiding its chrome", () => {
        document.body.innerHTML = `<div id="root"><div id="virtual" role="grid" aria-rowcount="500" style="height:300px;overflow:auto">
            <div role="row">Rendered row 1</div><div role="row">Rendered row 2</div></div>
            <div id="carousel" role="tablist" style="height:100px;overflow:auto"><span>Slide</span></div></div>`;
        const root = document.querySelector<HTMLElement>("#root")!;
        const virtual = root.querySelector<HTMLElement>("#virtual")!;
        const carousel = root.querySelector<HTMLElement>("#carousel")!;
        box(root, 0, 0, 1000, 500); box(virtual, 0, 0, 1000, 300); box(carousel, 0, 320, 1000, 100);
        dimension(virtual, "scrollHeight", 900); dimension(virtual, "clientHeight", 300);
        dimension(carousel, "scrollHeight", 400); dimension(carousel, "clientHeight", 100);
        let diagnostics: GeometryDiagnostics | undefined;
        const clone = cloneExportRoot(root, { includeImages: true, appearanceMode: "exactView", pdfVisualPolish: defaults,
            onGeometryDiagnostics: value => { diagnostics = value; } });
        expect(clone.querySelector<HTMLElement>("#virtual")?.style.overflow).toBe("auto");
        expect(clone.querySelector<HTMLElement>("#carousel")?.style.overflow).toBe("auto");
        expect(clone.querySelectorAll("[role='row']")).toHaveLength(2);
        expect(diagnostics?.unsafeScrollContainers).toBe(2);
        expect(pdfVisualPolishCss(defaults)).toContain("::-webkit-scrollbar");
    });

    it("can disable each polish option without changing intentional fixed-height content", () => {
        document.body.innerHTML = `<div id="root" style="height:100vh"><div id="fixed" style="height:200px">Fixed panel</div>
            <div id="scroll" style="height:100px;overflow:auto"><span>Rendered detail</span></div></div>`;
        const root = document.querySelector<HTMLElement>("#root")!;
        const fixed = root.querySelector<HTMLElement>("#fixed")!;
        const scroll = root.querySelector<HTMLElement>("#scroll")!;
        box(root, 0, 0, 1000, 768); box(fixed, 0, 0, 1000, 200);
        box(fixed.firstElementChild ?? fixed, 0, 0, 1000, 200);
        box(scroll, 0, 220, 1000, 100); box(scroll.querySelector("span")!, 0, 220, 200, 25);
        dimension(scroll, "scrollHeight", 500); dimension(scroll, "clientHeight", 100);
        const disabled = { hideScrollbarsInExport: false, expandRenderedScrollContent: false, trimViewportWhitespace: false };
        const clone = cloneExportRoot(root, { includeImages: true, appearanceMode: "exactView", pdfVisualPolish: disabled });
        expect(clone.style.height).toBe("100vh");
        expect(clone.querySelector<HTMLElement>("#fixed")?.style.height).toBe("200px");
        expect(clone.querySelector<HTMLElement>("#scroll")?.style.overflow).toBe("auto");
        expect(pdfVisualPolishCss(disabled)).not.toContain("::-webkit-scrollbar");
    });

    it("shares the polish layer with Clean Report after staticization", () => {
        document.body.innerHTML = `<div id="root"><label>Notes<textarea>Old</textarea></label>
            <button data-html-pdf-export-control="true">Export</button><section style="overflow:auto">Report value</section></div>`;
        const root = document.querySelector<HTMLElement>("#root")!;
        root.querySelector("textarea")!.value = "Updated note";
        const clone = cloneExportRoot(root, { includeImages: true, appearanceMode: "cleanReport", pdfVisualPolish: defaults });
        const html = buildHtmlDocument(clone, { includeStyles: false, appearanceMode: "cleanReport", pdfVisualPolish: defaults });
        expect(clone.classList.contains("html-pdf-clean-report")).toBe(true);
        expect(clone.classList.contains("html-pdf-visual-polish")).toBe(true);
        expect(clone.textContent).toContain("Updated note");
        expect(clone.textContent).toContain("Report value");
        expect(clone.textContent).not.toContain("Export");
        expect(html).toContain("::-webkit-scrollbar");
    });

    it("preserves all rendered horizontal columns rather than cropping them", () => {
        document.body.innerHTML = `<div id="root"><div id="wide" style="overflow-x:auto;width:900px">
            <div id="grid" style="display:grid;grid-template-columns:repeat(10, 1fr)"><span>First column</span><span>Last column</span></div>
            </div></div>`;
        const root = document.querySelector<HTMLElement>("#root")!;
        const wide = root.querySelector<HTMLElement>("#wide")!;
        box(root, 0, 0, 1600, 500); box(wide, 0, 0, 900, 300); box(root.querySelector("#grid")!, 0, 0, 1600, 300);
        box(root.querySelector("#grid span:first-child")!, 0, 0, 160, 30);
        box(root.querySelector("#grid span:last-child")!, 1440, 0, 160, 30);
        dimension(root, "scrollWidth", 1600); dimension(wide, "scrollWidth", 1600); dimension(wide, "clientWidth", 900);
        const clone = cloneExportRoot(root, { includeImages: true, appearanceMode: "exactView", pdfVisualPolish: defaults });
        expect(clone.style.width).toBe("1600px");
        expect(clone.querySelector<HTMLElement>("#wide")?.style.width).toBe("1600px");
        expect(clone.querySelector<HTMLElement>("#wide")?.style.overflow).toBe("visible");
        expect(clone.querySelector<HTMLElement>("#grid")?.style.gridTemplateColumns).toBe("repeat(10, 1fr)");
        expect(clone.textContent).toContain("Last column");
    });
});
