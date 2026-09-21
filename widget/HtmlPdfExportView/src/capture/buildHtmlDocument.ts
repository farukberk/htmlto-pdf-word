import { collectStyles } from "./collectStyles";

const PRINT_CSS = `@page { size: auto; margin: 12mm; }
thead { display: table-header-group; }
tfoot { display: table-footer-group; }
tr { break-inside: avoid; page-break-inside: avoid; }
.avoid-page-break { break-inside: avoid; page-break-inside: avoid; }
table { border-collapse: collapse; max-width: 100%; }
img, svg { max-width: 100%; }`;

export interface HtmlDocumentOptions { includeStyles: boolean; title?: string; }

export interface ExportMetadata {
    sourceWidth: number;
    sourceHeight: number;
    orientation: "portrait" | "landscape" | "auto";
}

export function buildHtmlDocument(root: Element, options: HtmlDocumentOptions, metadata?: ExportMetadata): string {
    const styles = options.includeStyles ? collectStyles() : "";
    const title = escapeHtml(options.title ?? document.title ?? "Export");
    const attributes = metadata
        ? ` data-html-pdf-source-width="${metadata.sourceWidth}" data-html-pdf-source-height="${metadata.sourceHeight}" data-html-pdf-orientation="${metadata.orientation}"`
        : "";
    return `<!doctype html>\n<html lang="tr"${attributes}><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><style>${styles}\n${PRINT_CSS}</style></head><body>${root.outerHTML}</body></html>`;
}

function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character] as string);
}
