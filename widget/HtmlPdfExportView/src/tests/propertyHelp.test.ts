import { describe, expect, it } from "vitest";
import widgetXml from "../HtmlPdfExportView.xml?raw";

describe("Studio Pro property help", () => {
    it("documents every exposed configurable property with a meaningful caption and description", () => {
        const xml = new DOMParser().parseFromString(widgetXml, "application/xml");
        expect(xml.querySelector("parsererror")).toBeNull();
        const properties = Array.from(xml.querySelectorAll("property"));
        expect(properties.length).toBeGreaterThan(0);
        for (const property of properties) {
            const key = property.getAttribute("key");
            const caption = property.querySelector(":scope > caption")?.textContent?.trim() ?? "";
            const description = property.querySelector(":scope > description")?.textContent?.trim() ?? "";
            expect(caption, `${key} caption`).not.toBe("");
            expect(caption.length, `${key} caption`).toBeGreaterThan(2);
            expect(description, `${key} description`).not.toBe("");
            expect(description.length, `${key} description`).toBeGreaterThan(20);
            expect(["value", "option", "setting", "configure this property"], `${key} placeholder help`)
                .not.toContain(description.toLowerCase());
        }
    });

    it("includes all release-candidate property captions", () => {
        const xml = new DOMParser().parseFromString(widgetXml, "application/xml");
        const captions = Array.from(xml.querySelectorAll("property > caption")).map(node => node.textContent?.trim());
        expect(captions).toEqual(expect.arrayContaining([
            "Appearance Mode", "Export Scope", "PDF Orientation",
            "Show Runtime Appearance Selector", "Show Runtime Scope Selector", "Show Runtime Orientation Selector",
            "FullData Export Action", "Report JSON", "Template Content",
            "Batch Mode", "Batch Size", "Batch Collection Path", "Debug Mode"
            , "Export Format", "Show Runtime Format Selector", "Current View Word Export Action", "FullData Word Export Action"
        ]));
    });

    it("keeps release-candidate defaults stable", () => {
        const xml = new DOMParser().parseFromString(widgetXml, "application/xml");
        const defaultOf = (key: string) => xml.querySelector(`property[key='${key}']`)?.getAttribute("defaultValue");
        expect(defaultOf("appearanceMode")).toBe("exactView");
        expect(defaultOf("exportFormat")).toBe("pdf");
        expect(defaultOf("exportScope")).toBe("currentView");
        expect(defaultOf("pdfOrientation")).toBe("portrait");
        expect(defaultOf("showRuntimeAppearanceSelector")).toBe("false");
        expect(defaultOf("showRuntimeScopeSelector")).toBe("false");
        expect(defaultOf("showRuntimeOrientationSelector")).toBe("true");
        expect(defaultOf("showRuntimeFormatSelector")).toBe("false");
        expect(defaultOf("buttonCaption")).toBe("Export PDF");
        expect(defaultOf("batchMode")).toBe("auto");
        expect(defaultOf("batchSize")).toBe("5000");
    });
});
