import { beforeEach, describe, expect, it, vi } from "vitest";
import { cloneExportRoot } from "../capture/cloneExportRoot";
import { buildHtmlDocument } from "../capture/buildHtmlDocument";
import { collectStyles } from "../capture/collectStyles";
import { DEFAULT_PDF_ORIENTATION, measureSourceGeometry } from "../capture/measureSourceGeometry";

describe("CurrentView capture", () => {
    beforeEach(() => { document.head.innerHTML = ""; document.body.innerHTML = ""; });

    it("synchronizes input, textarea, checkbox, radio and select state", () => {
        document.body.innerHTML = `<div id="root"><input id="i"><textarea></textarea><input id="c" type="checkbox"><input id="r" type="radio"><select><option>a</option><option>b</option></select></div>`;
        const root = document.querySelector<HTMLElement>("#root")!;
        root.querySelector<HTMLInputElement>("#i")!.value = "çığ";
        root.querySelector<HTMLTextAreaElement>("textarea")!.value = "İstanbul";
        root.querySelector<HTMLInputElement>("#c")!.checked = true;
        root.querySelector<HTMLInputElement>("#r")!.checked = true;
        root.querySelector<HTMLSelectElement>("select")!.selectedIndex = 1;
        const clone = cloneExportRoot(root, { includeImages: true });
        expect(clone.querySelector<HTMLInputElement>("#i")!.value).toBe("çığ");
        expect(clone.querySelector("textarea")!.textContent).toBe("İstanbul");
        expect(clone.querySelector<HTMLInputElement>("#c")!.checked).toBe(true);
        expect(clone.querySelector<HTMLInputElement>("#r")!.checked).toBe(true);
        expect(clone.querySelector<HTMLSelectElement>("select")!.value).toBe("b");
    });

    it("preserves SVG and Turkish characters in a standalone document", () => {
        const root = document.createElement("div");
        root.innerHTML = `ç Ç ğ Ğ ı İ ö Ö ş Ş ü Ü<svg><circle cx="1" cy="1" r="1"/></svg>`;
        const html = buildHtmlDocument(root, { includeStyles: false });
        expect(html.startsWith("<!doctype html>")).toBe(true);
        expect(html).toContain('<meta charset="UTF-8">');
        expect(html).toContain("ç Ç ğ Ğ ı İ ö Ö ş Ş ü Ü");
        expect(html).toContain("<svg>");
        expect(html).toContain("<body>");
    });

    it("captures source geometry and transports every PDF orientation", () => {
        const root = document.createElement("div");
        Object.defineProperty(root, "scrollWidth", { value: 1804 });
        Object.defineProperty(root, "scrollHeight", { value: 920 });
        root.getBoundingClientRect = () => ({ width: 1600.2, height: 800.1, x: 0, y: 0, top: 0, right: 1600.2, bottom: 800.1, left: 0, toJSON: () => ({}) });
        const geometry = measureSourceGeometry(root);
        expect(DEFAULT_PDF_ORIENTATION).toBe("portrait");
        expect(geometry).toEqual({ width: 1804, height: 920 });
        for (const orientation of ["portrait", "landscape", "auto"] as const) {
            const html = buildHtmlDocument(root, { includeStyles: false }, { sourceWidth: geometry.width, sourceHeight: geometry.height, orientation });
            expect(html).toContain('data-html-pdf-source-width="1804"');
            expect(html).toContain('data-html-pdf-source-height="920"');
            expect(html).toContain(`data-html-pdf-orientation="${orientation}"`);
            expect(html.startsWith("<!doctype html>")).toBe(true);
        }
    });

    it("supports empty content", () => {
        const html = buildHtmlDocument(document.createElement("div"), { includeStyles: false });
        expect(html).toContain("<div></div>");
    });

    it("removes export controls only from the clone", () => {
        const root = document.createElement("div");
        root.innerHTML = '<main>Report</main><button data-html-pdf-export-control="true">Export</button>';
        const clone = cloneExportRoot(root, { includeImages: true, appearanceMode: "exactView" });
        expect(clone.querySelector('[data-html-pdf-export-control="true"]')).toBeNull();
        expect(root.querySelector('[data-html-pdf-export-control="true"]')).not.toBeNull();
        expect(clone.textContent).toContain("Report");
    });

    it("removes DataGrid2 chrome while preserving headers, rows and normal page controls", () => {
        const root = document.createElement("div");
        root.innerHTML = `
            <input id="outside-input" value="Çağrı İstanbul">
            <div data-html-pdf-export-exclude="true">Explicit exclusion</div>
            <section class="widget-datagrid">
                <div class="widget-datagrid-top-bar"><button>Grid action</button></div>
                <div class="widget-datagrid-grid-head">
                    <div class="tr"><div class="th">Name</div><div class="th">Description <svg class="mx-datagrid-sort-icon"></svg></div><div class="th widget-datagrid-col-select"><input type="checkbox"></div></div>
                </div>
                <div class="widget-datagrid-header header-filters"><input value="filter"><select><option>contains</option></select><button>Apply</button></div>
                <div class="widget-datagrid-grid-body table-content">
                    <div class="tr"><div class="td-text">Başarılı</div><div class="td-text">Şişli Özgür Güneş ç Ç ğ Ğ ı İ ö Ö ş Ş ü Ü</div><div class="td-custom-content"><button aria-label="View"><svg class="fa-eye"></svg><span class="sr-only">View</span></button></div></div>
                </div>
                <div class="widget-datagrid-paging-bottom"><div class="pagination-bar"><button>Next</button><span class="paging-status">1 to 3 of 3</span></div></div>
            </section>
            <button data-html-pdf-export-control="true">Export</button>`;

        const original = root.innerHTML;
        const clone = cloneExportRoot(root, { includeImages: true, appearanceMode: "cleanReport" });
        expect(clone.textContent).toContain("Name");
        expect(clone.textContent).toContain("Başarılı");
        expect(clone.textContent).toContain("Şişli Özgür Güneş ç Ç ğ Ğ ı İ ö Ö ş Ş ü Ü");
        expect(clone.querySelector("#outside-input")).toBeNull();
        expect(clone.textContent).toContain("Çağrı İstanbul");
        expect(clone.querySelector(".header-filters")).not.toBeNull();
        expect(Array.from(clone.querySelectorAll(".header-filters input,.header-filters select,.header-filters button"))
            .every(element => element.getAttribute("data-html-pdf-clean-neutralized") === "true")).toBe(true);
        expect(clone.querySelector(".mx-datagrid-sort-icon")).toBeNull();
        expect(clone.querySelector(".widget-datagrid-paging-bottom")).toBeNull();
        expect(clone.textContent).not.toContain("1 to 3 of 3");
        expect(clone.querySelector(".fa-eye")).toBeNull();
        expect(clone.querySelector('[data-html-pdf-export-control="true"]')).toBeNull();
        expect(clone.querySelector('[data-html-pdf-export-exclude="true"]')).toBeNull();
        expect(root.innerHTML).toBe(original);
    });

    it("preserves complete DataGrid2 structure and controls in ExactView", () => {
        const root = document.createElement("div");
        root.innerHTML = `
            <div class="top-form"><input id="title"><textarea></textarea><input type="date"><input id="active" type="radio"><input id="status" type="radio"><select><option selected>Taslak</option></select></div>
            <section class="widget-datagrid">
                <div class="widget-datagrid-top-bar"><button>Toolbar</button></div>
                <div class="widget-datagrid-grid-head"><div class="tr"><div class="th">Name <svg class="mx-datagrid-sort-icon"></svg></div><div class="th">Description</div><div class="th">Amount</div><div class="th">Row date</div><div class="th">Active</div><div class="th">Action</div></div></div>
                <div class="widget-datagrid-header header-filters"><input value="Test"><select><option selected>Contains</option></select><input type="date" value="2026-09-11"></div>
                <div class="widget-datagrid-grid-body"><div class="tr"><div>Test Kaydı 1</div><div>Açıklama çğıöşü</div><div>1250.5</div><div>9/11/2026</div><div>Yes</div><div><button><svg class="fa-eye"></svg></button></div></div></div>
                <div class="widget-datagrid-paging-bottom"><span class="paging-status">1 to 3 of 3</span><button>Next</button></div>
            </section>
            <button data-html-pdf-export-control="true">Export</button><button data-html-pdf-export-exclude="true">Developer</button>`;
        const title = root.querySelector<HTMLInputElement>("#title")!;
        const textarea = root.querySelector<HTMLTextAreaElement>("textarea")!;
        title.value = "HTML PDF Türkçe Test çğıöşü";
        textarea.value = "Bu alan HTML export testi için oluşturuldu.";
        root.querySelector<HTMLInputElement>("#active")!.checked = true;
        root.querySelector<HTMLInputElement>("#status")!.checked = true;
        const original = root.innerHTML;

        const clone = cloneExportRoot(root, { includeImages: true, appearanceMode: "exactView" });
        expect(clone.querySelector(".widget-datagrid-grid-head")?.textContent).toContain("Description");
        expect(clone.querySelector(".widget-datagrid-grid-body")?.textContent).toContain("Test Kaydı 1");
        expect(clone.querySelector(".header-filters input")).not.toBeNull();
        expect(clone.querySelector(".mx-datagrid-sort-icon")).not.toBeNull();
        expect(clone.querySelector(".widget-datagrid-paging-bottom")).not.toBeNull();
        expect(clone.querySelector(".fa-eye")).not.toBeNull();
        expect(clone.querySelector(".widget-datagrid-top-bar")).not.toBeNull();
        expect(clone.querySelector<HTMLInputElement>("#title")!.value).toBe("HTML PDF Türkçe Test çğıöşü");
        expect(clone.querySelector("textarea")!.textContent).toBe("Bu alan HTML export testi için oluşturuldu.");
        expect(clone.querySelector<HTMLInputElement>("#active")!.checked).toBe(true);
        expect(clone.querySelector<HTMLInputElement>("#status")!.checked).toBe(true);
        expect(clone.querySelector('[data-html-pdf-export-control="true"]')).toBeNull();
        expect(clone.querySelector('[data-html-pdf-export-exclude="true"]')).toBeNull();
        expect(root.innerHTML).toBe(original);
    });

    it("cleans a three-row report without changing grid cell structure or unrelated layouts", () => {
        const root = document.createElement("div");
        root.style.width = "1440px";
        root.innerHTML = `
            <article class="rich-text"><h2>Çağrı raporu</h2><p>Türkçe ç Ç ğ Ğ ı İ ö Ö ş Ş ü Ü</p><ul><li>Korunur</li></ul></article>
            <div class="cards" style="display:flex"><section>Kart 1</section><section>Kart 2</section></div>
            <div class="generic-grid" style="display:grid;grid-template-columns:1fr 1fr"><span>A</span><span>B</span></div>
            <section class="widget-datagrid" style="display:block">
                <div class="widget-datagrid-top-bar"><button>Yeni</button></div>
                <div class="widget-datagrid-grid-head">
                    <div class="tr" style="display:grid;grid-template-columns:2fr 3fr 1fr 1fr 1fr 40px">
                        <div class="th"><div class="column-header clickable" aria-sort="ascending"><span>Name</span><svg class="mx-datagrid-sort-icon"></svg></div><div class="filter"><div class="filter-container"><button class="filter-selector-button"></button><input class="filter-input"></div></div></div><div class="th">Description</div><div class="th">Amount</div><div class="th">Row date</div><div class="th">Active</div><div class="th action-cell">Action</div>
                    </div>
                </div>
                <div class="widget-datagrid-header header-filters">
                    <div class="th"><input value="Test"></div><div class="th"><select><option>Contains</option></select></div><div class="th"><input></div><div class="th"><input type="date"></div><div class="th"><input type="checkbox"></div><div class="th action-cell"><button><svg></svg></button></div>
                </div>
                <div class="widget-datagrid-grid-body">
                    <div class="tr"><div class="td-text">Test Kaydı 1</div><div class="td-text">Açıklama çğıöşü</div><div class="td-text">1250.5</div><div class="td-text">9/11/2026</div><div class="td-text">Yes</div><div class="td-custom-content action-cell"><button><svg></svg><span class="sr-only">View</span></button></div></div>
                    <div class="tr"><div class="td-text">Test Kaydı 2</div><div class="td-text">Açıklama çğıöşü</div><div class="td-text">2500</div><div class="td-text">9/11/2026</div><div class="td-text">Yes</div><div class="td-custom-content action-cell"><button><svg></svg></button></div></div>
                    <div class="tr"><div class="td-text">Test Kaydı 3</div><div class="td-text">Açıklama çğıöşü</div><div class="td-text">9999.99</div><div class="td-text">9/11/2026</div><div class="td-text">Yes</div><div class="td-custom-content action-cell"><button><svg></svg></button></div></div>
                </div>
                <div class="widget-datagrid-paging-bottom"><button>Next</button><span>1 to 3 of 3</span></div>
            </section>`;
        Object.defineProperty(root, "scrollWidth", { value: 1440 });
        const original = root.innerHTML;
        const originalRows = Array.from(root.querySelectorAll(".widget-datagrid-grid-body .tr"))
            .map(row => Array.from(row.children).map(cell => cell.className));
        const originalGeometry = measureSourceGeometry(root);

        const clone = cloneExportRoot(root, { includeImages: true, appearanceMode: "cleanReport" });
        const cleanRows = Array.from(clone.querySelectorAll(".widget-datagrid-grid-body .tr"));
        expect(cleanRows.map(row => Array.from(row.children).map(cell => cell.className))).toEqual(originalRows);
        expect(cleanRows.every(row => row.children.length === 6)).toBe(true);
        expect(clone.querySelectorAll(".widget-datagrid-grid-head .th")).toHaveLength(6);
        expect(clone.querySelectorAll(".header-filters .th")).toHaveLength(6);
        expect(clone.querySelectorAll(".action-cell")).toHaveLength(5);
        expect(clone.querySelectorAll(".action-cell button,.action-cell svg")).toHaveLength(0);
        expect(clone.querySelector(".mx-datagrid-sort-icon")).toBeNull();
        expect(clone.querySelector(".filter,.filter-container,.filter-input,.filter-selector-button")).toBeNull();
        expect(clone.querySelector(".column-header")?.classList.contains("clickable")).toBe(false);
        expect(clone.querySelector(".widget-datagrid-grid-head .th")?.textContent).toContain("Name");
        expect(clone.querySelectorAll(".header-filters input,.header-filters select,.header-filters button")).toHaveLength(0);
        expect(clone.querySelector(".widget-datagrid-paging-bottom")).toBeNull();
        expect(cleanRows.map(row => Array.from(row.children).map(cell => cell.textContent?.trim()))).toEqual([
            ["Test Kaydı 1", "Açıklama çğıöşü", "1250.5", "9/11/2026", "Yes", ""],
            ["Test Kaydı 2", "Açıklama çğıöşü", "2500", "9/11/2026", "Yes", ""],
            ["Test Kaydı 3", "Açıklama çğıöşü", "9999.99", "9/11/2026", "Yes", ""]
        ]);
        expect(clone.querySelector(".rich-text")?.textContent).toContain("Türkçe ç Ç ğ Ğ ı İ ö Ö ş Ş ü Ü");
        expect(clone.querySelector(".cards")?.children).toHaveLength(2);
        expect(clone.querySelector(".generic-grid")?.children).toHaveLength(2);
        expect(originalGeometry.width).toBe(1440);
        expect(root.innerHTML).toBe(original);
    });

    it("renders live business form values as static CleanReport content while ExactView stays interactive", () => {
        const root = document.createElement("div");
        root.innerHTML = `
            <div class="report-form" style="display:flex">
                <div><label for="title">Title</label><input id="title" type="text" value="old"></div>
                <div><label for="description">Description</label><textarea id="description">old</textarea></div>
                <div><label for="date">Document date</label><input id="date" type="date" value="2026-09-11" aria-valuetext="9/11/2026"><button type="button" aria-label="Open calendar"><svg></svg></button></div>
                <div><label>Active</label><div class="mx-radiogroup"><div class="radio"><input id="active-yes" type="radio" name="active" value="internal-yes"><label for="active-yes">Yes</label></div><div class="radio"><input id="active-no" type="radio" name="active" value="internal-no"><label for="active-no">No</label></div></div></div>
                <div><label>Status</label><div class="mx-radiogroup"><div><input id="status-draft" type="radio" name="status" value="draft"><label for="status-draft">Taslak</label></div><div><input id="status-approved" type="radio" name="status" value="approved"><label for="status-approved">Onaylandı</label></div><div><input id="status-rejected" type="radio" name="status" value="rejected"><span><label for="status-rejected">Reddedildi</label></span></div></div></div>
                <div><label for="approved">Approved</label><input id="approved" type="checkbox" data-true-caption="Yes"></div>
                <div><label for="priority">Priority</label><select id="priority"><option>Low</option><option>High</option></select></div>
            </div>
            <button type="button">ACT Test html to pdf</button>
            <div data-html-pdf-export-exclude="true">Developer-only</div>
            <section class="rich-text"><h2>Rich heading</h2><p><strong>Kalın</strong> <em>italik</em> çğıöşü</p></section>
            <span class="business-status"><svg data-html-pdf-business-icon="true"></svg>Approved status</span>`;
        root.querySelector<HTMLInputElement>("#title")!.value = "HTML PDF Türkçe Test çğıöşü";
        root.querySelector<HTMLTextAreaElement>("#description")!.value = "Bu alan HTML export testi için oluşturuldu.\nİkinci satır.";
        root.querySelectorAll<HTMLInputElement>("input[name='active']")[0].checked = true;
        root.querySelectorAll<HTMLInputElement>("input[name='status']")[2].checked = true;
        root.querySelector<HTMLInputElement>("#approved")!.checked = true;
        root.querySelector<HTMLSelectElement>("#priority")!.selectedIndex = 1;
        const original = root.innerHTML;

        const exact = cloneExportRoot(root, { includeImages: true, appearanceMode: "exactView" });
        expect(exact.querySelector("#title")).not.toBeNull();
        expect(exact.querySelector("textarea")).not.toBeNull();
        expect(exact.querySelectorAll("input[type='radio']")).toHaveLength(5);
        expect(exact.querySelector("button[aria-label='Open calendar']")).not.toBeNull();
        expect(exact.textContent).toContain("ACT Test html to pdf");

        const clean = cloneExportRoot(root, { includeImages: true, appearanceMode: "cleanReport" });
        expect(clean.textContent).toContain("Title");
        expect(clean.textContent).toContain("HTML PDF Türkçe Test çğıöşü");
        expect(clean.textContent).toContain("Description");
        expect(clean.textContent).toContain("Bu alan HTML export testi için oluşturuldu.\nİkinci satır.");
        expect(clean.textContent).toContain("Document date");
        expect(clean.textContent).toContain("9/11/2026");
        expect(clean.textContent).toContain("Active");
        expect(clean.textContent).toContain("Yes");
        expect(clean.textContent).not.toContain("No");
        expect(clean.textContent).toContain("Reddedildi");
        expect(clean.textContent).not.toContain("Taslak");
        expect(clean.textContent).not.toContain("Onaylandı");
        expect(clean.textContent).not.toContain("YesYes");
        expect(clean.textContent).not.toContain("ReddedildiReddedildi");
        expect(clean.querySelectorAll(".mx-radiogroup .html-pdf-static-value")).toHaveLength(2);
        expect(clean.textContent).toContain("High");
        expect(clean.querySelectorAll("input,textarea,select")).toHaveLength(0);
        expect(clean.querySelector("button[aria-label='Open calendar']")).toBeNull();
        expect(clean.textContent).not.toContain("ACT Test html to pdf");
        expect(clean.querySelector('[data-html-pdf-export-exclude="true"]')).toBeNull();
        expect(clean.querySelector(".rich-text")?.innerHTML).toContain("<strong>Kalın</strong>");
        expect(clean.querySelector("[data-html-pdf-business-icon='true']")).not.toBeNull();
        expect(root.innerHTML).toBe(original);
    });

    it("uses a canvas image and falls back safely when serialization fails", () => {
        const root = document.createElement("div");
        root.innerHTML = "<canvas width='10' height='20'></canvas>";
        HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValueOnce("data:image/png;base64,AA").mockImplementationOnce(() => { throw new DOMException("tainted", "SecurityError"); });
        expect(cloneExportRoot(root, { includeImages: true }).querySelector("img")?.src).toContain("data:image/png");
        expect(cloneExportRoot(root, { includeImages: true }).querySelector("canvas")?.dataset.canvasExport).toBe("unavailable");
    });

    it("ignores inaccessible stylesheets", () => {
        const inaccessible = { get cssRules(): CSSRuleList { throw new DOMException("blocked", "SecurityError"); } } as CSSStyleSheet;
        Object.defineProperty(document, "styleSheets", { configurable: true, value: [inaccessible] });
        expect(() => collectStyles(document)).not.toThrow();
    });

    it("preserves resolvable icon-font and background resources with absolute CSS URLs", () => {
        const sheet = { href: "https://app.example/theme/css/main.css", cssRules: [
            { cssText: "@font-face { font-family: icons; src: url('../fonts/icons.woff2'); }" },
            { cssText: ".company-icon { background-image: url(\"../images/company.svg\"); }" },
            { cssText: ".inline-icon { background-image: url(data:image/svg+xml;base64,AA); }" }
        ] } as unknown as CSSStyleSheet;
        Object.defineProperty(document, "styleSheets", { configurable: true, value: [sheet] });
        const css = collectStyles(document);
        expect(css).toContain("https://app.example/theme/fonts/icons.woff2");
        expect(css).toContain("https://app.example/theme/images/company.svg");
        expect(css).toContain("data:image/svg+xml;base64,AA");
    });

    it("preserves image and SVG resources with resolvable absolute URLs", () => {
        const root = document.createElement("div");
        root.innerHTML = '<img src="/images/company.png"><svg><image href="icons/status.svg"></image><use href="#local-symbol"></use></svg>';
        const clone = cloneExportRoot(root, { includeImages: true, appearanceMode: "exactView" });
        expect(clone.querySelector("img")?.src).toBe(new URL("/images/company.png", document.baseURI).href);
        expect(clone.querySelector("image")?.getAttribute("href")).toBe(new URL("icons/status.svg", document.baseURI).href);
        expect(clone.querySelector("use")?.getAttribute("href")).toBe("#local-symbol");
    });
});
