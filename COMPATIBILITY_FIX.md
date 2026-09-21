# Mendix 10.24.24 compatibility fix

## Diagnosis

The widget had been released with `@mendix/pluggable-widgets-tools` 11.13.0 and React 19, while the target Mendix line is 10.24. The npm package name was `htmlpdfexport`, so the generated widget identity was `HtmlPdfExport.htmlpdfexport.HtmlPdfExportView`; Studio Pro consequently reported the module/package identity as `HtmlPdfExport.htmlpdfexport`. This was not a valid alignment with the intended `HtmlPdfExport.HtmlPdfExportView` client-module identity.

## Applied compatibility changes

- Pinned `@mendix/pluggable-widgets-tools` to exactly 10.24.1.
- Added the Node `^22.18.0` engine declaration used by the Mendix 10.24 generator.
- Aligned React, React DOM, and their typings with the toolchain's React 18 peer requirements.
- Changed npm package name to `HtmlPdfExportView` while retaining `packagePath: HtmlPdfExport` and `widgetName: HtmlPdfExportView`.
- Corrected the widget ID to `HtmlPdfExport.HtmlPdfExportView.HtmlPdfExportView`.
- Kept the generator-standard runtime bundle path `HtmlPdfExport/htmlpdfexportview` in `package.xml`.
- Added the Mendix widget XML schema declaration used by the 10.24 generator.
- Regenerated `package-lock.json` without changing capture behavior or Java code.

## Verification

- `npm install`: passed.
- `npm test`: 5/5 passed.
- `npm run lint`: TypeScript passed.
- `npm run build`: passed using Node 22.18.0.
- `npm run release`: passed.
- MPK contains both `HtmlPdfExportView.js` and the ES-module bundle `HtmlPdfExportView.mjs`.
- The `.mjs` bundle contains native `import` and named `export` statements.
- MPK metadata and bundle directory agree on `HtmlPdfExport/htmlpdfexportview`.
- Final MPK SHA-256: `D6303DD59750C0C219585601E39F072005DD8D178F31E10841468A3EDB1CE615`.

No Java, FreeMarker, or PDF implementation was modified.
