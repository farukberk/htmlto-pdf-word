# FullData batching integration for Mendix 10.24.24

Create one additive Java Action in Studio Pro. Existing actions remain unchanged.

## Java Action

Name: `JA_RenderFullDataToPdf`

Parameters, in order:

- `TemplateContent`: String
- `ReportJson`: String
- `BatchCollectionPath`: String
- `BatchMode`: String (`Off`, `Auto`, or `Always`)
- `BatchSize`: Integer
- `BaseUri`: String
- `OutputFile`: System.FileDocument

Return type: Nothing.

After **Deploy for Eclipse**, place only this body inside the generated `BEGIN USER CODE` region:

```java
if (OutputFile == null) {
    throw new com.mendix.systemwideinterfaces.MendixRuntimeException("OutputFile is required for FullData PDF export.");
}
java.nio.file.Path finalPdf = java.nio.file.Files.createTempFile("mendix-full-data-final-", ".pdf");
try {
    var options = new com.example.mendix.pdf.FullDataBatchOptions(
        com.example.mendix.pdf.BatchMode.from(BatchMode),
        BatchSize == null ? com.example.mendix.pdf.FullDataBatchOptions.DEFAULT_BATCH_SIZE : BatchSize,
        BatchCollectionPath);
    try (java.io.OutputStream output = java.nio.file.Files.newOutputStream(finalPdf)) {
        new com.example.mendix.pdf.BatchedFullDataPdfRenderer().render(
            TemplateContent, ReportJson, options, BaseUri, output);
    }
    try (java.io.InputStream input = java.nio.file.Files.newInputStream(finalPdf)) {
        com.mendix.core.Core.storeFileDocumentContent(
            getContext(), OutputFile.getMendixObject(), input);
    }
    return null;
} catch (Exception exception) {
    throw new com.mendix.systemwideinterfaces.MendixRuntimeException(
        "FullData PDF export failed: " + exception.getMessage(), exception);
} finally {
    try { java.nio.file.Files.deleteIfExists(finalPdf); } catch (java.io.IOException ignored) { }
}
```

The service and action keep batch and final PDFs on disk and stream only the completed final file into the Mendix FileDocument API.

Map the widget `onFullDataExport` action variables as follows:

- `TemplateContent` → Java Action `TemplateContent`
- `ReportJson` → Java Action `ReportJson`
- `ExportScope` remains available to the host microflow for validation/logging; it does not change batching behavior.
- Configure `BatchCollectionPath`, `BatchMode`, `BatchSize`, `BaseUri`, and create the target `GeneratedPdf` in the host microflow before calling the Java Action.

Path syntax is a dotted object-property path such as `rows`, `report.rows`, or `data.transactions`. Array indexes and JSONPath operators are intentionally unsupported. `_batch` at the JSON root is reserved and replaced in each copied batch. `index`, `startIndex`, and `endIndex` are zero-based; `endIndex` is inclusive and is `-1` for an empty collection. `number` is one-based.
