package com.example.mendix.docx;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.poi.xwpf.usermodel.*;

import java.io.*;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Safe data-lookup-only DOCX template processor. No expressions or scripts are evaluated. */
public final class TemplateDocxRenderer {
    private static final Pattern PLACEHOLDER = Pattern.compile("\\{\\{\\s*([A-Za-z0-9_.]+)\\s*}}");
    private static final Pattern REPEATING = Pattern.compile("\\{\\{\\s*([A-Za-z0-9_.]+)\\[\\]\\.([A-Za-z0-9_.]+)\\s*}}");
    private final ObjectMapper mapper = new ObjectMapper();

    public void render(InputStream template, String reportJson, OutputStream output) throws IOException {
        Objects.requireNonNull(template, "Template stream is required."); Objects.requireNonNull(output, "Output stream is required.");
        Map<String, Object> data;
        try { data = mapper.readValue(reportJson == null || reportJson.isBlank() ? "{}" : reportJson, new TypeReference<>() {}); }
        catch (Exception e) { throw new IllegalArgumentException("Report JSON is invalid.", e); }
        try (XWPFDocument doc = new XWPFDocument(template)) {
            processTables(doc, data);
            processParagraphs(doc.getParagraphs(), data);
            for (XWPFHeader header : doc.getHeaderList()) { processParagraphs(header.getParagraphs(), data); processTables(header, data); }
            for (XWPFFooter footer : doc.getFooterList()) { processParagraphs(footer.getParagraphs(), data); processTables(footer, data); }
            doc.write(output); output.flush();
        } catch (Exception e) { throw new DocxRenderingException("The Word template could not be read.", e); }
    }

    private void processTables(XWPFDocument doc, Map<String, Object> data) { for (XWPFTable table : doc.getTables()) processTable(table, data); }
    private void processTables(XWPFHeaderFooter part, Map<String, Object> data) { for (XWPFTable table : part.getTables()) processTable(table, data); }

    private void processTable(XWPFTable table, Map<String, Object> data) {
        for (int rowIndex = 0; rowIndex < table.getNumberOfRows(); rowIndex++) {
            XWPFTableRow prototype = table.getRow(rowIndex); String rowText = prototype.getTableCells().stream().map(XWPFTableCell::getText).reduce("", (a, b) -> a + " " + b); Matcher match = REPEATING.matcher(rowText);
            if (!match.find()) { processRow(prototype, data, null, null); continue; }
            String collectionPath = match.group(1); Object found = lookup(data, collectionPath);
            List<?> items = found instanceof List<?> list ? list : List.of();
            int insertAt = rowIndex;
            for (Object item : items) {
                XWPFTableRow row = table.insertNewTableRow(insertAt++);
                for (XWPFTableCell sourceCell : prototype.getTableCells()) {
                    XWPFTableCell targetCell = row.addNewTableCell();
                    targetCell.setText(sourceCell.getText());
                    if (sourceCell.getCTTc().isSetTcPr()) targetCell.getCTTc().setTcPr((org.openxmlformats.schemas.wordprocessingml.x2006.main.CTTcPr) sourceCell.getCTTc().getTcPr().copy());
                }
                processRow(row, data, collectionPath, item);
            }
            table.removeRow(insertAt); rowIndex = insertAt - 1;
        }
    }

    private void processRow(XWPFTableRow row, Map<String, Object> root, String collectionPath, Object item) {
        for (XWPFTableCell cell : row.getTableCells()) {
            processParagraphs(cell.getParagraphs(), root, collectionPath, item);
            for (XWPFTable nested : cell.getTables()) processTable(nested, root);
        }
    }

    private void processParagraphs(List<XWPFParagraph> paragraphs, Map<String, Object> data) { processParagraphs(paragraphs, data, null, null); }
    private void processParagraphs(List<XWPFParagraph> paragraphs, Map<String, Object> data, String collectionPath, Object item) {
        for (XWPFParagraph paragraph : paragraphs) {
            String original = paragraph.getText(); if (original == null || !original.contains("{{")) continue;
            String replaced = replace(original, data, collectionPath, item);
            if (replaced.equals(original)) continue;
            XWPFRun first = paragraph.getRuns().isEmpty() ? paragraph.createRun() : paragraph.getRuns().get(0);
            for (int i = paragraph.getRuns().size() - 1; i > 0; i--) paragraph.removeRun(i);
            first.setText(replaced, 0);
        }
    }

    private String replace(String text, Map<String, Object> root, String collectionPath, Object item) {
        Matcher matcher = PLACEHOLDER.matcher(text); StringBuffer result = new StringBuffer();
        while (matcher.find()) {
            String path = matcher.group(1); Object value = lookup(root, path);
            matcher.appendReplacement(result, Matcher.quoteReplacement(stringValue(value)));
        }
        matcher.appendTail(result);
        Matcher repeating = REPEATING.matcher(result.toString()); result = new StringBuffer();
        while (repeating.find()) {
            Object value = collectionPath != null && collectionPath.equals(repeating.group(1)) ? lookup(item, repeating.group(2)) : null;
            repeating.appendReplacement(result, Matcher.quoteReplacement(stringValue(value)));
        }
        repeating.appendTail(result); return result.toString();
    }

    @SuppressWarnings("unchecked")
    private static Object lookup(Object root, String path) {
        Object current = root;
        for (String segment : path.split("\\.")) {
            if (!(current instanceof Map<?, ?> map)) return null;
            current = map.get(segment); if (current == null) return null;
        }
        return current;
    }

    private static String stringValue(Object value) { return value == null ? "" : value instanceof Map || value instanceof List ? "" : String.valueOf(value); }
}
