# Word Studio Pro integration and smoke test

## Required Java Action declarations

Create or correct these actions in Studio Pro, then select **App > Deploy for Eclipse**. Do not edit generated declarations by hand.

1. `JA_ConvertHtmlToDocx(Html:String, BaseUri:String, OutputFile:System.FileDocument, Orientation:String): Nothing`
2. `JA_RenderFullDataToDocx(TemplateContent:String, ReportJson:String, BaseUri:String, OutputFile:System.FileDocument, Orientation:String): Nothing`
3. `JA_RenderDocxTemplate(TemplateFile:System.FileDocument, ReportJson:String, OutputFile:System.FileDocument): Nothing`

The currently generated `JA_ConvertHtmlToDocx` has `TemplateFile, ReportJson, OutputFile`; that is the template action signature, not the required Current View conversion signature. Correct it in Studio Pro. After deployment, rerun the integration task so only the generated `BEGIN USER CODE` regions are populated.

## Current View Word

Create `ACT_CurrentViewToWord` with parameters `HtmlContent:String` and `Orientation:String`.

Flow:

1. Create a `System.FileDocument` specialization.
2. Set its name to `CurrentView-<timestamp>.docx`.
3. Call `JA_ConvertHtmlToDocx` with `Html = $HtmlContent`, `BaseUri = ''`, `OutputFile = created FileDocument`, and `Orientation = $Orientation`.
4. Commit the output object.
5. Download it with **Show file in browser = No**.

Map the widget's **Current View Word Export Action** variables `HtmlContent` and `Orientation` to this microflow.

## FullData Word

Create `ACT_FullDataToWord` with parameters `TemplateContent:String`, `ReportJson:String`, `ExportScope:String`, and `Orientation:String`.

Flow:

1. Create a `System.FileDocument` specialization named `FullData-<timestamp>.docx`.
2. Call `JA_RenderFullDataToDocx` with `TemplateContent = $TemplateContent`, `ReportJson = $ReportJson`, `BaseUri = ''`, `OutputFile = created FileDocument`, and `Orientation = $Orientation`.
3. Commit and download with **Show file in browser = No**.

`ExportScope` determines which dataset the host application supplied. The renderer does not need it. Map the widget's **FullData Word Export Action** variables to this microflow.

## DOCX template

Create `ACT_RenderWordTemplate` with parameters `TemplateFile:System.FileDocument` and `ReportJson:String`.

Flow:

1. Create an output `System.FileDocument` specialization named `TemplateReport-<timestamp>.docx`.
2. Call `JA_RenderDocxTemplate` with `TemplateFile = $TemplateFile`, `ReportJson = $ReportJson`, and `OutputFile = created FileDocument`.
3. Commit and download with **Show file in browser = No**.

Use `examples/word-template-example.docx` as the non-sensitive test template.

## Real smoke-test checklist

### Current View Word

- DOCX opens without a repair or corruption warning.
- Title, description, date, selected Active value, and selected Status value are correct and editable.
- DataGrid content is a native editable Word table.
- RichText headings, paragraphs, emphasis, lists, and links remain semantic.
- `ç Ç ğ Ğ ı İ ö Ö ş Ş ü Ü` render correctly.

### FullData Word

- The complete application-supplied dataset is exported.
- The Word table is editable.
- First and last expected records are present.
- Portrait, Landscape, and Auto work.

### Template Word

- Sample DOCX template loads without repair warnings.
- Scalar and split-run placeholders are replaced.
- Repeating table rows are populated.
- Header, footer, logo, and page-number field remain present.
