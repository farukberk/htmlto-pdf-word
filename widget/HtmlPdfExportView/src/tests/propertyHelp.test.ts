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
            , "Export Format", "Show Runtime Format Selector", "Current View Word Export Action", "FullData Word Export Action",
            "Show Export Button", "Auto Export On Load", "Auto Export Delay (ms)",
            "Show Processing Notice", "Processing Notice Title", "Processing Notice Message",
            "Success Notice Title", "Success Notice Message", "Error Notice Title", "Error Notice Message",
            "Success Notice Duration (ms)",
            "Hide Scrollbars in Export", "Expand Rendered Scroll Content", "Trim Viewport Whitespace",
            "Horizontal Page Margin (mm)", "Vertical Page Margin (mm)", "Smart Page Breaks",
            "Open Generated File After Export", "Open Generated File Action"
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
        expect(defaultOf("showExportButton")).toBe("true");
        expect(defaultOf("autoExportOnLoad")).toBe("false");
        expect(defaultOf("autoExportDelayMs")).toBe("500");
        expect(defaultOf("showProcessingNotice")).toBe("true");
        expect(defaultOf("processingNoticeTitle")).toBe("PDF'iniz hazırlanıyor...");
        expect(defaultOf("successNoticeDurationMs")).toBe("1500");
        expect(defaultOf("openGeneratedFileAfterExport")).toBe("false");
        expect(defaultOf("hideScrollbarsInExport")).toBe("true");
        expect(defaultOf("expandRenderedScrollContent")).toBe("true");
        expect(defaultOf("trimViewportWhitespace")).toBe("true");
        expect(defaultOf("horizontalPageMarginMm")).toBe("10");
        expect(defaultOf("verticalPageMarginMm")).toBe("12");
        expect(defaultOf("smartPageBreaks")).toBe("true");
        expect(defaultOf("batchMode")).toBe("auto");
        expect(defaultOf("batchSize")).toBe("5000");
    });

    it("declares matching two-stage String action variables", () => {
        const xml = new DOMParser().parseFromString(widgetXml, "application/xml");
        const variables = (key: string) => Array.from(xml.querySelectorAll(`property[key='${key}'] actionVariable`))
            .map(node => [node.getAttribute("key"), node.getAttribute("type")]);
        expect(variables("onExport")).toEqual([["HtmlContent", "String"], ["ExportKey", "String"]]);
        expect(variables("onAfterExport")).toEqual([["ExportKey", "String"]]);
    });
});
