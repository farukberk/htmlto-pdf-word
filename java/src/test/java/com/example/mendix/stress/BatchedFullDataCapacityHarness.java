package com.example.mendix.stress;

import com.example.mendix.pdf.BatchMode;
import com.example.mendix.pdf.BatchedFullDataPdfRenderer;
import com.example.mendix.pdf.FullDataBatchOptions;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public final class BatchedFullDataCapacityHarness {
    private static final int[] SIZES = { 5_000, 12_500, 50_000 };
    private static final int BATCH_SIZE = 5_000;

    public static void main(String[] args) throws Exception {
        Path root = Path.of(args.length == 0 ? ".." : args[0]).toAbsolutePath().normalize();
        Path outputDirectory = root.resolve("dist");
        Files.createDirectories(outputDirectory);
        List<String> rows = new ArrayList<>();
        rows.add("| Records | Batches | Total | Final PDF | First | Middle/order | Last | Result |");
        rows.add("|---:|---:|---:|---:|---|---|---|---|");
        for (int size : SIZES) {
            Path pdf = outputDirectory.resolve("batched-full-data-" + size + ".pdf");
            Instant started = Instant.now();
            var renderer = new BatchedFullDataPdfRenderer();
            BatchedFullDataPdfRenderer.BatchRenderResult result;
            try (var output = Files.newOutputStream(pdf)) {
                result = renderer.render(template(), json(size),
                    new FullDataBatchOptions(BatchMode.AUTO, BATCH_SIZE, "records"), null, output);
            }
            String text;
            try (PDDocument document = PDDocument.load(pdf.toFile())) { text = new PDFTextStripper().getText(document); }
            boolean first = text.contains("STRESS-FIRST-ROW-000001");
            boolean last = text.contains("STRESS-LAST-ROW-" + six(size));
            boolean order = true;
            int previous = -1;
            for (int batch = 1; batch <= result.batchCount(); batch++) {
                int position = text.indexOf(String.format(Locale.ROOT, "BATCH-%03d", batch));
                order &= position > previous;
                previous = position;
            }
            long elapsed = Duration.between(started, Instant.now()).toMillis();
            boolean success = first && last && order;
            rows.add("| " + size + " | " + result.batchCount() + " | " + elapsed + " ms | " + Files.size(pdf) +
                " B | " + first + " | " + order + " | " + last + " | " + (success ? "PASS" : "FAIL") + " |");
            rows.add("");
            rows.add("Batch timings for " + size + ": " + result.batches());
            if (!success) throw new IllegalStateException("Merged PDF integrity failed for " + size + " records");
        }
        Files.writeString(outputDirectory.resolve("batched-full-data-results.md"),
            "# Batched FullData capacity results\n\n" + String.join("\n", rows) + "\n", StandardCharsets.UTF_8);
    }

    private static String template() {
        return "<!doctype html><html><head><meta charset='UTF-8'><style>@page{size:A4 landscape;margin:8mm}" +
            "body{font-family:Arial,sans-serif;font-size:8px}table{width:100%;border-collapse:collapse}" +
            "td{border:1px solid #aaa;padding:2px}tr{break-inside:avoid}</style></head><body>" +
            "<h1>BATCH-${_batch.number?string['000']}</h1><p>Türkçe çğıöşü</p><table><tbody>" +
            "<#list records as row><tr><td>${row.marker}</td><td>${row.name}</td><td>${row.description}</td></tr></#list>" +
            "</tbody></table></body></html>";
    }

    private static String json(int count) {
        StringBuilder json = new StringBuilder(count * 150).append("{\"title\":\"Batched stress\",\"records\":[");
        for (int index = 1; index <= count; index++) {
            if (index > 1) json.append(',');
            String marker = index == 1 ? "STRESS-FIRST-ROW-000001" : index == count ? "STRESS-LAST-ROW-" + six(count) : "ROW-" + six(index);
            json.append("{\"number\":").append(index).append(",\"marker\":\"").append(marker)
                .append("\",\"name\":\"Test Kaydı ").append(index)
                .append("\",\"description\":\"Açıklama Türkçe veri çğıöşü ").append(index).append("\"}");
        }
        return json.append("]}").toString();
    }

    private static String six(int value) { return String.format(Locale.ROOT, "%06d", value); }
}
