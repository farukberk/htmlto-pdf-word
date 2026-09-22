export interface SourceGeometry {
    width: number;
    height: number;
}

export const DEFAULT_PDF_ORIENTATION = "portrait" as const;

export function chooseAutoOrientation(width: number, height: number, portraitPrintableWidth: number,
                                      landscapePrintableWidth: number): "portrait" | "landscape" {
    const portraitScale = Math.min(1, portraitPrintableWidth / Math.max(1, width));
    const landscapeScale = Math.min(1, landscapePrintableWidth / Math.max(1, width));
    return width / Math.max(1, height) > 1.1 && width > portraitPrintableWidth &&
        landscapeScale >= portraitScale * 1.15 ? "landscape" : "portrait";
}

export function measureSourceGeometry(root: HTMLElement): SourceGeometry {
    const bounds = root.getBoundingClientRect();
    const metrics = analyzeSourceGeometry(root);
    const meaningfulWidth = metrics.meaningfulContentWidth;
    const scrollWidth = root.scrollWidth;
    const inflatedScrollWidth = meaningfulWidth > 0 && scrollWidth > meaningfulWidth * 1.3 &&
        bounds.width <= meaningfulWidth * 1.1;
    return {
        width: Math.max(1, Math.ceil(bounds.width), meaningfulWidth, inflatedScrollWidth ? 0 : scrollWidth),
        height: metrics.meaningfulContentHeight > 0 ? metrics.meaningfulContentHeight :
            Math.max(1, Math.ceil(bounds.height), root.scrollHeight)
    };
}
import { analyzeSourceGeometry } from "./exactViewGeometry";
