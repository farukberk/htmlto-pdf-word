package com.example.mendix.pdf;

import static org.junit.jupiter.api.Assertions.*;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class PdfBoxPdfMergerTest {
    @TempDir Path temp;

    @Test void mergedPdfIsValidAndPreservesTextOrderAndTurkishUnicode() throws Exception {
        var renderer = new OpenHtmlToPdfRenderer();
        Path first = render(renderer, "BATCH-001 FIRST-MARKER çğıöşü", "first.pdf");
        Path second = render(renderer, "BATCH-002 MIDDLE-MARKER", "second.pdf");
        Path third = render(renderer, "BATCH-003 LAST-MARKER", "third.pdf");
        Path merged = temp.resolve("merged.pdf");
        new PdfBoxPdfMerger().merge(List.of(first, second, third), merged);
        try (PDDocument document = PDDocument.load(merged.toFile())) {
            assertEquals(3, document.getNumberOfPages());
            String text = new PDFTextStripper().getText(document);
            assertTrue(text.indexOf("BATCH-001") < text.indexOf("BATCH-002"));
            assertTrue(text.indexOf("BATCH-002") < text.indexOf("BATCH-003"));
            assertTrue(text.contains("FIRST-MARKER"));
            assertTrue(text.contains("LAST-MARKER"));
        }
    }

    private Path render(PdfRenderer renderer, String marker, String name) throws Exception {
        Path path = temp.resolve(name);
        String html = "<!doctype html><html><head><meta charset='UTF-8'></head><body><p>" + marker + "</p></body></html>";
        try (OutputStream output = Files.newOutputStream(path)) { renderer.render(html, null, output); }
        return path;
    }
}
