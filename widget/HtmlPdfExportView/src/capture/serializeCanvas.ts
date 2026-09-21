export function serializeCanvas(source: Element, clone: Element): void {
    const sources = Array.from(source.querySelectorAll("canvas"));
    const clones = Array.from(clone.querySelectorAll("canvas"));
    sources.forEach((canvas, index) => {
        const clonedCanvas = clones[index];
        if (!clonedCanvas) return;
        try {
            const image = document.createElement("img");
            image.src = canvas.toDataURL("image/png");
            image.width = canvas.width;
            image.height = canvas.height;
            image.alt = canvas.getAttribute("aria-label") ?? "Canvas image";
            clonedCanvas.replaceWith(image);
        } catch {
            clonedCanvas.setAttribute("data-canvas-export", "unavailable");
        }
    });
}
