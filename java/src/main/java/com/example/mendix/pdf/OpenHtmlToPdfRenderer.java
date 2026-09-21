package com.example.mendix.pdf;

import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import org.jsoup.Jsoup;
import org.jsoup.helper.W3CDom;
import java.io.IOException;
import java.io.OutputStream;

public final class OpenHtmlToPdfRenderer implements PdfRenderer {
    @Override public void render(String html, String baseUri, OutputStream output) throws IOException {
        if (html == null || output == null) throw new IllegalArgumentException("HTML and output are required");
        try {
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.useFastMode();
            var parsedHtml = Jsoup.parse(html, baseUri == null ? "" : baseUri);
            builder.withW3cDocument(new W3CDom().fromJsoup(parsedHtml), baseUri);
            builder.toStream(output);
            builder.run();
        } catch (Exception e) { throw new IOException("HTML to PDF rendering failed: " + e.getMessage(), e); }
    }
}
