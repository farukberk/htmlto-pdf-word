import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { waitForRenderOpportunity } from "../capture/backgroundSafeScheduling";

describe("background-safe render scheduling", () => {
    const originalVisibility = Object.getOwnPropertyDescriptor(document, "visibilityState");
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => {
        vi.useRealTimers(); vi.restoreAllMocks();
        if (originalVisibility) Object.defineProperty(document, "visibilityState", originalVisibility);
    });

    it("resolves through a bounded timer when a hidden tab receives no RAF callback", async () => {
        Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
        const raf = vi.fn(); Object.defineProperty(window, "requestAnimationFrame", { configurable: true, value: raf });
        const pending = waitForRenderOpportunity(100);
        await vi.advanceTimersByTimeAsync(100);
        expect(await pending).toEqual(expect.objectContaining({ rafFallbackUsed: true }));
        expect(raf).not.toHaveBeenCalled();
    });

    it("uses RAF promptly in a visible tab and cancels the fallback", async () => {
        Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
        Object.defineProperty(window, "requestAnimationFrame", { configurable: true,
            value: (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 10) });
        Object.defineProperty(window, "cancelAnimationFrame", { configurable: true,
            value: (id: number) => window.clearTimeout(id) });
        const pending = waitForRenderOpportunity(100);
        await vi.advanceTimersByTimeAsync(10);
        expect(await pending).toEqual(expect.objectContaining({ rafFallbackUsed: false }));
        expect(vi.getTimerCount()).toBe(0);
    });

    it("resolves exactly once when RAF and fallback compete", async () => {
        Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
        let callback: FrameRequestCallback | undefined;
        Object.defineProperty(window, "requestAnimationFrame", { configurable: true,
            value: (value: FrameRequestCallback) => { callback = value; return 7; } });
        Object.defineProperty(window, "cancelAnimationFrame", { configurable: true, value: vi.fn() });
        const completed = vi.fn();
        const pending = waitForRenderOpportunity(100).then(value => { completed(value); return value; });
        callback!(0); await Promise.resolve();
        await vi.advanceTimersByTimeAsync(100);
        expect((await pending).rafFallbackUsed).toBe(false);
        expect(completed).toHaveBeenCalledTimes(1);
    });

    it("aborts pending fallback work without waiting for focus or visibility changes", async () => {
        Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
        const controller = new AbortController(); const pending = waitForRenderOpportunity(100, controller.signal);
        controller.abort();
        expect(await pending).toEqual(expect.objectContaining({ rafFallbackUsed: true }));
        expect(vi.getTimerCount()).toBe(0);
    });
});
