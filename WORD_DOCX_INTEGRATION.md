# Word / DOCX integration

## Architecture and dependency

Word export uses Apache POI XWPF 5.4.1 (Apache-2.0), packaged in the shaded Java 21 JAR. `HtmlToDocxRenderer` converts semantic HTML directly into editable WordprocessingML. It does not use or convert PDF. `FullDataDocxRenderer` runs the existing FreeMarker renderer and passes its semantic HTML to the DOCX renderer. `TemplateDocxRenderer` edits a supplied DOCX in place, preserving package parts such as headers, footers, images, styles, and fields.

Representable typography, emphasis, color, alignment, lists, hyperlinks, images, and tables are preserved. Browser-only layout such as CSS Grid, flex positioning, sticky state, and hover state degrades gracefully. Word Current View always uses the widget's safe Clean Report staticization, even when PDF Appearance is Exact View.

## Template contract

- Scalar lookup: `{{report.title}}`, `{{customer.name}}`. Missing or null values become an empty string.
- Repeating table row: put `{{rows[].name}}`, `{{rows[].description}}`, and similar values in one prototype row. The prefix before `[]` is a dotted path to a JSON array. The row is copied once per item and the prototype is removed.
- Placeholders split across Word runs are supported.
- Placeholders perform data lookup only. They cannot execute Java, SpEL, scripts, or expressions.

See `examples/word-template-example.docx` for a generic reusable template with demo logo, header, footer, page field, repeating table, and signature line.

## Required Studio Pro actions

The `.mpr` is intentionally not modified. Create these Java Actions in Studio Pro and deploy for Eclipse. Paste only the shown bodies into `BEGIN USER CODE` / `END USER CODE`.

### JA_ConvertHtmlToDocx

Parameters: `Html:String`, `BaseUri:String`, `OutputFile:System.FileDocument`, `Orientation:String`; return `Nothing`.

```java
if (OutputFile == null) throw new com.mendix.systemwideinterfaces.MendixRuntimeException("OutputFile is required for Word conversion.");
try (java.io.ByteArrayOutputStream bytes = new java.io.ByteArrayOutputStream()) {
    com.example.mendix.actions.JA_ConvertHtmlToDocx.execute(Html, BaseUri, bytes, Orientation);
    try (java.io.ByteArrayInputStream input = new java.io.ByteArrayInputStream(bytes.toByteArray())) {
        com.mendix.core.Core.storeFileDocumentContent(getContext(), OutputFile.getMendixObject(), input);
    }
    return null;
} catch (Exception e) {
    throw new com.mendix.systemwideinterfaces.MendixRuntimeException("Failed to generate and store the Word document.", e);
}
```

### JA_RenderFullDataToDocx

Parameters: `TemplateContent:String`, `ReportJson:String`, `BaseUri:String`, `OutputFile:System.FileDocument`, `Orientation:String`; return `Nothing`.

```java
if (OutputFile == null) throw new com.mendix.systemwideinterfaces.MendixRuntimeException("OutputFile is required for Word conversion.");
try (java.io.ByteArrayOutputStream bytes = new java.io.ByteArrayOutputStream()) {
    com.example.mendix.actions.JA_RenderFullDataToDocx.execute(TemplateContent, ReportJson, BaseUri, bytes, Orientation);
    try (java.io.ByteArrayInputStream input = new java.io.ByteArrayInputStream(bytes.toByteArray())) {
        com.mendix.core.Core.storeFileDocumentContent(getContext(), OutputFile.getMendixObject(), input);
    }
    return null;
} catch (Exception e) {
    throw new com.mendix.systemwideinterfaces.MendixRuntimeException("Failed to generate and store the FullData Word document.", e);
}
```

### JA_RenderDocxTemplate

Parameters: `TemplateFile:System.FileDocument`, `ReportJson:String`, `OutputFile:System.FileDocument`; return `Nothing`.

```java
if (TemplateFile == null || OutputFile == null) throw new com.mendix.systemwideinterfaces.MendixRuntimeException("TemplateFile and OutputFile are required.");
try (java.io.InputStream template = com.mendix.core.Core.getFileDocumentContent(getContext(), TemplateFile.getMendixObject());
     java.io.ByteArrayOutputStream bytes = new java.io.ByteArrayOutputStream()) {
    com.example.mendix.actions.JA_RenderDocxTemplate.execute(template, ReportJson, bytes);
    try (java.io.ByteArrayInputStream input = new java.io.ByteArrayInputStream(bytes.toByteArray())) {
        com.mendix.core.Core.storeFileDocumentContent(getContext(), OutputFile.getMendixObject(), input);
    }
    return null;
} catch (Exception e) {
    throw new com.mendix.systemwideinterfaces.MendixRuntimeException("Failed to read the Word template or store its result.", e);
}
```

Set output names to `.docx` in the calling microflows. The appropriate MIME type is `application/vnd.openxmlformats-officedocument.wordprocessingml.document` when the application model exposes MIME metadata. Map the widget's Current View Word action variables to `Html` and `Orientation`; map its FullData Word variables to `TemplateContent`, `ReportJson`, `ExportScope`, and `Orientation`.
