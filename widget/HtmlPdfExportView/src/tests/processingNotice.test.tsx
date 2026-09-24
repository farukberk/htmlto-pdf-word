import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HtmlPdfExportView } from "../HtmlPdfExportView";
import { HtmlPdfExportViewContainerProps } from "../../typings/HtmlPdfExportViewProps";

function props(overrides: Record<string, unknown> = {}): HtmlPdfExportViewContainerProps {
    return {
        name: "notice", class: "", content: <div style={{ width: 1200 }}>Corporate report value</div>,
        exportFormat: "pdf", appearanceMode: "exactView", exportScope: "currentView", pdfOrientation: "portrait",
        horizontalPageMarginMm: 10, verticalPageMarginMm: 12, smartPageBreaks: true,
        hideScrollbarsInExport: true, expandRenderedScrollContent: true, trimViewportWhitespace: true,
        showExportButton: true, autoExportOnLoad: false, autoExportDelayMs: 500,
        showProcessingNotice: true, processingNoticeTitle: "PDF'iniz hazırlanıyor...",
        processingNoticeMessage: "Lütfen işlem tamamlanana kadar bu sekmeden ayrılmayınız.",
        successNoticeTitle: "PDF hazırlandı", successNoticeMessage: "Dosyanız açılıyor...",
        errorNoticeTitle: "PDF oluşturulamadı", errorNoticeMessage: "Lütfen tekrar deneyiniz.",
        successNoticeDurationMs: 1500, openGeneratedFileAfterExport: false,
        buttonCaption: "Export PDF", showRuntimeAppearanceSelector: false, showRuntimeScopeSelector: false,
        showRuntimeOrientationSelector: false, showRuntimeFormatSelector: false,
        batchMode: "auto", batchSize: 5000, batchCollectionPath: "rows", fileName: "export.html",
        includeStyles: false, includeImages: true, debugMode: false, ...overrides
    } as HtmlPdfExportViewContainerProps;
}

describe("export processing notice", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        Object.defineProperty(window, "requestAnimationFrame", { configurable: true,
            value: (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 16) });
        Object.defineProperty(window, "cancelAnimationFrame", { configurable: true,
            value: (id: number) => window.clearTimeout(id) });
    });
    afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

    it("is hidden while idle and appears immediately for Auto Export including its delay", () => {
        const view = render(<HtmlPdfExportView {...props()} />);
        expect(screen.queryByText("PDF'iniz hazırlanıyor...")).toBeNull();
        view.rerender(<HtmlPdfExportView {...props({ autoExportOnLoad: true, autoExportDelayMs: 10_000,
            onExport: { canExecute: true, isExecuting: false, execute: vi.fn() } })} />);
        expect(screen.getByText("PDF'iniz hazırlanıyor...")).toBeTruthy();
        act(() => vi.advanceTimersByTime(9_000));
        expect(screen.getByText("PDF'iniz hazırlanıyor...")).toBeTruthy();
    });

    it("stays processing through capture and the Current View action", async () => {
        const execute = vi.fn(); const action = { canExecute: true, isExecuting: false, execute };
        const view = render(<HtmlPdfExportView {...props({ autoExportOnLoad: true, autoExportDelayMs: 0, onExport: action })} />);
        expect(screen.getByRole("status").textContent).toContain("hazırlanıyor");
        await act(async () => { await vi.advanceTimersByTimeAsync(100); });
        view.rerender(<HtmlPdfExportView {...props({ autoExportOnLoad: true, autoExportDelayMs: 0,
            onExport: { ...action, isExecuting: true } })} />);
        expect(screen.getByRole("status").textContent).toContain("hazırlanıyor");
    });

    it("stays processing through post-export then succeeds and auto-hides", () => {
        const generate = vi.fn(), open = vi.fn();
        const base = props({ openGeneratedFileAfterExport: true,
            onExport: { canExecute: true, isExecuting: false, execute: generate },
            onAfterExport: { canExecute: true, isExecuting: false, execute: open } });
        const view = render(<HtmlPdfExportView {...base} />);
        fireEvent.click(screen.getByRole("button", { name: "Export PDF" }));
        view.rerender(<HtmlPdfExportView {...props({ ...base, onExport: { ...base.onExport, isExecuting: true } })} />);
        view.rerender(<HtmlPdfExportView {...base} />); act(() => vi.advanceTimersByTime(0));
        expect(open).toHaveBeenCalledTimes(1);
        expect(screen.getByRole("status").textContent).toContain("hazırlanıyor");
        view.rerender(<HtmlPdfExportView {...props({ ...base, onAfterExport: { ...base.onAfterExport, isExecuting: true } })} />);
        view.rerender(<HtmlPdfExportView {...base} />);
        expect(screen.getByRole("status").textContent).toContain("PDF hazırlandı");
        act(() => vi.advanceTimersByTime(1_499)); expect(screen.getByText("PDF hazırlandı")).toBeTruthy();
        act(() => vi.advanceTimersByTime(1)); expect(screen.queryByText("PDF hazırlandı")).toBeNull();
    });

    it("starts immediately for manual export without Auto Export Delay", () => {
        const execute = vi.fn();
        render(<HtmlPdfExportView {...props({ autoExportDelayMs: 10_000,
            onExport: { canExecute: true, isExecuting: false, execute } })} />);
        fireEvent.click(screen.getByRole("button", { name: "Export PDF" }));
        expect(execute).toHaveBeenCalledTimes(1);
        expect(screen.getByRole("status").textContent).toContain("hazırlanıyor");
    });

    it("shows a generic error and a new export clears that state", () => {
        const failing = vi.fn(() => { throw new Error("private technical detail"); });
        const view = render(<HtmlPdfExportView {...props({ onExport: { canExecute: true, isExecuting: false, execute: failing } })} />);
        fireEvent.click(screen.getByRole("button", { name: "Export PDF" }));
        expect(screen.getByRole("status").textContent).toContain("PDF oluşturulamadı");
        expect(screen.getByRole("status").textContent).not.toContain("private technical detail");
        const execute = vi.fn();
        view.rerender(<HtmlPdfExportView {...props({ onExport: { canExecute: true, isExecuting: false, execute } })} />);
        fireEvent.click(screen.getByRole("button", { name: "Export PDF" }));
        expect(screen.getByRole("status").textContent).toContain("hazırlanıyor");
    });

    it("renders no notice when disabled", () => {
        render(<HtmlPdfExportView {...props({ showProcessingNotice: false,
            onExport: { canExecute: true, isExecuting: false, execute: vi.fn() } })} />);
        fireEvent.click(screen.getByRole("button", { name: "Export PDF" }));
        expect(document.querySelector(".html-pdf-export-notice")).toBeNull();
    });

    it.each(["exactView", "cleanReport"] as const)("excludes notice from %s HTML and source geometry", appearanceMode => {
        const execute = vi.fn();
        render(<HtmlPdfExportView {...props({ appearanceMode,
            onExport: { canExecute: true, isExecuting: false, execute } })} />);
        fireEvent.click(screen.getByRole("button", { name: "Export PDF" }));
        const html = execute.mock.calls[0][0].HtmlContent as string;
        expect(html).toContain("Corporate report value");
        expect(html).not.toContain("PDF'iniz hazırlanıyor");
        expect(html).not.toContain("html-pdf-export-notice");
        expect(html).toMatch(/data-html-pdf-source-width="\d+"/);
        expect(html).toContain("html-pdf-corporate-print");
    });

    it("cleans the success-hide timer on unmount", () => {
        const action = { canExecute: true, isExecuting: false, execute: vi.fn() };
        const view = render(<HtmlPdfExportView {...props({ onExport: action })} />);
        fireEvent.click(screen.getByRole("button", { name: "Export PDF" }));
        view.rerender(<HtmlPdfExportView {...props({ onExport: { ...action, isExecuting: true } })} />);
        view.rerender(<HtmlPdfExportView {...props({ onExport: action })} />);
        expect(screen.getByText("PDF hazırlandı")).toBeTruthy();
        view.unmount(); expect(vi.getTimerCount()).toBe(0);
    });
});
