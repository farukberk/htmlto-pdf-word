package com.example.mendix.pdf;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.apache.pdfbox.io.MemoryUsageSetting;
import org.apache.pdfbox.multipdf.PDFMergerUtility;

public final class PdfBoxPdfMerger implements PdfMerger {
    @Override public void merge(List<Path> sources, Path destination) throws IOException {
        if (sources == null || sources.isEmpty()) throw new IllegalArgumentException("At least one PDF is required");
        PDFMergerUtility merger = new PDFMergerUtility();
        for (Path source : sources) merger.addSource(source.toFile());
        try (var output = Files.newOutputStream(destination)) {
            merger.setDestinationStream(output);
            merger.mergeDocuments(MemoryUsageSetting.setupTempFileOnly());
        }
    }
}
