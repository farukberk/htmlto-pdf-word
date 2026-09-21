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
        List<String> candidates = new ArrayList<>();
        addIfPresent(candidates, System.getProperty(SYSTEM_PROPERTY));
        addIfPresent(candidates, System.getenv(ENVIRONMENT_VARIABLE));

        if (System.getProperty("os.name", "").toLowerCase(Locale.ROOT).contains("win")) {
            addWindowsCandidates(candidates, System.getenv("ProgramFiles"));
            addWindowsCandidates(candidates, System.getenv("ProgramFiles(x86)"));
            addWindowsCandidates(candidates, System.getenv("LOCALAPPDATA"));
        } else {
            for (String name : List.of("google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge")) {
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

    private static void addWindowsCandidates(List<String> candidates, String root) {
        if (root == null || root.isBlank()) return;
        candidates.add(Path.of(root, "Microsoft", "Edge", "Application", "msedge.exe").toString());
        candidates.add(Path.of(root, "Google", "Chrome", "Application", "chrome.exe").toString());
        candidates.add(Path.of(root, "Chromium", "Application", "chrome.exe").toString());
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
