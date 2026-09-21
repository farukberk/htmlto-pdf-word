# Mendix HTML → PDF & Word export

Reusable export widget and Java renderers for Mendix Studio Pro 10.24.24 / Java 21.

## Export paths

- **Current View PDF:** captures only rendered content, including current form state and accessible Mendix/Atlas/custom CSS. Exact View targets visual fidelity; Clean Report removes interaction chrome while retaining captions and values. A local Chromium renderer produces the fixed-layout PDF.
- **Current View Word:** uses a clean, staticized capture and converts ARIA/Mendix grids into semantic HTML before Apache POI XWPF creates editable Word paragraphs, lists, images, hyperlinks, and native tables. Word is semantic, not pixel-perfect.
- **FullData PDF/Word:** application-supplied Report JSON and a FreeMarker HTML template provide All Filtered or Selected records independently of UI pagination. PDF supports configurable batching and PDFBox merge. Word creates one editable DOCX.
- **Corporate DOCX template:** replaces dotted-path placeholders and repeating table rows while retaining template headers, footers, styles, logos, and fields.

The widget identity remains `HtmlPdfExport.HtmlPdfExportView`; its Mendix toolchain is `@mendix/pluggable-widgets-tools@10.24.1`.

## Build

From `widget/HtmlPdfExportView`: `npm install`, `npm test`, `npm run build`, `npm run release`.

From `java` with Java 21: `mvn clean package`.

Release artifacts are `dist/HtmlPdfExport.HtmlPdfExportView.mpk` and `dist/html-pdf-export-1.0.0-all.jar`. Large generated PDF stress outputs are intentionally excluded from this source repository; benchmark summaries and representative Word outputs are included.

## Mendix integration

Copy the MPK to the app's `widgets` folder and the shaded JAR to `userlib`. Create Java Action declarations in Studio Pro, deploy for Eclipse, and put only the thin wrapper bodies into generated `BEGIN USER CODE` regions. Do not binary-edit the `.mpr`.

See [WORD_DOCX_INTEGRATION.md](WORD_DOCX_INTEGRATION.md) for Word Java Action signatures and template syntax, [WORD_STUDIOPRO_SMOKE_TEST.md](WORD_STUDIOPRO_SMOKE_TEST.md) for microflow mappings and real smoke checks, and [FULLDATA_BATCHING_INTEGRATION.md](FULLDATA_BATCHING_INTEGRATION.md) for PDF batching.

The latest real Current View Word smoke test revealed a div-based DataGrid2 flattening issue. The current release converts ARIA/Mendix grid structures to native editable Word tables, and automated widget/Java tests pass. A **new real Studio Pro smoke test of this final correction remains required** before declaring Word production-verified.
