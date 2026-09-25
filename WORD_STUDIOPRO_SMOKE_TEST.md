# Word / DOCX Studio Pro 10.24 smoke test

## Java actions

Create the actions below in module `HtmlPdfExport`. Keep generated code intact and call the shaded library only from `BEGIN USER CODE`.

- `JA_ConvertHtmlToDocx(Html:String, BaseUri:String, OutputFile:System.FileDocument, Orientation:String, HorizontalMarginMm:Integer, VerticalMarginMm:Integer, SmartPageBreaks:Boolean): Nothing`
- `JA_RenderFullDataToDocx(TemplateContent:String, ReportJson:String, BaseUri:String, OutputFile:System.FileDocument, Orientation:String, HorizontalMarginMm:Integer, VerticalMarginMm:Integer, SmartPageBreaks:Boolean): Nothing`
- `JA_RenderDocxTemplate(TemplateFile:System.FileDocument, ReportJson:String, OutputFile:System.FileDocument): Nothing`

Generate into a `ByteArrayOutputStream`, then store it with `Core.storeFileDocumentContent(context, outputFile, inputStream)`. Set a `.docx` name and commit the FileDocument before returning.

## Current View and two-stage open flow

1. Put `HtmlPdfExport.HtmlPdfExportView` around the report and set Export Format to Word, Scope to Current View.
2. Connect **Current View Word Export Action** to a microflow with the six generated action variables. Create a GeneratedExportFile, assign its unique `ExportKey`, call `JA_ConvertHtmlToDocx`, set the name to `Report.docx`, and commit.
3. Enable **Open Generated File After Export** and connect **Open Generated File Action**. Retrieve exactly one file by `ExportKey`, then use Download File. The widget calls this only after generation completes.
4. Test Exact View and Clean Report, Portrait/Landscape/Auto, manual Export Word, Auto Export On Load, and a background browser tab. Confirm one generation and one download.

## FullData and Selected

Connect **FullData Word Export Action** to a microflow that receives application-supplied ReportJson, TemplateContent, ExportScope and Orientation. Use All Filtered JSON for AllFiltered and selected-object JSON for Selected; do not query DataGrid internals. Call `JA_RenderFullDataToDocx`, store and download the FileDocument.

## Template mode

Create a DOCX FileDocument containing `{{path}}` placeholders and optional repeated table-row placeholders such as `{{rows[].name}}`. Call `JA_RenderDocxTemplate`. Verify headers, footers, styles and existing tables remain intact.

## Acceptance checklist

- Use a real DataGrid2 with five or more columns and multiple rendered rows; verify order, header count, cell values and editable Word cells.
- Include RichText headings, nested bullet/numbered lists, a hyperlink, PNG/JPEG image, Turkish Unicode and live form controls.
- Verify 10 mm left/right and 12 mm top/bottom defaults, repeated table headers, heading keep-with-next, and both page orientations.
- Open the downloaded DOCX in desktop Word. Search/copy text, edit a table cell, click the hyperlink, inspect the image, and ensure the file opens without repair warnings.
