package com.example.mendix.pdf;

import java.io.IOException;
import java.nio.file.Path;
import java.util.List;

@FunctionalInterface
public interface PdfMerger {
    void merge(List<Path> sources, Path destination) throws IOException;
}
