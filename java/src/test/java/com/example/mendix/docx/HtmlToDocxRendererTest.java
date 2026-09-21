package com.example.mendix.docx;

import org.apache.poi.xwpf.usermodel.*;
import org.junit.jupiter.api.Test;

import java.io.*;
import java.util.Base64;
import java.util.zip.ZipFile;

import static org.junit.jupiter.api.Assertions.*;

class HtmlToDocxRendererTest {
    private static final String TURKISH = "ç Ç ğ Ğ ı İ ö Ö ş Ş ü Ü Başarılı Çağrı İstanbul Şişli Özgür Güneş Reddedildi";
    private static final String PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z4xkAAAAASUVORK5CYII=";

    @Test void createsValidEditableSemanticDocx() throws Exception {
        String html = "<html><head><title>Demo</title></head><body><h2>Açıklama</h2><p>Bu işlem <strong>onaylanmıştır</strong> ve <em>düzenlenebilir</em> <u>metindir</u>.</p>" +
            "<ul><li>Madde 1</li><li>Madde 2</li></ul><ol><li>Bir</li></ol><p><a href='https://example.com'>Bağlantı</a></p>" +
            "<table><thead><tr><th>Name</th><th>Amount</th></tr></thead><tbody><tr><td>İstanbul</td><td>42</td></tr></tbody></table>" +
            "<img width='16' height='16' src='data:image/png;base64," + PNG + "'/><p>" + TURKISH + "</p></body></html>";
        byte[] bytes = render(html, DocxOrientation.PORTRAIT);
        File file = File.createTempFile("semantic-", ".docx"); try (FileOutputStream out = new FileOutputStream(file)) { out.write(bytes); }
        try (ZipFile zip = new ZipFile(file)) { assertNotNull(zip.getEntry("[Content_Types].xml")); assertNotNull(zip.getEntry("word/document.xml")); }
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(bytes))) {
            String text = doc.getParagraphs().stream().map(XWPFParagraph::getText).reduce("", (a,b) -> a + " " + b);
            assertTrue(text.contains("Açıklama")); assertTrue(text.contains(TURKISH));
            assertEquals("Heading2", doc.getParagraphs().get(0).getStyle());
            assertTrue(doc.getParagraphs().stream().flatMap(p -> p.getRuns().stream()).anyMatch(XWPFRun::isBold));
            assertTrue(doc.getParagraphs().stream().flatMap(p -> p.getRuns().stream()).anyMatch(XWPFRun::isItalic));
            assertTrue(doc.getParagraphs().stream().anyMatch(p -> p.getNumID() != null));
            assertEquals(1, doc.getTables().size()); assertEquals(2, doc.getTables().get(0).getNumberOfRows());
            assertFalse(doc.getAllPictures().isEmpty());
            boolean hyperlink = false; for (var relationship : doc.getPackagePart().getRelationships()) if (relationship.getRelationshipType().contains("hyperlink")) hyperlink = true;
            assertTrue(hyperlink);
        } finally { assertTrue(file.delete()); }
    }

    @Test void supportsPortraitLandscapeAndAuto() throws Exception {
        assertEquals("portrait", orientation(render("<p>x</p>", DocxOrientation.PORTRAIT)));
        assertEquals("landscape", orientation(render("<p>x</p>", DocxOrientation.LANDSCAPE)));
        assertEquals("landscape", orientation(render("<table><tr><td>1</td><td>2</td><td>3</td><td>4</td><td>5</td><td>6</td><td>7</td></tr></table>", DocxOrientation.AUTO)));
    }

    @Test void rendersFullDataThroughFreeMarker() throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        new FullDataDocxRenderer().render("<h1>${title}</h1><table><#list rows as row><tr><td>${row.name}</td></tr></#list></table>", "{\"title\":\"AllFiltered\",\"rows\":[{\"name\":\"FIRST\"},{\"name\":\"LAST\"}]}", "", out, DocxOrientation.PORTRAIT);
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(out.toByteArray()))) {
            assertTrue(doc.getParagraphs().get(0).getText().contains("AllFiltered"));
            assertEquals("FIRST", doc.getTables().get(0).getRow(0).getCell(0).getText());
            assertEquals("LAST", doc.getTables().get(0).getRow(1).getCell(0).getText());
        }
    }

    @Test void rendersNormalizedMendixGridAsNativeWordTable() throws Exception {
        String html = "<table data-html-pdf-word-grid='true'><colgroup><col style='width:20%'><col style='width:40%'><col style='width:10%'><col style='width:20%'><col style='width:10%'></colgroup>" +
            "<thead><tr><th>Name</th><th>Description</th><th>Amount</th><th>Row date</th><th>Active</th></tr></thead><tbody>" +
            wordRow("Test Kaydı 1", "1250.5") + wordRow("Test Kaydı 2", "2500") + wordRow("Test Kaydı 3", "9999.99") + "</tbody></table>";
        byte[] bytes = render(html, DocxOrientation.PORTRAIT);
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(bytes))) {
            assertEquals(1, doc.getTables().size()); XWPFTable table = doc.getTables().get(0);
            assertEquals(4, table.getNumberOfRows());
            assertTrue(table.getRows().stream().allMatch(row -> row.getTableCells().size() == 5));
            assertTrue(table.getRow(0).isRepeatHeader());
            assertEquals("Name", table.getRow(0).getCell(0).getText()); assertEquals("Active", table.getRow(0).getCell(4).getText());
            assertEquals("Test Kaydı 1", table.getRow(1).getCell(0).getText()); assertEquals("1250.5", table.getRow(1).getCell(2).getText());
            assertEquals("Test Kaydı 3", table.getRow(3).getCell(0).getText()); assertEquals("Yes", table.getRow(3).getCell(4).getText());
            String xml = doc.getDocument().xmlText(); assertTrue(xml.contains("w:tbl")); assertTrue(xml.contains("Test Kaydı 1"));
        }
    }

    private static String wordRow(String name, String amount) { return "<tr><td>" + name + "</td><td>Açıklama çğıöşü</td><td>" + amount + "</td><td>9/12/2026</td><td>Yes</td></tr>"; }

    private byte[] render(String html, DocxOrientation orientation) throws Exception { ByteArrayOutputStream out = new ByteArrayOutputStream(); new HtmlToDocxRenderer().render(html, "", out, orientation); return out.toByteArray(); }
    private String orientation(byte[] bytes) throws Exception { try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(bytes))) { return doc.getDocument().getBody().getSectPr().getPgSz().getOrient().toString(); } }
}
