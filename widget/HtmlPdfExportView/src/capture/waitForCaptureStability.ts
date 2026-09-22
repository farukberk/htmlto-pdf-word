import { analyzeSourceGeometry } from "./exactViewGeometry";

export interface StabilityResult { stable: boolean; samples: number; }

function frame(): Promise<void> {
    return new Promise(resolve => window.requestAnimationFrame(() => resolve()));
}

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

export async function waitForCaptureStability(root: HTMLElement, maximumMilliseconds = 1500): Promise<StabilityResult> {
    const deadline = Date.now() + Math.max(0, maximumMilliseconds);
    await awaitFontsAndImages(root);
    await frame();
    await frame();
    let previous = sample(root);
    let samples = 1;
    while (Date.now() < deadline) {
        await frame();
        await frame();
        const current = sample(root);
        samples++;
        if (current === previous) return { stable: true, samples };
        previous = current;
    }
    return { stable: false, samples };
}
