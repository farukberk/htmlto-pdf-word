package com.example.mendix.pdf;

public final class PdfRenderers {
    public static final String RENDERER_PROPERTY = "htmlpdf.renderer";
    public static final String RENDERER_ENVIRONMENT = "HTML_PDF_RENDERER";

    private PdfRenderers() {}

    public static PdfRenderer preferred() {
        String configured = System.getProperty(RENDERER_PROPERTY);
        if (configured == null || configured.isBlank()) configured = System.getenv(RENDERER_ENVIRONMENT);
        if (configured != null && configured.equalsIgnoreCase("openhtml")) return new OpenHtmlToPdfRenderer();
        if (configured == null || configured.isBlank() || configured.equalsIgnoreCase("chromium")) return new ChromiumPdfRenderer();
        throw new IllegalArgumentException("Unsupported PDF renderer: " + configured + ". Use chromium or openhtml.");
    }
}
