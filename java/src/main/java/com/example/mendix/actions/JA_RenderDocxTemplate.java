package com.example.mendix.actions;

import com.example.mendix.docx.TemplateDocxRenderer;
import java.io.*;

/** Thin service entry point used from the Mendix Java Action USER CODE region. */
public final class JA_RenderDocxTemplate {
    private JA_RenderDocxTemplate() {}
    public static void execute(InputStream templateFileStream, String reportJson, OutputStream outputFileStream) throws IOException {
        new TemplateDocxRenderer().render(templateFileStream, reportJson, outputFileStream);
    }
}
