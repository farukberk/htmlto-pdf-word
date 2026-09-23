import { analyzeSourceGeometry } from "./exactViewGeometry";
import { waitForRenderOpportunity } from "./backgroundSafeScheduling";

export interface StabilityResult { stable: boolean; samples: number; rafFallbackUsed: boolean;
    rafFallbackCount: number; layoutSettleDurationMs: number; cancelled: boolean; }

function pause(milliseconds: number): Promise<void> {
    return new Promise(resolve => window.setTimeout(resolve, milliseconds));
}

async function awaitFontsAndImages(root: HTMLElement): Promise<void> {
    if (document.fonts?.ready) await Promise.race([document.fonts.ready.then(() => undefined), pause(400)]);
    const pending = Array.from(root.querySelectorAll("img")).filter(image => !image.complete);
    if (pending.length > 0) {
        await Promise.race([Promise.all(pending.map(image => new Promise<void>(resolve => {
            image.addEventListener("load", () => resolve(), { once: true });
            image.addEventListener("error", () => resolve(), { once: true });
        }))), pause(350)]);
    }
}

function sample(root: HTMLElement): string {
    const metrics = analyzeSourceGeometry(root);
    return [metrics.captureRootClientWidth, metrics.meaningfulContentHeight, metrics.visibleTextElements,
        metrics.visibleCharacters, metrics.runtimeValueCount].join(":");
}

export async function waitForCaptureStability(root: HTMLElement, maximumMilliseconds = 1500,
                                              signal?: AbortSignal): Promise<StabilityResult> {
    const started = Date.now();
    const deadline = Date.now() + Math.max(0, maximumMilliseconds);
    await awaitFontsAndImages(root);
    let rafFallbackCount = 0;
    const frame = async (): Promise<void> => {
        const result = await waitForRenderOpportunity(100, signal);
        if (result.rafFallbackUsed) rafFallbackCount++;
    };
    await frame();
    await frame();
    if (signal?.aborted) return outcome(false, 0, rafFallbackCount, started, true);
    let previous = sample(root);
    let samples = 1;
    while (Date.now() < deadline) {
        await frame();
        await frame();
        if (signal?.aborted) return outcome(false, samples, rafFallbackCount, started, true);
        const current = sample(root);
        samples++;
        if (current === previous) return outcome(true, samples, rafFallbackCount, started, false);
        previous = current;
    }
    return outcome(false, samples, rafFallbackCount, started, false);
}

function outcome(stable: boolean, samples: number, rafFallbackCount: number, started: number,
                 cancelled: boolean): StabilityResult {
    return { stable, samples, rafFallbackUsed: rafFallbackCount > 0, rafFallbackCount,
        layoutSettleDurationMs: Math.max(0, Date.now() - started), cancelled };
}
