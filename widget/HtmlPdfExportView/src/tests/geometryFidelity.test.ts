import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cloneExportRoot } from "../capture/cloneExportRoot";
import { analyzeSourceGeometry, captureGeometrySnapshot, GeometryDiagnostics } from "../capture/exactViewGeometry";
import { chooseAutoOrientation, measureSourceGeometry } from "../capture/measureSourceGeometry";
import { collectStyles } from "../capture/collectStyles";
import { waitForCaptureStability } from "../capture/waitForCaptureStability";

function box(element: Element, left: number, top: number, width: number, height: number): void {
    element.getBoundingClientRect = () => ({ left, top, width, height, right: left + width, bottom: top + height,
        x: left, y: top, toJSON: () => ({}) });
}

function numericProperty(element: Element, name: string, value: number): void {
    Object.defineProperty(element, name, { configurable: true, value });
}

function fixture(): HTMLElement {
    document.body.innerHTML = `<div id="capture" style="height:100vh;min-height:100vh;display:flex;flex-direction:column" data-box="0,0,1600,768">
        <div id="shell" style="height:100%;flex:1;min-height:0;display:flex;flex-direction:column" data-box="0,0,1600,768">
            <section id="report" style="height:400px;overflow:auto;display:flex;flex-direction:column" data-box="0,0,1600,400">
                <h1 data-box="0,0,400,30">Report</h1>
                <article id="madde1" data-box="0,40,1600,920"><h2 data-box="0,40,300,30">Madde 1</h2>
                    <div id="summary" style="display:grid;position:relative;grid-template-columns:repeat(12, 1fr);column-gap:8px" data-box="0,80,1600,120">
                        <span data-box="0,80,100,25">Özet Bilgiler</span><span data-box="130,80,100,25">Customer 1001</span>
                        <span data-box="270,80,100,25">GROUP_A</span><span data-box="410,80,100,25">1000000</span>
                    </div>
                    <div class="nested" style="display:flex;flex-direction:column" data-box="0,220,1600,340">
                        <h3 data-box="0,220,250,25">Tahsis Bilgileri</h3><span data-box="260,220,120,25">Approved</span>
                        <h3 data-box="0,280,250,25">Kredi Bilgileri</h3><span data-box="260,280,120,25">250000.00</span>
                        <h3 data-box="0,340,250,25">Teminat</h3><span data-box="260,340,120,25">2026-09-22</span>
                    </div>
                    <div class="nested" data-box="0,580,1600,350"><h3 data-box="0,580,250,25">Tahsis Bilgileri</h3>
                        <span data-box="260,580,100,25">Second block</span><h3 data-box="0,650,250,25">Kredi Bilgileri</h3>
                        <span data-box="260,650,100,25">Second value</span>
                        <input id="runtime-value" value="old" data-box="260,700,200,25"></div>
                </article>
                <article id="madde2" data-box="0,990,1600,160"><h2 data-box="0,990,300,30">Madde 2</h2>
                    <span data-box="260,1040,150,25">Later value</span></article>
            </section>
        </div>
    </div>`;
    const root = document.querySelector<HTMLElement>("#capture")!;
    for (const element of [root, ...Array.from(root.querySelectorAll("*"))]) {
        const dimensions = element.getAttribute("data-box")?.split(",").map(Number);
        if (dimensions) box(element, dimensions[0], dimensions[1], dimensions[2], dimensions[3]);
    }
    numericProperty(root, "scrollWidth", 1600);
    numericProperty(root, "scrollHeight", 1600);
    const report = root.querySelector("#report")!;
    numericProperty(report, "scrollHeight", 1150);
    numericProperty(report, "clientHeight", 400);
    root.querySelector<HTMLInputElement>("#runtime-value")!.value = "Current value";
    return root;
}

describe("Exact View geometry fidelity", () => {
    beforeEach(() => { document.head.innerHTML = ""; document.body.innerHTML = ""; });

    it("retains every report value and desktop grid while removing shell and scroll constraints", () => {
        const root = fixture();
        const original = root.outerHTML;
        let diagnostics: GeometryDiagnostics | undefined;
        const clone = cloneExportRoot(root, { includeImages: true, appearanceMode: "exactView",
            onGeometryDiagnostics: value => { diagnostics = value; } });
        const values = ["Customer 1001", "GROUP_A", "1000000", "Approved", "250000.00", "2026-09-22",
            "Second block", "Second value", "Later value"];
        for (const value of values) expect(clone.textContent).toContain(value);
        expect(diagnostics?.visibleTextElementsAfter).toBe(diagnostics?.visibleTextElementsBefore);
        expect(diagnostics?.visibleCharactersAfter).toBe(diagnostics?.visibleCharactersBefore);
        expect(diagnostics?.runtimeValueCountAfter).toBe(diagnostics?.runtimeValueCountBefore);
        expect(clone.querySelector<HTMLInputElement>("#runtime-value")?.value).toBe("Current value");
        expect(diagnostics?.viewportContainersNormalized).toBeGreaterThan(0);
        expect(diagnostics?.overflowContainersExpanded).toBeGreaterThan(0);
        expect(clone.style.width).toBe("1600px");
        expect(clone.style.height).toBe("auto");
        expect(clone.querySelector<HTMLElement>("#report")?.style.overflow).toBe("visible");
        expect(clone.querySelector<HTMLElement>("#summary")?.style.gridTemplateColumns).toBe("repeat(12, 1fr)");
        expect(clone.querySelector("#madde2")?.textContent).toContain("Later value");
        const precedingEnd = root.querySelector("#madde1")!.getBoundingClientRect().bottom;
        const laterStart = root.querySelector("#madde2")!.getBoundingClientRect().top;
        expect(laterStart - precedingEnd).toBeLessThan(80);
        expect(Array.from(clone.querySelectorAll("#summary span,.nested span,#madde2 span"))
            .every(element => { const style = (element as HTMLElement).style;
                return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0"; })).toBe(true);
        expect(root.outerHTML).toBe(original);
        expect(measureSourceGeometry(root)).toEqual({ width: 1600, height: 1065 });
        expect(analyzeSourceGeometry(root).meaningfulContentHeight).toBe(1065);
        const snapshot = captureGeometrySnapshot(root);
        const nodes = [root, ...Array.from(root.querySelectorAll("*"))];
        const valueIndex = nodes.indexOf(root.querySelector("#summary span:nth-child(2)")!);
        const reportIndex = nodes.indexOf(root.querySelector("#report")!);
        const summaryIndex = nodes.indexOf(root.querySelector("#summary")!);
        expect(snapshot.entries[valueIndex].nearestClippingAncestorIndex).toBe(reportIndex);
        expect(snapshot.entries[valueIndex].nearestPositionedAncestorIndex).toBe(summaryIndex);
        expect(snapshot.entries[valueIndex].textCharacters).toBeGreaterThan(0);
    });

    it("keeps intentional fixed height and opens a genuinely clipped child", () => {
        document.body.innerHTML = `<div id="root"><div id="fixed" style="height:200px"><span>Intentional</span></div>
            <div id="clipped" style="height:60px;overflow:hidden"><span>Visible value</span></div></div>`;
        const root = document.querySelector<HTMLElement>("#root")!;
        const fixed = root.querySelector<HTMLElement>("#fixed")!;
        const clipped = root.querySelector<HTMLElement>("#clipped")!;
        box(root, 0, 0, 1000, 400); box(fixed, 0, 0, 1000, 200); box(fixed.querySelector("span")!, 0, 20, 200, 25);
        box(clipped, 0, 220, 1000, 60); box(clipped.querySelector("span")!, 0, 240, 200, 100);
        numericProperty(clipped, "scrollHeight", 120); numericProperty(clipped, "clientHeight", 60);
        const clone = cloneExportRoot(root, { includeImages: true, appearanceMode: "exactView" });
        expect(clone.querySelector<HTMLElement>("#fixed")?.style.height).toBe("200px");
        expect(clone.querySelector<HTMLElement>("#clipped")?.style.overflow).toBe("visible");
        expect(clone.querySelector<HTMLElement>("#clipped")?.style.height).toBe("auto");
        expect(clone.textContent).toContain("Visible value");
    });

    it("ignores application print rules only for Exact View and keeps screen styles", () => {
        const style = document.createElement("style");
        style.textContent = ".report{display:grid;background:#abc}@media print{.report{display:none}}";
        document.head.append(style);
        expect(collectStyles(document, true)).toContain("display: grid");
        expect(collectStyles(document, true)).not.toContain("display: none");
        expect(collectStyles(document, false)).toContain("display: none");
    });

    it("chooses landscape for a wide report and portrait for a narrow report", () => {
        expect(chooseAutoOrientation(1600, 1065, 733, 1062)).toBe("landscape");
        expect(chooseAutoOrientation(700, 1000, 733, 1062)).toBe("portrait");
    });
});

describe("capture stability", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        Object.defineProperty(window, "requestAnimationFrame", { configurable: true,
            value: (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 16) });
        document.body.innerHTML = "<div id='root'><span>First</span></div>";
    });
    afterEach(() => { vi.useRealTimers(); });

    it("waits for changing content and then stabilizes", async () => {
        const root = document.querySelector<HTMLElement>("#root")!;
        window.setTimeout(() => { root.querySelector("span")!.textContent = "First Second"; }, 40);
        const result = waitForCaptureStability(root, 500);
        await vi.advanceTimersByTimeAsync(120);
        expect(await result).toEqual({ stable: true, samples: expect.any(Number) });
    });

    it("stops waiting at the configured maximum", async () => {
        const root = document.querySelector<HTMLElement>("#root")!;
        const interval = window.setInterval(() => { root.querySelector("span")!.textContent += "X"; }, 20);
        const result = waitForCaptureStability(root, 100);
        await vi.advanceTimersByTimeAsync(160);
        window.clearInterval(interval);
        expect((await result).stable).toBe(false);
    });
});
