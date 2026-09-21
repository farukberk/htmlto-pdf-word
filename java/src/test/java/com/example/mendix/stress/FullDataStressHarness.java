package com.example.mendix.stress;

import com.example.mendix.pdf.ChromiumExecutableLocator;
import com.example.mendix.pdf.ChromiumPdfOptions;
import com.example.mendix.pdf.ChromiumPdfRenderer;
import com.example.mendix.rendering.FreeMarkerHtmlRenderer;
import freemarker.core.TemplateClassResolver;
import freemarker.template.Configuration;
import freemarker.template.Template;
import freemarker.template.TemplateExceptionHandler;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;

import java.io.BufferedWriter;
import java.io.IOException;
import java.io.StringReader;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Duration;
import java.time.Instant;
import java.util.AbstractList;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public final class FullDataStressHarness {
    private static final int[] PHASE_1 = {100, 1_000, 5_000, 10_000, 25_000, 50_000};
    private static final int[] PHASE_2 = {100, 1_000, 5_000, 10_000, 25_000, 50_000};
    private static final long RENDER_TIMEOUT_SECONDS = Long.getLong("stress.timeout.seconds", 300L);
    private static final Runtime RUNTIME = Runtime.getRuntime();

    private final Path projectRoot;
    private final Path outputDirectory;
    private final Path representativeDirectory;
    private final String templateContent;
    private final ChromiumPdfRenderer pdfRenderer;
    private final List<Result> results = new ArrayList<>();

    private FullDataStressHarness(Path projectRoot) throws IOException {
        this.projectRoot = projectRoot;
        outputDirectory = projectRoot.resolve("dist");
        representativeDirectory = outputDirectory.resolve("stress-output");
        Files.createDirectories(representativeDirectory);
        try (var input = FullDataStressHarness.class.getResourceAsStream("/stress-template.ftl")) {
            if (input == null) throw new IOException("stress-template.ftl was not found");
            templateContent = new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }
        ChromiumPdfOptions defaults = ChromiumPdfOptions.defaults();
        ChromiumPdfOptions stressOptions = new ChromiumPdfOptions(defaults.pageSize(), defaults.orientation(), defaults.marginTopMm(),
            defaults.marginRightMm(), defaults.marginBottomMm(), defaults.marginLeftMm(), defaults.scale(), defaults.printBackgrounds(),
            defaults.loadWaitMilliseconds(), RENDER_TIMEOUT_SECONDS);
        pdfRenderer = new ChromiumPdfRenderer(ChromiumExecutableLocator.requireExecutable(), stressOptions);
    }

    public static void main(String[] args) throws Exception {
        Path root = Path.of(args.length == 0 ? ".." : args[0]).toAbsolutePath().normalize();
        FullDataStressHarness harness = new FullDataStressHarness(root);
        harness.runPhase("Phase 1", PHASE_1, false);
        harness.runPhase("Phase 2", PHASE_2, true);
        harness.writeReports();
    }

    private void runPhase(String phase, int[] sizes, boolean jsonPhase) throws IOException {
        Path latestSuccessful = null;
        int latestRows = 0;
        boolean stop = false;
        for (int rows : sizes) {
            if (stop) {
                results.add(Result.notRun(phase, rows, "Stopped after previous capacity-related failure"));
                continue;
            }
            Result result = execute(phase, rows, jsonPhase);
            results.add(result);
            if (result.success) {
                latestRows = rows;
                latestSuccessful = result.pdfPath;
                if (isRepresentative(rows)) retain(result.pdfPath, phase, rows);
            } else {
                stop = true;
            }
        }
        if (latestSuccessful != null && !isRepresentative(latestRows)) retain(latestSuccessful, phase, latestRows);
        cleanupTemporaryPdfs();
    }

    private Result execute(String phase, int rowCount, boolean jsonPhase) {
        Instant totalStart = Instant.now();
        Result result = new Result(phase, rowCount);
        result.memoryBeforeMB = usedHeapMB();
        String html = null;
        try {
            long start = System.nanoTime();
            String json = null;
            if (jsonPhase) json = buildJson(rowCount);
            result.dataBuildMs = elapsedMs(start);
            result.jsonSizeBytes = json == null ? 0 : json.getBytes(StandardCharsets.UTF_8).length;

            start = System.nanoTime();
            html = jsonPhase ? new FreeMarkerHtmlRenderer().render(templateContent, json) : renderLazyModel(rowCount);
            result.htmlRenderMs = elapsedMs(start);
            result.htmlSizeBytes = html.getBytes(StandardCharsets.UTF_8).length;
            result.memoryAfterHtmlMB = usedHeapMB();
            result.peakMemoryMB = Math.max(result.memoryBeforeMB, result.memoryAfterHtmlMB);
            verifyHtml(html, rowCount, result);

            result.pdfPath = Files.createTempFile(outputDirectory, fileStem(phase, rowCount) + "-", ".pdf");
            start = System.nanoTime();
            try (var output = Files.newOutputStream(result.pdfPath)) { pdfRenderer.render(html, null, output); }
            result.pdfRenderMs = elapsedMs(start);
            result.pdfSizeBytes = Files.size(result.pdfPath);
            result.memoryAfterPdfMB = usedHeapMB();
            result.peakMemoryMB = Math.max(result.peakMemoryMB, result.memoryAfterPdfMB);
            verifyPdf(result.pdfPath, rowCount, result);
            result.success = true;
        } catch (OutOfMemoryError error) {
            result.fail("MEMORY", error);
        } catch (Exception exception) {
            result.fail(result.failureStage == null ? "RENDER_OR_VALIDATE" : result.failureStage, exception);
        } finally {
            result.totalMs = Duration.between(totalStart, Instant.now()).toMillis();
            html = null;
            System.gc();
        }
        return result;
    }

    private String renderLazyModel(int rowCount) throws Exception {
        Configuration configuration = new Configuration(Configuration.VERSION_2_3_34);
        configuration.setDefaultEncoding("UTF-8");
        configuration.setTemplateExceptionHandler(TemplateExceptionHandler.RETHROW_HANDLER);
        configuration.setLogTemplateExceptions(false);
        configuration.setNewBuiltinClassResolver(TemplateClassResolver.ALLOWS_NOTHING_RESOLVER);
        configuration.setAPIBuiltinEnabled(false);
        Template template = new Template("stress-lazy", new StringReader(templateContent), configuration);
        Map<String, Object> model = Map.of("reportTitle", "FullData Stress Test", "rowCount", rowCount, "rows", new LazyRows(rowCount));
        try (StringWriter writer = new StringWriter(Math.max(16_384, rowCount * 180))) {
            template.process(model, writer);
            return writer.toString();
        }
    }

    private static String buildJson(int rowCount) {
        StringBuilder json = new StringBuilder(Math.max(16_384, rowCount * 210));
        json.append("{\"reportTitle\":\"FullData Stress Test\",\"rowCount\":").append(rowCount).append(",\"rows\":[");
        for (int index = 1; index <= rowCount; index++) {
            if (index > 1) json.append(',');
            Row row = row(index, rowCount);
            json.append("{\"number\":").append(index).append(",\"marker\":\"").append(row.marker)
                .append("\",\"name\":\"").append(row.name).append("\",\"description\":\"").append(row.description)
                .append("\",\"category\":\"").append(row.category).append("\",\"amount\":\"").append(row.amount)
                .append("\",\"date\":\"").append(row.date).append("\",\"status\":\"").append(row.status).append("\"}");
        }
        return json.append("]}").toString();
    }

    private static void verifyHtml(String html, int rows, Result result) {
        result.htmlFirstMarker = html.contains(firstMarker());
        result.htmlLastMarker = html.contains(lastMarker(rows));
        int count = 0, from = 0;
        while ((from = html.indexOf("data-stress-row=", from)) >= 0) { count++; from += 16; }
        if (!result.htmlFirstMarker || !result.htmlLastMarker || count != rows) {
            result.failureStage = "HTML_INTEGRITY";
            throw new IllegalStateException("HTML marker/row integrity failed: expected " + rows + ", found " + count);
        }
    }

    private static void verifyPdf(Path pdf, int rows, Result result) throws IOException {
        if (Files.size(pdf) <= 4) throw new IOException("PDF is empty");
        byte[] header = new byte[4];
        try (var input = Files.newInputStream(pdf)) {
            if (input.read(header) != 4) throw new IOException("PDF header is incomplete");
        }
        if (header[0] != '%' || header[1] != 'P' || header[2] != 'D' || header[3] != 'F') throw new IOException("Invalid PDF header");
        try (PDDocument document = PDDocument.load(pdf.toFile())) {
            if (document.getNumberOfPages() < 1) throw new IOException("PDF has no pages");
            String text = new PDFTextStripper().getText(document);
            result.pdfFirstMarker = text.contains(firstMarker());
            result.pdfLastMarker = text.contains(lastMarker(rows));
            if (!result.pdfFirstMarker || !result.pdfLastMarker) {
                result.failureStage = "PDF_INTEGRITY";
                throw new IOException("PDF marker integrity failed");
            }
        }
    }

    private void retain(Path source, String phase, int rows) throws IOException {
        Files.copy(source, representativeDirectory.resolve(fileStem(phase, rows) + ".pdf"), StandardCopyOption.REPLACE_EXISTING);
    }

    private void cleanupTemporaryPdfs() throws IOException {
        try (var files = Files.list(outputDirectory)) {
            for (Path file : files.filter(path -> path.getFileName().toString().startsWith("phase") && path.getFileName().toString().endsWith(".pdf")).toList()) Files.deleteIfExists(file);
        }
    }

    private void writeReports() throws IOException {
        Path csv = outputDirectory.resolve("stress-test-results.csv");
        try (BufferedWriter writer = Files.newBufferedWriter(csv, StandardCharsets.UTF_8)) {
            writer.write("phase,rowCount,dataBuildMs,jsonSizeBytes,htmlRenderMs,htmlSizeBytes,pdfRenderMs,totalMs,pdfSizeBytes,success,failureStage,exceptionClass,exceptionMessage,memoryBeforeMB,memoryAfterHtmlMB,memoryAfterPdfMB,peakMemoryMB,htmlFirstMarker,htmlLastMarker,pdfFirstMarker,pdfLastMarker\n");
            for (Result result : results) writer.write(result.csv() + "\n");
        }
        Path markdown = outputDirectory.resolve("stress-test-results.md");
        try (BufferedWriter writer = Files.newBufferedWriter(markdown, StandardCharsets.UTF_8)) {
            writer.write("# FullData stress-test results\n\nJVM memory values are sampled used-heap approximations, not process-wide peak RSS. Timeout per Chromium render: " + RENDER_TIMEOUT_SECONDS + " seconds.\n\n");
            writer.write("| Phase | Rows | Data Build | JSON Size | HTML Render | HTML Size | PDF Render | PDF Size | Total | JVM Memory before/HTML/PDF/peak MB | HTML First | HTML Last | PDF First | PDF Last | Result | Failure |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---|---|---|---|---|---|\n");
            for (Result result : results) writer.write(result.markdown() + "\n");
        }
    }

    private static Row row(int index, int rowCount) {
        String marker = index == 1 ? firstMarker() : index == rowCount ? lastMarker(rowCount) : "ROW-" + six(index);
        return new Row(index, marker, "Test Kaydı " + index, "Açıklama Türkçe veri çğıöşü " + index,
            "Category " + (char) ('A' + (index - 1) % 5), String.format(Locale.ROOT, "%.2f", 1250.50 + index), "2026-09-11", index % 4 == 0 ? "Pending" : "Active");
    }

    private static String firstMarker() { return "STRESS-FIRST-ROW-000001"; }
    private static String lastMarker(int rows) { return "STRESS-LAST-ROW-" + six(rows); }
    private static String six(int value) { return String.format(Locale.ROOT, "%06d", value); }
    private static boolean isRepresentative(int rows) { return rows == 100 || rows == 5_000 || rows == 25_000; }
    private static String fileStem(String phase, int rows) { return phase.toLowerCase(Locale.ROOT).replace(" ", "") + "-" + rows; }
    private static long elapsedMs(long start) { return Duration.ofNanos(System.nanoTime() - start).toMillis(); }
    private static long usedHeapMB() { return (RUNTIME.totalMemory() - RUNTIME.freeMemory()) / (1024 * 1024); }
    private record Row(int number, String marker, String name, String description, String category, String amount, String date, String status) {}
    private static final class LazyRows extends AbstractList<Map<String, Object>> {
        private final int size; LazyRows(int size) { this.size = size; }
        @Override public Map<String, Object> get(int index) {
            Row row = row(index + 1, size);
            Map<String, Object> value = new LinkedHashMap<>();
            value.put("number", row.number); value.put("marker", row.marker); value.put("name", row.name);
            value.put("description", row.description); value.put("category", row.category); value.put("amount", row.amount);
            value.put("date", row.date); value.put("status", row.status);
            return value;
        }
        @Override public int size() { return size; }
    }

    private static final class Result {
        final String phase; final int rows; boolean success; long dataBuildMs; long jsonSizeBytes; long htmlRenderMs; long htmlSizeBytes;
        long pdfRenderMs; long totalMs; long pdfSizeBytes; String failureStage; String exceptionClass; String exceptionMessage;
        long memoryBeforeMB; long memoryAfterHtmlMB; long memoryAfterPdfMB; long peakMemoryMB; boolean htmlFirstMarker; boolean htmlLastMarker;
        boolean pdfFirstMarker; boolean pdfLastMarker; Path pdfPath;
        Result(String phase, int rows) { this.phase = phase; this.rows = rows; }
        static Result notRun(String phase, int rows, String reason) { Result r = new Result(phase, rows); r.failureStage = "NOT_RUN"; r.exceptionMessage = reason; return r; }
        void fail(String stage, Throwable error) { success = false; failureStage = stage; exceptionClass = error.getClass().getName(); exceptionMessage = error.getMessage(); }
        boolean capacityFailure() { return "MEMORY".equals(failureStage) || exceptionClass != null && (exceptionClass.contains("Timeout") || exceptionMessage != null && exceptionMessage.toLowerCase(Locale.ROOT).contains("timed out")); }
        String csv() { return String.join(",", csvValue(phase), String.valueOf(rows), String.valueOf(dataBuildMs), String.valueOf(jsonSizeBytes), String.valueOf(htmlRenderMs), String.valueOf(htmlSizeBytes), String.valueOf(pdfRenderMs), String.valueOf(totalMs), String.valueOf(pdfSizeBytes), String.valueOf(success), csvValue(failureStage), csvValue(exceptionClass), csvValue(exceptionMessage), String.valueOf(memoryBeforeMB), String.valueOf(memoryAfterHtmlMB), String.valueOf(memoryAfterPdfMB), String.valueOf(peakMemoryMB), String.valueOf(htmlFirstMarker), String.valueOf(htmlLastMarker), String.valueOf(pdfFirstMarker), String.valueOf(pdfLastMarker)); }
        String markdown() { return "| " + phase + " | " + rows/1 + " | " + dataBuildMs + " ms | " + jsonSizeBytes + " B | " + htmlRenderMs + " ms | " + htmlSizeBytes + " B | " + pdfRenderMs + " ms | " + pdfSizeBytes + " B | " + totalMs + " ms | " + memoryBeforeMB + "/" + memoryAfterHtmlMB + "/" + memoryAfterPdfMB + "/" + peakMemoryMB + " | " + htmlFirstMarker + " | " + htmlLastMarker + " | " + pdfFirstMarker + " | " + pdfLastMarker + " | " + (success ? "PASS" : failureStage != null && failureStage.equals("NOT_RUN") ? "NOT RUN" : "FAIL") + " | " + safe(exceptionMessage) + " |"; }
        private static String csvValue(String value) { return "\"" + safe(value).replace("\"", "\"\"") + "\""; }
        private static String safe(String value) { return value == null ? "" : value.replace("|", "\\|").replace("\r", " ").replace("\n", " "); }
    }
}
