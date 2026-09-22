export interface PdfVisualPolishOptions {
    hideScrollbarsInExport: boolean;
    expandRenderedScrollContent: boolean;
    trimViewportWhitespace: boolean;
}

export interface PdfVisualPolishResult { scrollbarsHidden: boolean; resizeGripsRemoved: number }

export function applyPdfVisualPolish(clone: HTMLElement, options: PdfVisualPolishOptions): PdfVisualPolishResult {
    clone.classList.add("html-pdf-visual-polish");
    let resizeGripsRemoved = 0;
    clone.querySelectorAll<HTMLTextAreaElement>("textarea").forEach(textarea => {
        textarea.style.resize = "none";
        resizeGripsRemoved++;
    });
    return { scrollbarsHidden: options.hideScrollbarsInExport, resizeGripsRemoved };
}

export function pdfVisualPolishCss(options: PdfVisualPolishOptions): string {
    const scrollbarCss = options.hideScrollbarsInExport ? `
html,body,.html-pdf-visual-polish,.html-pdf-visual-polish *{scrollbar-width:none!important;-ms-overflow-style:none!important}
html::-webkit-scrollbar,body::-webkit-scrollbar,.html-pdf-visual-polish::-webkit-scrollbar,.html-pdf-visual-polish *::-webkit-scrollbar,
.html-pdf-visual-polish *::-webkit-scrollbar-thumb,.html-pdf-visual-polish *::-webkit-scrollbar-track,
.html-pdf-visual-polish *::-webkit-scrollbar-corner,.html-pdf-visual-polish *::-webkit-resizer{
width:0!important;height:0!important;display:none!important}` : "";
    const documentFlow = options.trimViewportWhitespace
        ? "\nhtml,body{height:auto!important;min-height:0!important;overflow:visible!important}"
        : "";
    return `${scrollbarCss}${documentFlow}
.html-pdf-visual-polish textarea{resize:none!important;caret-color:transparent!important}
.html-pdf-visual-polish input{caret-color:transparent!important}
.html-pdf-visual-polish ::selection{background:transparent!important}`;
}
