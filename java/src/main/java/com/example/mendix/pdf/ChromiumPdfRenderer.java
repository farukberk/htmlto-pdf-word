package com.example.mendix.pdf;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class ChromiumPdfRenderer implements PdfRenderer {
    private static final int MAX_DIAGNOSTIC_BYTES = 12 * 1024;
    private static final double CSS_PIXELS_PER_MM = 96.0 / 25.4;
    private static final Pattern SOURCE_WIDTH = metadataPattern("source-width");
    private static final Pattern SOURCE_HEIGHT = metadataPattern("source-height");
    private static final Pattern ORIENTATION = metadataPattern("orientation");
    private final Path executable;
    private final ChromiumPdfOptions options;

    public ChromiumPdfRenderer() { this(ChromiumExecutableLocator.requireExecutable(), ChromiumPdfOptions.defaults()); }

    public ChromiumPdfRenderer(Path executable, ChromiumPdfOptions options) {
        if (executable == null || !Files.isRegularFile(executable)) throw new IllegalArgumentException("Chromium executable does not exist: " + executable);
        this.executable = executable.toAbsolutePath();
        this.options = options == null ? ChromiumPdfOptions.defaults() : options;
    }

    public Path executable() { return executable; }

    @Override public void render(String html, String baseUri, OutputStream output) throws IOException {
        if (html == null || html.isBlank()) throw new IllegalArgumentException("HTML is required");
        if (output == null) throw new IllegalArgumentException("Output stream is required");

        Path workDirectory = Files.createTempDirectory("html-pdf-chromium-");
        Path htmlFile = workDirectory.resolve("document.html");
        Path pdfFile = workDirectory.resolve("document.pdf");
        Path profileDirectory = workDirectory.resolve("profile");
        Path stdoutFile = workDirectory.resolve("chromium.stdout.log");
        Path stderrFile = workDirectory.resolve("chromium.stderr.log");
        try {
            Files.createDirectory(profileDirectory);
            RenderPlan plan = planFor(html, options);
            Files.writeString(htmlFile, prepareHtml(html, baseUri, plan), StandardCharsets.UTF_8);

            Process process = new ProcessBuilder(command(htmlFile, pdfFile, profileDirectory, plan))
                .redirectOutput(stdoutFile.toFile())
                .redirectError(stderrFile.toFile())
                .start();
            boolean completed;
            try { completed = process.waitFor(options.processTimeoutSeconds(), TimeUnit.SECONDS); }
            catch (InterruptedException exception) {
                Thread.currentThread().interrupt();
                terminate(process);
                throw new IOException("Interrupted while waiting for Chromium PDF rendering: " +
                    diagnostics("interrupted", htmlFile, pdfFile, profileDirectory, stdoutFile, stderrFile), exception);
            }
            if (!completed) {
                terminate(process);
                throw new IOException("Chromium PDF rendering timed out after " + options.processTimeoutSeconds() +
                    " seconds: " + diagnostics("timeout", htmlFile, pdfFile, profileDirectory, stdoutFile, stderrFile));
            }
            if (process.exitValue() != 0) {
                throw new IOException("Chromium PDF rendering failed: " +
                    diagnostics("exit code " + process.exitValue(), htmlFile, pdfFile, profileDirectory, stdoutFile, stderrFile));
            }
            validatePdf(pdfFile, diagnostics("exit code 0", htmlFile, pdfFile, profileDirectory, stdoutFile, stderrFile));
            try (var input = Files.newInputStream(pdfFile)) { input.transferTo(output); }
            output.flush();
        } finally {
            deleteTree(workDirectory);
        }
    }

    List<String> command(Path htmlFile, Path pdfFile, Path profileDirectory, RenderPlan plan) {
        List<String> command = new ArrayList<>();
        command.add(executable.toString());
        command.add("--headless=new");
        command.add("--disable-gpu");
        command.add("--no-first-run");
        command.add("--no-default-browser-check");
        command.add("--window-size=" + plan.viewportWidth() + "," + plan.viewportHeight());
        command.add("--virtual-time-budget=" + options.loadWaitMilliseconds());
        command.add("--user-data-dir=" + profileDirectory);
        command.add("--no-pdf-header-footer");
        command.add("--print-to-pdf=" + pdfFile);
        command.add(htmlFile.toUri().toASCIIString());
        return command;
    }

    private String prepareHtml(String html, String baseUri, RenderPlan plan) {
        String orientation = plan.orientation() == ChromiumPdfOptions.Orientation.LANDSCAPE ? " landscape" : "";
        String color = options.printBackgrounds()
            ? "html,body,*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}" : "";
        String css = "<style>@page{size:" + options.pageSize() + orientation + ";margin:" +
            options.marginTopMm() + "mm " + options.marginRightMm() + "mm " + options.marginBottomMm() + "mm " + options.marginLeftMm() +
            "mm}@media print{html,body{width:" + plan.sourceWidth() + "px!important;min-width:" + plan.sourceWidth() +
            "px!important}html{zoom:" + plan.scale() + "}}" + color + "</style>";
        String base = baseUri == null || baseUri.isBlank() || html.toLowerCase(java.util.Locale.ROOT).contains("<base ")
            ? "" : "<base href=\"" + escapeAttribute(baseUri.trim()) + "\">";
        int headEnd = html.toLowerCase(java.util.Locale.ROOT).indexOf("</head>");
        return headEnd >= 0 ? html.substring(0, headEnd) + base + css + html.substring(headEnd) : base + css + html;
    }

    static RenderPlan planFor(String html, ChromiumPdfOptions options) {
        double sourceWidth = positiveMetadata(html, SOURCE_WIDTH, 1280);
        double sourceHeight = positiveMetadata(html, SOURCE_HEIGHT, 720);
        ChromiumPdfOptions.Orientation requested = orientationMetadata(html).orElse(options.orientation());
        double portraitWidth = printableWidthPx(false, options);
        double landscapeWidth = printableWidthPx(true, options);
        double portraitScale = Math.min(options.scale(), portraitWidth / sourceWidth);
        double landscapeScale = Math.min(options.scale(), landscapeWidth / sourceWidth);
        ChromiumPdfOptions.Orientation chosen = requested;
        if (requested == ChromiumPdfOptions.Orientation.AUTO) {
            boolean genuinelyWide = sourceWidth / sourceHeight > 1.1;
            chosen = genuinelyWide && sourceWidth > portraitWidth && landscapeScale >= portraitScale * 1.15
                ? ChromiumPdfOptions.Orientation.LANDSCAPE : ChromiumPdfOptions.Orientation.PORTRAIT;
        }
        double chosenScale = chosen == ChromiumPdfOptions.Orientation.LANDSCAPE ? landscapeScale : portraitScale;
        return new RenderPlan(sourceWidth, sourceHeight, requested, chosen, portraitScale, landscapeScale, chosenScale,
            clampViewport(sourceWidth), clampViewport(Math.max(720, sourceHeight)));
    }

    private static double printableWidthPx(boolean landscape, ChromiumPdfOptions options) {
        double pageWidthMm = landscape ? 297 : 210;
        return Math.max(1, pageWidthMm - options.marginLeftMm() - options.marginRightMm()) * CSS_PIXELS_PER_MM;
    }

    private static int clampViewport(double value) { return (int) Math.max(320, Math.min(32_000, Math.ceil(value))); }

    private static double positiveMetadata(String html, Pattern pattern, double fallback) {
        Matcher matcher = pattern.matcher(html);
        if (!matcher.find()) return fallback;
        try { double value = Double.parseDouble(matcher.group(1)); return value > 0 ? value : fallback; }
        catch (NumberFormatException ignored) { return fallback; }
    }

    private static java.util.Optional<ChromiumPdfOptions.Orientation> orientationMetadata(String html) {
        Matcher matcher = ORIENTATION.matcher(html);
        if (!matcher.find()) return java.util.Optional.empty();
        return switch (matcher.group(1).toLowerCase(Locale.ROOT)) {
            case "portrait" -> java.util.Optional.of(ChromiumPdfOptions.Orientation.PORTRAIT);
            case "landscape" -> java.util.Optional.of(ChromiumPdfOptions.Orientation.LANDSCAPE);
            case "auto" -> java.util.Optional.of(ChromiumPdfOptions.Orientation.AUTO);
            default -> java.util.Optional.empty();
        };
    }

    private static Pattern metadataPattern(String name) {
        return Pattern.compile("data-html-pdf-" + name + "\\s*=\\s*[\\\"']([^\\\"']+)[\\\"']", Pattern.CASE_INSENSITIVE);
    }

    record RenderPlan(double sourceWidth, double sourceHeight, ChromiumPdfOptions.Orientation requestedOrientation,
                      ChromiumPdfOptions.Orientation orientation, double portraitScale, double landscapeScale,
                      double scale, int viewportWidth, int viewportHeight) {}

    private static String escapeAttribute(String value) {
        return value.replace("&", "&amp;").replace("\"", "&quot;").replace("<", "&lt;");
    }

    private String diagnostics(String status, Path htmlFile, Path pdfFile, Path profileDirectory,
                               Path stdoutFile, Path stderrFile) {
        return status + "; browser=" + executable + "; input=" + htmlFile + "; output=" + pdfFile +
            "; profile=" + profileDirectory + "; stdout=" + abbreviatedOutput(stdoutFile) +
            "; stderr=" + abbreviatedOutput(stderrFile);
    }

    private static String abbreviatedOutput(Path file) {
        try (var input = Files.newInputStream(file)) {
            byte[] bytes = input.readNBytes(MAX_DIAGNOSTIC_BYTES + 1);
            String value = new String(bytes, 0, Math.min(bytes.length, MAX_DIAGNOSTIC_BYTES), StandardCharsets.UTF_8);
            return value + (bytes.length > MAX_DIAGNOSTIC_BYTES ? " [truncated]" : "");
        } catch (IOException exception) {
            return "[unavailable: " + exception.getMessage() + "]";
        }
    }

    static void validatePdf(Path pdfFile, String diagnostics) throws IOException {
        if (!Files.isRegularFile(pdfFile) || Files.size(pdfFile) == 0)
            throw new IOException("Chromium did not produce a non-empty PDF: " + diagnostics);
    }

    private static void terminate(Process process) {
        process.descendants().forEach(child -> child.destroy());
        process.destroy();
        try {
            if (!process.waitFor(2, TimeUnit.SECONDS)) {
                process.descendants().forEach(child -> child.destroyForcibly());
                process.destroyForcibly();
                process.waitFor(2, TimeUnit.SECONDS);
            }
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            process.descendants().forEach(child -> child.destroyForcibly());
            process.destroyForcibly();
        }
    }

    private static void deleteTree(Path root) {
        if (root == null || !Files.exists(root)) return;
        try (var paths = Files.walk(root)) {
            paths.sorted(Comparator.reverseOrder()).forEach(path -> { try { Files.deleteIfExists(path); } catch (IOException ignored) { } });
        } catch (IOException ignored) { }
    }
}
