package com.example.mendix.actions;

import com.example.mendix.docx.*;
import java.io.*;

/** Thin service entry point used from the Mendix Java Action USER CODE region. */
public final class JA_ConvertHtmlToDocx {
    private JA_ConvertHtmlToDocx() {}
    public static void execute(String html, String baseUri, OutputStream fileDocumentStream, String orientation) throws IOException {
        new HtmlToDocxRenderer().render(html, baseUri, fileDocumentStream, DocxOrientation.parse(orientation));
    }
}
