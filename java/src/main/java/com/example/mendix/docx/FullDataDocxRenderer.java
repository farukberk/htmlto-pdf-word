package com.example.mendix.docx;

import com.example.mendix.rendering.FreeMarkerHtmlRenderer;
import java.io.IOException;
import java.io.OutputStream;

public final class FullDataDocxRenderer {
    private final FreeMarkerHtmlRenderer htmlRenderer;
    private final DocxRenderer docxRenderer;

    public FullDataDocxRenderer() { this(new FreeMarkerHtmlRenderer(), new HtmlToDocxRenderer()); }
    FullDataDocxRenderer(FreeMarkerHtmlRenderer htmlRenderer, DocxRenderer docxRenderer) { this.htmlRenderer = htmlRenderer; this.docxRenderer = docxRenderer; }

    public void render(String templateContent, String reportJson, String baseUri, OutputStream output, DocxOrientation orientation) throws IOException {
        render(templateContent, reportJson, baseUri, output, DocxRenderOptions.defaults(orientation));
    }

    public void render(String templateContent, String reportJson, String baseUri, OutputStream output, DocxRenderOptions options) throws IOException {
        try {
            docxRenderer.render(htmlRenderer.render(templateContent, reportJson), baseUri, output, options);
        } catch (com.example.mendix.rendering.HtmlRenderingException e) {
            throw new DocxRenderingException("The FullData Word document could not be generated.", e);
        }
    }
}
