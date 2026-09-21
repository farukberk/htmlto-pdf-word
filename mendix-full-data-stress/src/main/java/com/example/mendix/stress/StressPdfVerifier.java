package com.example.mendix.stress;

import java.io.InputStream;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;

public final class StressPdfVerifier {
    private StressPdfVerifier() { }

    public static boolean containsMarkers(InputStream pdf, long rowCount) throws Exception {
        try (var document = PDDocument.load(pdf)) {
            String text = new PDFTextStripper().getText(document);
            return text.contains(StressMarkers.first()) && text.contains(StressMarkers.last(rowCount));
        }
    }
}
