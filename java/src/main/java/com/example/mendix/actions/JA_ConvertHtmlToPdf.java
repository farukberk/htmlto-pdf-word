package com.example.mendix.actions;

import com.example.mendix.pdf.PdfRenderers;
import java.io.IOException;
import java.io.OutputStream;

public final class JA_ConvertHtmlToPdf {
    private JA_ConvertHtmlToPdf() {}
    public static void execute(String html, String baseUri, OutputStream fileDocumentStream) throws IOException {
        PdfRenderers.preferred().render(html, baseUri, fileDocumentStream);
    }
}
