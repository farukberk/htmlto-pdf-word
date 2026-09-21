package com.example.mendix.docx;

import org.apache.poi.xwpf.usermodel.*;
import org.junit.jupiter.api.Test;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

class WordStressTest {
    @Test void measuresProductionWordCapacity() throws Exception {
        int[] sizes = {100, 1_000, 5_000, 10_000, 25_000};
        Path dist = Path.of("..", "dist").toAbsolutePath().normalize(), outputs = dist.resolve("word-stress-output"); Files.createDirectories(outputs);
        List<String> csv = new ArrayList<>(List.of("rows,html_generation_ms,docx_render_ms,docx_bytes,heap_delta_bytes,success,first_marker,last_marker,table_rows"));
        List<String> md = new ArrayList<>(List.of("# Word stress test", "", "Java 21; Apache POI semantic DOCX; one editable table per document.", "", "| Rows | HTML ms | DOCX ms | Size bytes | Heap delta | Markers | Table rows |", "|---:|---:|---:|---:|---:|:---:|---:|"));
        for (int rows : sizes) {
            long heapBefore = usedHeap(), htmlStart = System.nanoTime(); String html = html(rows); long htmlMs = elapsed(htmlStart);
            ByteArrayOutputStream out = new ByteArrayOutputStream(); long renderStart = System.nanoTime(); new HtmlToDocxRenderer().render(html, "", out, DocxOrientation.PORTRAIT); long renderMs = elapsed(renderStart);
            byte[] bytes = out.toByteArray(); boolean first, last; int tableRows;
            try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(bytes))) {
                XWPFTable table = doc.getTables().get(0); tableRows = table.getNumberOfRows();
                first = table.getRow(1).getCell(0).getText().contains("ROW-000001"); last = table.getRow(rows).getCell(0).getText().contains(String.format("ROW-%06d", rows));
            }
            assertTrue(first && last); assertEquals(rows + 1, tableRows);
            long heapDelta = Math.max(0, usedHeap() - heapBefore);
            csv.add(String.join(",", String.valueOf(rows), String.valueOf(htmlMs), String.valueOf(renderMs), String.valueOf(bytes.length), String.valueOf(heapDelta), "PASS", String.valueOf(first), String.valueOf(last), String.valueOf(tableRows)));
            md.add("| " + rows + " | " + htmlMs + " | " + renderMs + " | " + bytes.length + " | " + heapDelta + " | PASS | " + tableRows + " |");
            if (rows == 100 || rows == 5_000 || rows == 25_000) Files.write(outputs.resolve(rows == 25_000 ? "word-largest-success.docx" : "word-" + rows + ".docx"), bytes);
        }
        Files.write(dist.resolve("word-stress-test-results.csv"), csv, StandardCharsets.UTF_8);
        Files.write(dist.resolve("word-stress-test-results.md"), md, StandardCharsets.UTF_8);
    }

    private static String html(int rows) {
        StringBuilder b = new StringBuilder(rows * 100).append("<h1>Capacity</h1><table><thead><tr><th>Marker</th><th>Name</th><th>Amount</th></tr></thead><tbody>");
        for (int i = 1; i <= rows; i++) b.append("<tr><td>").append(String.format("ROW-%06d", i)).append("</td><td>İstanbul Şişli ").append(i).append("</td><td>").append(i).append("</td></tr>");
        return b.append("</tbody></table>").toString();
    }
    private static long elapsed(long start) { return (System.nanoTime() - start) / 1_000_000; }
    private static long usedHeap() { Runtime r = Runtime.getRuntime(); return r.totalMemory() - r.freeMemory(); }
}
