package com.example.mendix.pdf;

import com.example.mendix.rendering.FreeMarkerHtmlRenderer;
import com.example.mendix.rendering.HtmlRenderer;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

public final class BatchedFullDataPdfRenderer {
    private final HtmlRenderer htmlRenderer;
    private final PdfRenderer pdfRenderer;
    private final PdfMerger pdfMerger;
    private final BatchJsonSplitter splitter;
    private final Path temporaryRoot;

    public BatchedFullDataPdfRenderer() {
        this(new FreeMarkerHtmlRenderer(), PdfRenderers.preferred(), new PdfBoxPdfMerger(), new BatchJsonSplitter(), null);
    }

    public BatchedFullDataPdfRenderer(HtmlRenderer htmlRenderer, PdfRenderer pdfRenderer, PdfMerger pdfMerger,
                                      BatchJsonSplitter splitter, Path temporaryRoot) {
        this.htmlRenderer = java.util.Objects.requireNonNull(htmlRenderer);
        this.pdfRenderer = java.util.Objects.requireNonNull(pdfRenderer);
        this.pdfMerger = java.util.Objects.requireNonNull(pdfMerger);
        this.splitter = java.util.Objects.requireNonNull(splitter);
        this.temporaryRoot = temporaryRoot;
    }

    public BatchRenderResult render(String templateContent, String reportJson, FullDataBatchOptions options,
                                    String baseUri, OutputStream output) throws IOException {
        if (templateContent == null || templateContent.isBlank()) throw new IllegalArgumentException("TemplateContent is required");
        if (output == null) throw new IllegalArgumentException("Output stream is required");
        BatchJsonSplitter.BatchPlan plan = splitter.plan(reportJson, options);
        Path workspace = temporaryRoot == null
            ? Files.createTempDirectory("html-pdf-full-data-")
            : Files.createTempDirectory(temporaryRoot, "html-pdf-full-data-");
        List<Path> batchPdfs = new ArrayList<>(plan.batchJson().size());
        List<BatchMetric> metrics = new ArrayList<>(plan.batchJson().size());
        Path finalPdf = workspace.resolve("final.pdf");
        try {
            for (int index = 0; index < plan.batchJson().size(); index++) {
                int number = index + 1;
                long started = System.nanoTime();
                String html;
                try { html = htmlRenderer.render(templateContent, plan.batchJson().get(index)); }
                catch (Exception exception) {
                    throw failure(number, plan.batchJson().size(), "FreeMarker rendering", exception);
                }
                Path batchPdf = workspace.resolve(String.format("batch-%06d.pdf", number));
                try (OutputStream batchOutput = Files.newOutputStream(batchPdf)) {
                    pdfRenderer.render(html, normalizeBaseUri(baseUri), batchOutput);
                } catch (Exception exception) {
                    throw failure(number, plan.batchJson().size(), "Chromium rendering", exception);
                }
                long duration = (System.nanoTime() - started) / 1_000_000L;
                metrics.add(new BatchMetric(number, duration, Files.size(batchPdf)));
                batchPdfs.add(batchPdf);
                html = null;
            }
            if (batchPdfs.size() == 1) Files.copy(batchPdfs.get(0), finalPdf);
            else {
                try { pdfMerger.merge(List.copyOf(batchPdfs), finalPdf); }
                catch (Exception exception) {
                    throw new FullDataBatchException("FullData PDF merge failed after " + batchPdfs.size() + " batches.", exception);
                }
            }
            try (var input = Files.newInputStream(finalPdf)) { input.transferTo(output); }
            output.flush();
            return new BatchRenderResult(plan.totalRecords(), plan.batchJson().size(), plan.batchingEnabled(),
                Files.size(finalPdf), List.copyOf(metrics));
        } finally {
            deleteTree(workspace);
        }
    }

    private static FullDataBatchException failure(int number, int count, String stage, Exception cause) {
        return new FullDataBatchException("FullData PDF batch " + number + " of " + count + " failed during " + stage + ".", cause);
    }

    private static String normalizeBaseUri(String value) { return value == null || value.isBlank() ? null : value.trim(); }

    private static void deleteTree(Path root) {
        if (root == null || !Files.exists(root)) return;
        try (var paths = Files.walk(root)) {
            paths.sorted(Comparator.reverseOrder()).forEach(path -> {
                try { Files.deleteIfExists(path); } catch (IOException ignored) { }
            });
        } catch (IOException ignored) { }
    }

    public record BatchMetric(int batchNumber, long durationMs, long pdfSizeBytes) { }
    public record BatchRenderResult(int totalRecords, int batchCount, boolean batchingEnabled,
                                    long finalPdfSizeBytes, List<BatchMetric> batches) { }
}
