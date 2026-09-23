export interface RenderOpportunityResult {
    rafFallbackUsed: boolean;
    durationMs: number;
}

export function waitForRenderOpportunity(timeoutMs = 100, signal?: AbortSignal): Promise<RenderOpportunityResult> {
    const started = Date.now();
    return new Promise(resolve => {
        let completed = false;
        let frame: number | undefined;
        let timer: number | undefined;
        const finish = (rafFallbackUsed: boolean): void => {
            if (completed) return;
            completed = true;
            if (timer !== undefined) window.clearTimeout(timer);
            if (frame !== undefined && typeof window.cancelAnimationFrame === "function") window.cancelAnimationFrame(frame);
            signal?.removeEventListener("abort", abort);
            resolve({ rafFallbackUsed, durationMs: Math.max(0, Date.now() - started) });
        };
        const abort = (): void => finish(true);
        if (signal?.aborted) { finish(true); return; }
        signal?.addEventListener("abort", abort, { once: true });
        timer = window.setTimeout(() => finish(true), Math.max(0, timeoutMs));
        if (document.visibilityState === "visible" && typeof window.requestAnimationFrame === "function") {
            frame = window.requestAnimationFrame(() => finish(false));
        }
    });
}
