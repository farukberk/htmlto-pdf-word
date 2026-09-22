import { createElement, StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HtmlPdfExportView } from "../HtmlPdfExportView";
import { createExportKey } from "../export/exportKey";
import { HtmlPdfExportViewContainerProps } from "../../typings/HtmlPdfExportViewProps";

function props(overrides: Record<string, unknown> = {}): HtmlPdfExportViewContainerProps {
    return {
        name: "export", class: "", content: <div>Two-stage report</div>, exportFormat: "pdf",
        appearanceMode: "exactView", exportScope: "currentView", pdfOrientation: "portrait",
        showExportButton: true, autoExportOnLoad: false, autoExportDelayMs: 500,
        openGeneratedFileAfterExport: true, buttonCaption: "Export", showRuntimeAppearanceSelector: false,
        showRuntimeScopeSelector: false, showRuntimeOrientationSelector: false, showRuntimeFormatSelector: false,
        batchMode: "auto", batchSize: 5000, batchCollectionPath: "rows", fileName: "export.html",
        includeStyles: false, includeImages: true, debugMode: false, ...overrides
    } as HtmlPdfExportViewContainerProps;
}

describe("two-stage Current View PDF export", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        Object.defineProperty(window, "requestAnimationFrame", { configurable: true,
            value: (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 16) });
        Object.defineProperty(window, "cancelAnimationFrame", { configurable: true,
            value: (id: number) => window.clearTimeout(id) });
        Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:test") });
        vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    });
    afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

    it("creates unique non-empty keys with a safe fallback", () => {
        const first = createExportKey(), second = createExportKey();
        expect(first.length).toBeGreaterThan(10);
        expect(second).not.toBe(first);
    });

    it("waits for observed generation completion, then invokes post-export once with the same key", () => {
        const generate = vi.fn(), open = vi.fn();
        const post = { canExecute: true, isExecuting: false, execute: open };
        const base = props({ onExport: { canExecute: true, isExecuting: false, execute: generate }, onAfterExport: post });
        const view = render(<HtmlPdfExportView {...base} />);
        fireEvent.click(screen.getByRole("button", { name: "Export" }));
        const { HtmlContent, ExportKey } = generate.mock.calls[0][0];
        expect(HtmlContent).toContain("<!doctype html>");
        expect(HtmlContent).toContain("Two-stage report");
        expect(ExportKey).toEqual(expect.any(String));
        expect(ExportKey.length).toBeGreaterThan(10);
        expect(open).not.toHaveBeenCalled();
        act(() => vi.advanceTimersByTime(1_600));
        expect(open).not.toHaveBeenCalled();
        view.rerender(<HtmlPdfExportView {...props({ ...base, onExport: { ...base.onExport, isExecuting: true } })} />);
        expect(open).not.toHaveBeenCalled();
        view.rerender(<HtmlPdfExportView {...base} />);
        expect(open).not.toHaveBeenCalled();
        act(() => vi.advanceTimersByTime(0));
        expect(open).toHaveBeenCalledExactlyOnceWith({ ExportKey });
        view.rerender(<HtmlPdfExportView {...props({ ...base, onAfterExport: { ...post, isExecuting: true } })} />);
        view.rerender(<HtmlPdfExportView {...base} />);
        view.rerender(<HtmlPdfExportView {...base} />);
        act(() => vi.advanceTimersByTime(2_000));
        expect(generate).toHaveBeenCalledTimes(1);
        expect(open).toHaveBeenCalledTimes(1);
        expect(URL.createObjectURL).not.toHaveBeenCalled();
    });

    it("uses the same pipeline for auto export while leaving the manual button visible", () => {
        const generate = vi.fn(), open = vi.fn();
        const base = props({ autoExportOnLoad: true, autoExportDelayMs: 1000,
            onExport: { canExecute: true, isExecuting: false, execute: generate },
            onAfterExport: { canExecute: true, isExecuting: false, execute: open } });
        const view = render(<StrictMode><HtmlPdfExportView {...base} /></StrictMode>);
        expect(screen.getByRole("button", { name: "Export" })).toBeTruthy();
        act(() => vi.advanceTimersByTime(1015));
        expect(generate).not.toHaveBeenCalled();
        act(() => vi.advanceTimersByTime(1));
        expect(generate).toHaveBeenCalledTimes(1);
        view.rerender(<StrictMode><HtmlPdfExportView {...props({ ...base, onExport: { ...base.onExport, isExecuting: true } })} /></StrictMode>);
        view.rerender(<StrictMode><HtmlPdfExportView {...base} /></StrictMode>);
        act(() => vi.advanceTimersByTime(0));
        expect(open).toHaveBeenCalledExactlyOnceWith({ ExportKey: generate.mock.calls[0][0].ExportKey });
        view.rerender(<StrictMode><HtmlPdfExportView {...props({ ...base, onAfterExport: { ...base.onAfterExport, isExecuting: true } })} /></StrictMode>);
        view.rerender(<StrictMode><HtmlPdfExportView {...base} /></StrictMode>);
        act(() => vi.advanceTimersByTime(2_000));
        expect(generate).toHaveBeenCalledTimes(1);
        expect(open).toHaveBeenCalledTimes(1);
    });

    it("allows a new manual export with a new key after the first post action finishes", () => {
        const generate = vi.fn(), open = vi.fn();
        const base = props({ onExport: { canExecute: true, isExecuting: false, execute: generate },
            onAfterExport: { canExecute: true, isExecuting: false, execute: open } });
        const view = render(<HtmlPdfExportView {...base} />);
        fireEvent.click(screen.getByRole("button", { name: "Export" }));
        view.rerender(<HtmlPdfExportView {...props({ ...base, onExport: { ...base.onExport, isExecuting: true } })} />);
        view.rerender(<HtmlPdfExportView {...base} />);
        act(() => vi.advanceTimersByTime(0));
        view.rerender(<HtmlPdfExportView {...props({ ...base, onAfterExport: { ...base.onAfterExport, isExecuting: true } })} />);
        view.rerender(<HtmlPdfExportView {...base} />);
        fireEvent.click(screen.getByRole("button", { name: "Export" }));
        expect(generate).toHaveBeenCalledTimes(2);
        expect(generate.mock.calls[1][0].ExportKey).not.toBe(generate.mock.calls[0][0].ExportKey);
    });

    it("does not run the second action when disabled or generation never starts", () => {
        const generate = vi.fn(), open = vi.fn();
        const base = props({ openGeneratedFileAfterExport: false,
            onExport: { canExecute: true, isExecuting: false, execute: generate },
            onAfterExport: { canExecute: true, isExecuting: false, execute: open } });
        const view = render(<HtmlPdfExportView {...base} />);
        fireEvent.click(screen.getByRole("button", { name: "Export" }));
        expect(generate).toHaveBeenCalledTimes(1);
        act(() => vi.advanceTimersByTime(2_000));
        expect(open).not.toHaveBeenCalled();
        view.unmount();
        render(<HtmlPdfExportView {...props({ ...base, openGeneratedFileAfterExport: true })} />);
        fireEvent.click(screen.getByRole("button", { name: "Export" }));
        act(() => vi.advanceTimersByTime(30_000));
        expect(open).not.toHaveBeenCalled();
        expect(screen.getByRole("alert").textContent).toContain("did not start");
    });

    it("reports missing post action and generation unavailability without opening or downloading", () => {
        const generate = vi.fn();
        const view = render(<HtmlPdfExportView {...props({ onExport: { canExecute: true, isExecuting: false, execute: generate } })} />);
        fireEvent.click(screen.getByRole("button", { name: "Export" }));
        expect(screen.getByRole("alert").textContent).toContain("Open Generated File Action");
        expect(generate).not.toHaveBeenCalled();
        view.rerender(<HtmlPdfExportView {...props({ onExport: { canExecute: false, isExecuting: false, execute: generate },
            onAfterExport: { canExecute: true, isExecuting: false, execute: vi.fn() } })} />);
        fireEvent.click(screen.getByRole("button", { name: "Export" }));
        expect(generate).not.toHaveBeenCalled();
        expect(URL.createObjectURL).not.toHaveBeenCalled();
    });

    it("never opens after a synchronous generation failure", () => {
        const open = vi.fn();
        render(<HtmlPdfExportView {...props({ onExport: { canExecute: true, isExecuting: false,
            execute: () => { throw new Error("generation failed"); } },
        onAfterExport: { canExecute: true, isExecuting: false, execute: open } })} />);
        fireEvent.click(screen.getByRole("button", { name: "Export" }));
        act(() => vi.advanceTimersByTime(30_000));
        expect(open).not.toHaveBeenCalled();
        expect(screen.getByRole("alert")).toBeTruthy();
    });

    it("reports an unavailable second action without regenerating", () => {
        const generate = vi.fn(), open = vi.fn();
        const base = props({ onExport: { canExecute: true, isExecuting: false, execute: generate },
            onAfterExport: { canExecute: true, isExecuting: false, execute: open } });
        const view = render(<HtmlPdfExportView {...base} />);
        fireEvent.click(screen.getByRole("button", { name: "Export" }));
        view.rerender(<HtmlPdfExportView {...props({ ...base, onExport: { ...base.onExport, isExecuting: true } })} />);
        view.rerender(<HtmlPdfExportView {...props({ ...base, onAfterExport: { ...base.onAfterExport, canExecute: false } })} />);
        act(() => vi.advanceTimersByTime(0));
        expect(open).not.toHaveBeenCalled();
        expect(generate).toHaveBeenCalledTimes(1);
        expect(screen.getByRole("alert").textContent).toContain("not ready");
    });
});
