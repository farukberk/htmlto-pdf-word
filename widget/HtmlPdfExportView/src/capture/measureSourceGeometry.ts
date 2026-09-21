export interface SourceGeometry {
    width: number;
    height: number;
}

export const DEFAULT_PDF_ORIENTATION = "portrait" as const;

export function measureSourceGeometry(root: HTMLElement): SourceGeometry {
    const bounds = root.getBoundingClientRect();
    return {
        width: Math.max(1, Math.ceil(bounds.width), root.scrollWidth),
        height: Math.max(1, Math.ceil(bounds.height), root.scrollHeight)
    };
}
