package com.example.mendix.docx;

import java.io.IOException;
import java.io.OutputStream;

public interface DocxRenderer {
    void render(String html, String baseUri, OutputStream output, DocxOrientation orientation) throws IOException;

    default void render(String html, String baseUri, OutputStream output, DocxRenderOptions options) throws IOException {
        render(html, baseUri, output, options.orientation());
    }
}
