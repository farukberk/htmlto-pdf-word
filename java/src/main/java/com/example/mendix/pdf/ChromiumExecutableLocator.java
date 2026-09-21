package com.example.mendix.pdf;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

public final class ChromiumExecutableLocator {
    public static final String SYSTEM_PROPERTY = "htmlpdf.chromium.executable";
    public static final String ENVIRONMENT_VARIABLE = "HTML_PDF_CHROMIUM_PATH";

    private ChromiumExecutableLocator() {}

    public static Optional<Path> locate() {
        return locate(System.getenv(ENVIRONMENT_VARIABLE), System.getProperty(SYSTEM_PROPERTY));
    }

    static Optional<Path> locate(String environmentOverride, String propertyOverride) {
        List<String> candidates = new ArrayList<>();
        addIfPresent(candidates, environmentOverride);
        addIfPresent(candidates, propertyOverride);

        if (System.getProperty("os.name", "").toLowerCase(Locale.ROOT).contains("win")) {
            candidates.addAll(windowsCandidates(System.getenv("ProgramFiles"), System.getenv("ProgramFiles(x86)"),
                System.getenv("LOCALAPPDATA")));
        } else {
            for (String name : List.of("microsoft-edge", "google-chrome", "google-chrome-stable", "chromium", "chromium-browser")) {
                findOnPath(name).ifPresent(path -> candidates.add(path.toString()));
            }
        }

        return candidates.stream().map(Path::of).map(Path::toAbsolutePath).filter(Files::isRegularFile).findFirst();
    }

    public static Path requireExecutable() {
        return locate().orElseThrow(() -> new IllegalStateException(
            "No local Chromium browser was found. Set system property " + SYSTEM_PROPERTY +
            " or environment variable " + ENVIRONMENT_VARIABLE + " to a Chrome, Edge, or Chromium executable."));
    }

    static List<String> windowsCandidates(String programFiles, String programFilesX86, String localAppData) {
        List<String> candidates = new ArrayList<>();
        List<String> roots = List.of(
            nonBlankOrDefault(programFiles, "C:\\Program Files"),
            nonBlankOrDefault(programFilesX86, "C:\\Program Files (x86)"));
        for (String root : roots) addWindowsCandidate(candidates, root, "Microsoft", "Edge", "Application", "msedge.exe");
        addWindowsCandidate(candidates, localAppData, "Microsoft", "Edge", "Application", "msedge.exe");
        for (String root : roots) addWindowsCandidate(candidates, root, "Google", "Chrome", "Application", "chrome.exe");
        addWindowsCandidate(candidates, localAppData, "Google", "Chrome", "Application", "chrome.exe");
        for (String root : roots) addWindowsCandidate(candidates, root, "Chromium", "Application", "chrome.exe");
        addWindowsCandidate(candidates, localAppData, "Chromium", "Application", "chrome.exe");
        return candidates;
    }

    private static String nonBlankOrDefault(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private static void addWindowsCandidate(List<String> candidates, String root, String... parts) {
        if (root == null || root.isBlank()) return;
        candidates.add(Path.of(root, parts).toString());
    }

    private static Optional<Path> findOnPath(String executable) {
        String pathValue = System.getenv("PATH");
        if (pathValue == null) return Optional.empty();
        for (String entry : pathValue.split(java.io.File.pathSeparator)) {
            Path candidate = Path.of(entry, executable);
            if (Files.isRegularFile(candidate) && Files.isExecutable(candidate)) return Optional.of(candidate);
        }
        return Optional.empty();
    }

    private static void addIfPresent(List<String> candidates, String candidate) {
        if (candidate != null && !candidate.isBlank()) candidates.add(candidate.trim());
    }
}
