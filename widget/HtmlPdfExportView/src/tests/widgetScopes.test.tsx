import { createElement, StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HtmlPdfExportView } from "../HtmlPdfExportView";
import { HtmlPdfExportViewContainerProps } from "../../typings/HtmlPdfExportViewProps";

function baseProps(overrides: Record<string, unknown> = {}): HtmlPdfExportViewContainerProps {
    return {
        name: "export",
        class: "",
        content: <div data-testid="content">Visible report</div>,
        appearanceMode: "exactView",
        exportFormat: "pdf",
        pdfOrientation: "portrait",
        exportScope: "currentView",
        fileName: "export.html",
        showExportButton: true,
        autoExportOnLoad: false,
        autoExportDelayMs: 500,
        buttonCaption: "Export",
        showRuntimeAppearanceSelector: false,
        showRuntimeScopeSelector: false,
        showRuntimeOrientationSelector: false,
        showRuntimeFormatSelector: false,
        batchMode: "auto",
        batchSize: 5000,
        batchCollectionPath: "rows",
        includeStyles: false,
        includeImages: true,
        debugMode: false,
        ...overrides
    } as unknown as HtmlPdfExportViewContainerProps;
}

describe("HtmlPdfExportView scope integration", () => {
    afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
    beforeEach(() => {
        Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:test") });
        Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
        vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
        vi.spyOn(console, "error").mockImplementation(() => undefined);
    });

    it("uses the existing standalone CurrentView capture by default", () => {
        const execute = vi.fn();
        render(<HtmlPdfExportView {...baseProps({ onExport: { canExecute: true, isExecuting: false, execute } })} />);
        fireEvent.click(screen.getByRole("button", { name: "Export" }));
        const html = execute.mock.calls[0][0].HtmlContent as string;
        expect(html).toContain("<!doctype html>");
        expect(html).toContain("Visible report");
        expect(html).toContain('data-html-pdf-orientation="portrait"');
        expect(URL.createObjectURL).not.toHaveBeenCalled();
    });

    it.each(["allFiltered", "selected"])("does not fake %s with CurrentView HTML", scope => {
        const currentViewExecute = vi.fn();
        const fullDataExecute = vi.fn();
        render(<HtmlPdfExportView {...baseProps({
            exportScope: scope,
            onExport: { canExecute: true, isExecuting: false, execute: currentViewExecute },
            fullDataJson: { status: "available", value: '{"rows":[438]}' },
            fullDataTemplate: { status: "available", value: "Report template" },
            onFullDataExport: { canExecute: true, isExecuting: false, execute: fullDataExecute }
        })} />);
        fireEvent.click(screen.getByRole("button", { name: "Export" }));
        expect(currentViewExecute).not.toHaveBeenCalled();
        expect(URL.createObjectURL).not.toHaveBeenCalled();
        expect(fullDataExecute).toHaveBeenCalledWith({
            ReportJson: '{"rows":[438]}', TemplateContent: "Report template", ExportScope: scope,
            BatchMode: "auto", BatchSize: expect.anything(), BatchCollectionPath: "rows"
        });
    });

    it("shows a developer-friendly FullData configuration error", () => {
        render(<HtmlPdfExportView {...baseProps({ exportScope: "allFiltered" })} />);
        fireEvent.click(screen.getByRole("button", { name: "Export" }));
        expect(screen.getByRole("alert").textContent).toBe("FullData export is not configured for this scope.");
    });

    it("applies runtime appearance and orientation overrides and excludes its own UI", () => {
        const execute = vi.fn();
        render(<HtmlPdfExportView {...baseProps({
            content: <div><label htmlFor="runtime-title">Title</label><input id="runtime-title" defaultValue="Current value" /></div>,
            showRuntimeAppearanceSelector: true,
            showRuntimeOrientationSelector: true,
            onExport: { canExecute: true, isExecuting: false, execute }
        })} />);
        expect(screen.getByLabelText("Export appearance")).toBeTruthy();
        expect(screen.getByLabelText("PDF orientation")).toBeTruthy();
        fireEvent.change(screen.getByLabelText("Export appearance"), { target: { value: "cleanReport" } });
        fireEvent.change(screen.getByLabelText("PDF orientation"), { target: { value: "landscape" } });
        fireEvent.click(screen.getByRole("button", { name: "Export" }));
        const html = execute.mock.calls[0][0].HtmlContent as string;
        expect(html).toContain('data-html-pdf-orientation="landscape"');
        expect(html).toContain("Current value");
        expect(html).not.toContain('<input id="runtime-title"');
        expect(html).not.toContain("html-pdf-export-runtime-controls");
        expect(html).not.toContain("PDF orientation");
    });

    it.each(["portrait", "landscape", "auto"])("supports runtime %s orientation", selected => {
        const execute = vi.fn();
        render(<HtmlPdfExportView {...baseProps({
            showRuntimeOrientationSelector: true,
            onExport: { canExecute: true, isExecuting: false, execute }
        })} />);
        fireEvent.change(screen.getByLabelText("PDF orientation"), { target: { value: selected } });
        fireEvent.click(screen.getByRole("button", { name: "Export" }));
        expect(execute.mock.calls[0][0].HtmlContent).toContain(`data-html-pdf-orientation="${selected}"`);
    });

    it("uses a runtime scope override only through the generic FullData action", () => {
        const execute = vi.fn();
        render(<HtmlPdfExportView {...baseProps({
            showRuntimeScopeSelector: true,
            fullDataJson: { status: "available", value: '{"rows":[1]}' },
            fullDataTemplate: { status: "available", value: "template" },
            onFullDataExport: { canExecute: true, isExecuting: false, execute }
        })} />);
        fireEvent.change(screen.getByLabelText("Export scope"), { target: { value: "selected" } });
        fireEvent.click(screen.getByRole("button", { name: "Export" }));
        expect(execute).toHaveBeenCalledWith(expect.objectContaining({ ExportScope: "selected" }));
    });

    it("disables unavailable FullData scope options", () => {
        render(<HtmlPdfExportView {...baseProps({ showRuntimeScopeSelector: true })} />);
        const select = screen.getByLabelText("Export scope") as HTMLSelectElement;
        expect((select.querySelector("option[value='allFiltered']") as HTMLOptionElement).disabled).toBe(true);
        expect((select.querySelector("option[value='selected']") as HTMLOptionElement).disabled).toBe(true);
    });

    it("shows an accessible busy state and prevents repeated clicks", () => {
        const execute = vi.fn();
        render(<HtmlPdfExportView {...baseProps({
            exportScope: "allFiltered",
            fullDataJson: { status: "available", value: '{"rows":[1]}' },
            fullDataTemplate: { status: "available", value: "template" },
            onFullDataExport: { canExecute: true, isExecuting: false, execute }
        })} />);
        const button = screen.getByRole("button", { name: "Export" }) as HTMLButtonElement;
        fireEvent.click(button);
        fireEvent.click(button);
        expect(execute).toHaveBeenCalledTimes(1);
        expect(button.disabled).toBe(true);
        expect(button.textContent).toBe("Preparing large PDF...");
        expect(button.closest("[aria-busy='true']")).not.toBeNull();
    });

    it("maps invalid collection configuration to concise user-facing text", () => {
        render(<HtmlPdfExportView {...baseProps({
            exportScope: "allFiltered",
            fullDataJson: { status: "available", value: '{"data":{}}' },
            fullDataTemplate: { status: "available", value: "template" },
            onFullDataExport: { canExecute: true, isExecuting: false, execute: vi.fn() },
            batchCollectionPath: "data.rows"
        })} />);
        fireEvent.click(screen.getByRole("button", { name: "Export" }));
        expect(screen.getByRole("alert").textContent).toBe("The configured batch collection could not be found in the report data.");
    });

    it("exports Current View Word as cleaned editable HTML with orientation", () => {
        const execute = vi.fn();
        render(<HtmlPdfExportView {...baseProps({
            exportFormat: "word", buttonCaption: "Export PDF", content: <div><input defaultValue="Başarılı" /><button>Delete</button></div>,
            onWordExport: { canExecute: true, isExecuting: false, execute }
        })} />);
        fireEvent.click(screen.getByRole("button", { name: "Export Word" }));
        expect(execute).toHaveBeenCalledWith(expect.objectContaining({ Orientation: "portrait" }));
        expect(execute.mock.calls[0][0].HtmlContent).toContain("Başarılı");
        expect(execute.mock.calls[0][0].HtmlContent).not.toContain("Delete");
        expect(URL.createObjectURL).not.toHaveBeenCalled();
    });

    it("routes FullData Word without using the PDF action", () => {
        const wordExecute = vi.fn(), pdfExecute = vi.fn();
        render(<HtmlPdfExportView {...baseProps({ exportFormat: "word", buttonCaption: "Export PDF", exportScope: "selected",
            fullDataJson: { status: "available", value: '{"rows":[1]}' }, fullDataTemplate: { status: "available", value: "template" },
            onFullDataExport: { canExecute: true, isExecuting: false, execute: pdfExecute },
            onFullDataWordExport: { canExecute: true, isExecuting: false, execute: wordExecute }
        })} />);
        fireEvent.click(screen.getByRole("button", { name: "Export Word" }));
        expect(pdfExecute).not.toHaveBeenCalled();
        expect(wordExecute).toHaveBeenCalledWith({ ReportJson: '{"rows":[1]}', TemplateContent: "template", ExportScope: "selected", Orientation: "portrait" });
    });

    it("supports an accessible runtime format selector and Word busy state", () => {
        const execute = vi.fn();
        render(<HtmlPdfExportView {...baseProps({ showRuntimeFormatSelector: true, onWordExport: { canExecute: true, isExecuting: false, execute } })} />);
        fireEvent.change(screen.getByLabelText("Export format"), { target: { value: "word" } });
        const button = screen.getByRole("button", { name: "Export" }); fireEvent.click(button); fireEvent.click(button);
        expect(execute).toHaveBeenCalledTimes(1); expect(button.textContent).toBe("Generating Word document...");
        expect(button.closest("[data-html-pdf-export-exclude='true']")).not.toBeNull();
    });

    it("does not auto export by default and retains the manual control", () => {
        const execute = vi.fn();
        render(<HtmlPdfExportView {...baseProps({ onExport: { canExecute: true, isExecuting: false, execute } })} />);
        expect(execute).not.toHaveBeenCalled();
        expect(screen.getByRole("button", { name: "Export" })).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "Export" }));
        expect(execute).toHaveBeenCalledTimes(1);
        expect(URL.createObjectURL).not.toHaveBeenCalled();
    });

    it("honors the paint and configurable delay, fires once, and does not download HTML", () => {
        useAutoTimers();
        const execute = vi.fn();
        const props = baseProps({ autoExportOnLoad: true, autoExportDelayMs: 500,
            onExport: { canExecute: true, isExecuting: false, execute } });
        const view = render(<HtmlPdfExportView {...props} />);
        act(() => vi.advanceTimersByTime(515));
        expect(execute).not.toHaveBeenCalled();
        act(() => vi.advanceTimersByTime(1));
        expect(execute).toHaveBeenCalledTimes(1);
        expect(execute.mock.calls[0][0].HtmlContent).toContain("<!doctype html>");
        expect(execute.mock.calls[0][0].HtmlContent).toContain("Visible report");
        expect(URL.createObjectURL).not.toHaveBeenCalled();
        view.rerender(<HtmlPdfExportView {...baseProps({ ...props, content: <div>Updated report</div> })} />);
        act(() => vi.advanceTimersByTime(2_000));
        expect(execute).toHaveBeenCalledTimes(1);
    });

    it("hides only the export button while auto export still runs", () => {
        useAutoTimers();
        const execute = vi.fn();
        render(<HtmlPdfExportView {...baseProps({ autoExportOnLoad: true, autoExportDelayMs: 0,
            showExportButton: false, onExport: { canExecute: true, isExecuting: false, execute } })} />);
        expect(screen.queryByRole("button", { name: "Export" })).toBeNull();
        expect(screen.getByTestId("content").textContent).toBe("Visible report");
        act(() => vi.advanceTimersByTime(17));
        expect(execute).toHaveBeenCalledTimes(1);
    });

    it("waits for a temporarily unavailable action without retry polling", () => {
        useAutoTimers();
        const execute = vi.fn();
        const action = { canExecute: false, isExecuting: false, execute };
        const view = render(<HtmlPdfExportView {...baseProps({ autoExportOnLoad: true, autoExportDelayMs: 0, onExport: action })} />);
        act(() => vi.advanceTimersByTime(17));
        expect(execute).not.toHaveBeenCalled();
        view.rerender(<HtmlPdfExportView {...baseProps({ autoExportOnLoad: true, autoExportDelayMs: 0,
            onExport: { ...action, canExecute: true } })} />);
        expect(execute).toHaveBeenCalledTimes(1);
        act(() => vi.advanceTimersByTime(2_000));
        expect(execute).toHaveBeenCalledTimes(1);
    });

    it("shows a concise configuration error with hidden controls and never downloads HTML automatically", () => {
        useAutoTimers();
        render(<HtmlPdfExportView {...baseProps({ autoExportOnLoad: true, autoExportDelayMs: 0, showExportButton: false })} />);
        act(() => vi.advanceTimersByTime(17));
        expect(screen.getByRole("alert").textContent).toContain("Configure the Current View export action");
        expect(URL.createObjectURL).not.toHaveBeenCalled();
    });

    it("preserves the manual standalone HTML fallback only when no action is configured", () => {
        render(<HtmlPdfExportView {...baseProps()} />);
        fireEvent.click(screen.getByRole("button", { name: "Export" }));
        expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    });

    it("does not double export under repeated effects, but allows a fresh mount", () => {
        useAutoTimers();
        const execute = vi.fn();
        const props = baseProps({ autoExportOnLoad: true, autoExportDelayMs: 0,
            onExport: { canExecute: true, isExecuting: false, execute } });
        const view = render(<StrictMode><HtmlPdfExportView {...props} /></StrictMode>);
        act(() => vi.advanceTimersByTime(17));
        expect(execute).toHaveBeenCalledTimes(1);
        view.unmount();
        render(<HtmlPdfExportView {...props} />);
        act(() => vi.advanceTimersByTime(17));
        expect(execute).toHaveBeenCalledTimes(2);
    });

    it("keeps a manual click from causing a later automatic duplicate", () => {
        useAutoTimers();
        const execute = vi.fn();
        render(<HtmlPdfExportView {...baseProps({ autoExportOnLoad: true, autoExportDelayMs: 500,
            onExport: { canExecute: true, isExecuting: false, execute } })} />);
        fireEvent.click(screen.getByRole("button", { name: "Export" }));
        act(() => vi.advanceTimersByTime(2_000));
        expect(execute).toHaveBeenCalledTimes(1);
        expect(URL.createObjectURL).not.toHaveBeenCalled();
    });
});

function useAutoTimers(): void {
    vi.useFakeTimers();
    Object.defineProperty(window, "requestAnimationFrame", { configurable: true,
        value: (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 16) });
    Object.defineProperty(window, "cancelAnimationFrame", { configurable: true,
        value: (id: number) => window.clearTimeout(id) });
}
