package com.example.mendix.demo;

import com.example.mendix.pdf.OpenHtmlToPdfRenderer;
import com.example.mendix.rendering.FreeMarkerHtmlRenderer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

public final class Demo {
    public static void main(String[] args) throws Exception {
        Path root = Path.of(args.length == 0 ? ".." : args[0]).toAbsolutePath().normalize();
        String template = Files.readString(root.resolve("samples/sample-template.ftl"), StandardCharsets.UTF_8);
        String json = Files.readString(root.resolve("samples/sample-data.json"), StandardCharsets.UTF_8);
        String html = new FreeMarkerHtmlRenderer().render(template, json);
        Path output = root.resolve("dist"); Files.createDirectories(output);
        Files.writeString(output.resolve("sample-report.html"), html, StandardCharsets.UTF_8);
        try (var stream = Files.newOutputStream(output.resolve("sample-report.pdf"))) { new OpenHtmlToPdfRenderer().render(html, root.toUri().toString(), stream); }
    }
}
