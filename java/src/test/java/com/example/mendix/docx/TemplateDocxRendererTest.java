package com.example.mendix.docx;

import org.apache.poi.xwpf.usermodel.*;
import org.apache.poi.wp.usermodel.HeaderFooterType;
import org.apache.poi.util.Units;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.STFldCharType;
import org.junit.jupiter.api.Test;
import java.io.*;
import java.nio.file.*;
import java.util.Base64;
import static org.junit.jupiter.api.Assertions.*;

class TemplateDocxRendererTest {
    @Test void replacesSplitRunsRepeatsRowsAndPreservesHeaderFooter() throws Exception {
        byte[] template;
        try (XWPFDocument doc = new XWPFDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            XWPFHeader header = doc.createHeader(HeaderFooterType.DEFAULT); header.createParagraph().createRun().setText("Demo logo {{report.title}}");
            XWPFFooter footer = doc.createFooter(HeaderFooterType.DEFAULT); footer.createParagraph().createRun().setText("Corporate footer");
            XWPFParagraph p = doc.createParagraph(); p.createRun().setText("{{report"); p.createRun().setText(".description}}");
            XWPFParagraph missing = doc.createParagraph(); missing.createRun().setText("Missing={{missing.value}}");
            XWPFTable table = doc.createTable(2, 2); table.getRow(0).getCell(0).setText("Name"); table.getRow(0).getCell(1).setText("Amount");
            table.getRow(1).getCell(0).setText("{{rows[].name}}"); table.getRow(1).getCell(1).setText("{{rows[].amount}}");
            doc.write(out); template = out.toByteArray();
        }
        ByteArrayOutputStream result = new ByteArrayOutputStream();
        new TemplateDocxRenderer().render(new ByteArrayInputStream(template), "{\"report\":{\"title\":\"Monthly\",\"description\":\"Split works\"},\"rows\":[{\"name\":\"A\",\"amount\":1},{\"name\":\"B\",\"amount\":2}]}", result);
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(result.toByteArray()))) {
            assertEquals("Split works", doc.getParagraphs().get(0).getText()); assertEquals("Missing=", doc.getParagraphs().get(1).getText());
            assertTrue(doc.getHeaderList().get(0).getText().contains("Monthly")); assertTrue(doc.getFooterList().get(0).getText().contains("Corporate footer"));
            assertEquals(3, doc.getTables().get(0).getNumberOfRows()); assertEquals("A", doc.getTables().get(0).getRow(1).getCell(0).getText()); assertEquals("B", doc.getTables().get(0).getRow(2).getCell(0).getText());
        }
    }

    @Test void rejectsInvalidTemplate() {
        assertThrows(DocxRenderingException.class, () -> new TemplateDocxRenderer().render(new ByteArrayInputStream("bad".getBytes()), "{}", new ByteArrayOutputStream()));
    }

    @Test void createsReusableCorporateTemplateExample() throws Exception {
        Path sample = Path.of("..", "examples", "word-template-example.docx").toAbsolutePath().normalize(); Files.createDirectories(sample.getParent());
        try (XWPFDocument doc = new XWPFDocument(); OutputStream out = Files.newOutputStream(sample)) {
            XWPFHeader header = doc.createHeader(HeaderFooterType.DEFAULT); XWPFParagraph hp = header.createParagraph();
            byte[] logo = Base64.getDecoder().decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z4xkAAAAASUVORK5CYII=");
            hp.createRun().addPicture(new ByteArrayInputStream(logo), org.apache.poi.xwpf.usermodel.Document.PICTURE_TYPE_PNG, "demo-logo.png", Units.pixelToEMU(24), Units.pixelToEMU(24)); hp.createRun().setText(" DEMO CORPORATION — {{report.title}}");
            XWPFFooter footer = doc.createFooter(HeaderFooterType.DEFAULT); XWPFParagraph fp = footer.createParagraph(); fp.createRun().setText("Generic confidential footer — Page ");
            XWPFRun begin = fp.createRun(); begin.getCTR().addNewFldChar().setFldCharType(STFldCharType.BEGIN); fp.createRun().getCTR().addNewInstrText().setStringValue("PAGE"); XWPFRun end = fp.createRun(); end.getCTR().addNewFldChar().setFldCharType(STFldCharType.END);
            XWPFParagraph title = doc.createParagraph(); title.setStyle("Title"); title.createRun().setText("{{report.title}}");
            doc.createParagraph().createRun().setText("Date: {{report.generatedDate}}"); doc.createParagraph().createRun().setText("{{report.description}}");
            XWPFTable table = doc.createTable(2, 3); table.getRow(0).getCell(0).setText("Name"); table.getRow(0).getCell(1).setText("Description"); table.getRow(0).getCell(2).setText("Amount");
            table.getRow(1).getCell(0).setText("{{rows[].name}}"); table.getRow(1).getCell(1).setText("{{rows[].description}}"); table.getRow(1).getCell(2).setText("{{rows[].amount}}");
            doc.createParagraph().createRun().setText("Authorized signature: ____________________"); doc.write(out);
        }
        assertTrue(Files.size(sample) > 1_000);
    }
}
