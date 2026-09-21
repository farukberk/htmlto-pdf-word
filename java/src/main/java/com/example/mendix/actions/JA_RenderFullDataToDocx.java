package com.example.mendix.actions;

import com.example.mendix.docx.*;
import java.io.*;

/** Thin service entry point used from the Mendix Java Action USER CODE region. */
public final class JA_RenderFullDataToDocx {
    private JA_RenderFullDataToDocx() {}
    public static void execute(String templateContent, String reportJson, String baseUri, OutputStream fileDocumentStream, String orientation) throws IOException {
        new FullDataDocxRenderer().render(templateContent, reportJson, baseUri, fileDocumentStream, DocxOrientation.parse(orientation));
    }
}
