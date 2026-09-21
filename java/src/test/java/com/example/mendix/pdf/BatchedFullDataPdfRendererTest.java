package com.example.mendix.pdf;

import static org.junit.jupiter.api.Assertions.*;
import com.example.mendix.rendering.HtmlRenderer;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class BatchedFullDataPdfRendererTest {
    @TempDir Path temp;

    @Test void rendersSequentialBatchesInOrderAndCleansTemporaryFiles() throws Exception {
        HtmlRenderer html = (template, json) -> json;
        PdfRenderer pdf = (value, base, output) -> output.write((marker(value) + "\n").getBytes(StandardCharsets.UTF_8));
        PdfMerger merger = (sources, destination) -> {
            try (var output = Files.newOutputStream(destination)) {
                for (Path source : sources) Files.copy(source, output);
            }
        };
        var renderer = new BatchedFullDataPdfRenderer(html, pdf, merger, new BatchJsonSplitter(), temp);
        var output = new ByteArrayOutputStream();
        var result = renderer.render("template", json(201), new FullDataBatchOptions(BatchMode.AUTO, 100, "items"), null, output);
        assertEquals(3, result.batchCount());
        assertEquals("BATCH-001\nBATCH-002\nBATCH-003\n", output.toString(StandardCharsets.UTF_8));
        try (var children = Files.list(temp)) { assertEquals(0, children.count()); }
    }

    @Test void middleBatchFailureIsAtomicAndCleansTemporaryFiles() throws Exception {
        AtomicInteger calls = new AtomicInteger();
        PdfRenderer pdf = (value, base, output) -> {
            if (calls.incrementAndGet() == 2) throw new IOException("fixture failure");
            output.write(1);
        };
        var renderer = new BatchedFullDataPdfRenderer((t, j) -> j, pdf, (s, d) -> fail(), new BatchJsonSplitter(), temp);
        var output = new ByteArrayOutputStream();
        var error = assertThrows(FullDataBatchException.class, () -> renderer.render("template", json(201),
            new FullDataBatchOptions(BatchMode.AUTO, 100, "items"), null, output));
        assertEquals("FullData PDF batch 2 of 3 failed during Chromium rendering.", error.getMessage());
        assertEquals(0, output.size());
        try (var children = Files.list(temp)) { assertEquals(0, children.count()); }
    }

    @Test void mergeFailureIsAtomicAndCleansTemporaryFiles() throws Exception {
        PdfRenderer pdf = (value, base, output) -> output.write(1);
        PdfMerger merger = (sources, destination) -> { throw new IOException("merge fixture failure"); };
        var renderer = new BatchedFullDataPdfRenderer((t, j) -> j, pdf, merger, new BatchJsonSplitter(), temp);
        var output = new ByteArrayOutputStream();
        var error = assertThrows(FullDataBatchException.class, () -> renderer.render("template", json(101),
            new FullDataBatchOptions(BatchMode.ALWAYS, 100, "items"), null, output));
        assertEquals("FullData PDF merge failed after 2 batches.", error.getMessage());
        assertEquals(0, output.size());
        try (var children = Files.list(temp)) { assertEquals(0, children.count()); }
    }

    @Test void singleBatchAvoidsMerge() throws Exception {
        AtomicInteger merges = new AtomicInteger();
        var renderer = new BatchedFullDataPdfRenderer((t, j) -> "single", (h, b, o) -> o.write(h.getBytes()),
            (s, d) -> merges.incrementAndGet(), new BatchJsonSplitter(), temp);
        var output = new ByteArrayOutputStream();
        var result = renderer.render("template", json(100), new FullDataBatchOptions(BatchMode.AUTO, 100, "items"), null, output);
        assertEquals(1, result.batchCount());
        assertEquals(0, merges.get());
        assertEquals("single", output.toString(StandardCharsets.UTF_8));
    }

    private static String marker(String json) {
        int number = json.indexOf("\"number\"");
        String tail = json.substring(number);
        int colon = tail.indexOf(':');
        int value = Integer.parseInt(tail.substring(colon + 1, tail.indexOf(',', colon)).trim());
        return String.format("BATCH-%03d", value);
    }
    private static String json(int count) {
        StringBuilder value = new StringBuilder("{\"items\":[");
        for (int i = 1; i <= count; i++) { if (i > 1) value.append(','); value.append("{\"id\":").append(i).append('}'); }
        return value.append("]}").toString();
    }
}
