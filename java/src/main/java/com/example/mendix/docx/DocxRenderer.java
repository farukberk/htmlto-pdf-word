package com.example.mendix.docx;

import java.io.IOException;
import java.io.OutputStream;

public interface DocxRenderer {
    void render(String html, String baseUri, OutputStream output, DocxOrientation orientation) throws IOException;
}
