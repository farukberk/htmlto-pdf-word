package com.example.mendix.pdf;

import java.io.IOException;
import java.io.OutputStream;

public interface PdfRenderer {
    void render(String html, String baseUri, OutputStream output) throws IOException;
    default byte[] render(String html, String baseUri) throws IOException {
        var output = new java.io.ByteArrayOutputStream(Math.max(4096, html.length() / 2));
        render(html, baseUri, output);
        return output.toByteArray();
    }
}
