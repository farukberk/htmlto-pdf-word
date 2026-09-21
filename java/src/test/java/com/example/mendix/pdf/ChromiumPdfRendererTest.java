package com.example.mendix.pdf;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.pdfbox.text.TextPosition;
import org.junit.jupiter.api.Test;

import java.awt.image.BufferedImage;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class ChromiumPdfRendererTest {
    private static final String TURKISH = "ç Ç ğ Ğ ı İ ö Ö ş Ş ü Ü Başarılı Çağrı İstanbul Şişli Özgür Güneş";

    @Test void preservesBrowserLayoutsAndTurkishUnicode() throws Exception {
        var executable = ChromiumExecutableLocator.requireExecutable();
        String html = """
            <!doctype html><html lang="tr" data-html-pdf-source-width="1804" data-html-pdf-source-height="920" data-html-pdf-orientation="landscape"><head><meta charset="UTF-8"><style>
            body{font-family:Arial,sans-serif}.section{background:#1261a0;color:#fff;padding:12px;border:4px solid #d33682}
            .flex{display:flex;gap:80px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:40px}
            .top-form{display:grid;grid-template-columns:1.1fr 1.7fr 1fr 1fr 1.4fr;gap:8px}.top-form label{display:flex;flex-direction:column}
            table{border-collapse:collapse;width:100%}th,td{border:1px solid #1261a0;padding:4px}th{background:#1261a0;color:#fff}
            .description{width:42%}.badge{background:#19a974;color:white;padding:4px}.color{background:#f4c542;color:#183153}
            .filters{display:grid;grid-template-columns:1fr 2.5fr 1fr 1fr 1fr 1fr;gap:4px}.pagination{display:flex;justify-content:space-between}
            </style></head><body>
            <div class="section">BLUE_SECTION</div>
            <div class="top-form"><label>TITLE_FIELD<input value="HTML PDF Türkçe Test çğıöşü"></label><label>DESCRIPTION_FIELD<textarea>Bu alan HTML export testi için oluşturuldu.</textarea></label><label>DATE_FIELD<input type="date" value="2026-09-11"></label><label>ACTIVE_FIELD<span><input type="radio" checked>Yes <input type="radio">No</span></label><label>STATUS_FIELD<span><input type="radio" checked>Taslak <input type="radio">Onaylandı <input type="radio">Reddedildi</span></label></div>
            <div class="flex"><span>FLEX_LEFT</span><span>FLEX_RIGHT</span></div>
            <div class="grid"><span>GRID_LEFT</span><span>GRID_RIGHT</span></div>
            <div class="filters"><input value="FILTER_NAME"><input value="FILTER_DESCRIPTION"><input value="FILTER_AMOUNT"><input type="date" value="2026-09-11"><select><option selected>FILTER_ACTIVE</option></select><button>FILTER_ACTION</button></div>
            <table><colgroup><col><col class="description"><col><col><col><col></colgroup>
            <thead><tr><th>NAME_HEADER ▲</th><th>DESCRIPTION_HEADER ▲</th><th>AMOUNT_HEADER</th><th>ROW_DATE_HEADER</th><th>ACTIVE_HEADER</th><th>ACTION_HEADER</th></tr></thead>
            <tbody><tr><td>Test Kaydı 1</td><td>DESC_ROW1 Açıklama çğıöşü</td><td>1250.5</td><td>9/11/2026</td><td>Yes</td><td><button>VIEW_ICON</button></td></tr>
            <tr><td>Test Kaydı 2</td><td>DESC_ROW2 Açıklama çğıöşü</td><td>2500</td><td>9/11/2026</td><td>Yes</td><td><button>DELETE_ICON</button></td></tr>
            <tr><td>Test Kaydı 3</td><td>DESC_ROW3 Açıklama çğıöşü</td><td>9999.99</td><td>9/11/2026</td><td>Yes</td><td><span class="badge">Başarılı</span></td></tr></tbody></table>
            <div class="pagination"><button>FIRST PREVIOUS</button><span>1 to 3 of 3</span><button>NEXT LAST</button></div>
            <input value="INPUT_OK"><select><option selected>SELECT_OK</option></select>
            <svg width="120" height="25" xmlns="http://www.w3.org/2000/svg"><rect width="120" height="25" fill="#1261a0"/><text x="2" y="18" fill="white">SVG_OK</text></svg>
            <div class="color">__TURKISH__</div></body></html>
            """.replace("__TURKISH__", TURKISH);

        byte[] pdf = new ChromiumPdfRenderer(executable,
            ChromiumPdfOptions.defaults().withOrientation(ChromiumPdfOptions.Orientation.LANDSCAPE)).render(html, null);
        assertTrue(pdf.length > 1_000);
        try (PDDocument document = PDDocument.load(pdf)) {
            assertTrue(document.getPage(0).getMediaBox().getWidth() > document.getPage(0).getMediaBox().getHeight(), "PDF must be landscape");
            PositionStripper stripper = new PositionStripper();
            String text = stripper.getText(document).replaceAll("\\s+", " ");
            for (String value : List.of("BLUE_SECTION", "TITLE_FIELD", "DESCRIPTION_FIELD", "DATE_FIELD", "ACTIVE_FIELD", "STATUS_FIELD", "FLEX_LEFT", "FLEX_RIGHT", "GRID_LEFT", "GRID_RIGHT", "FILTER_NAME", "FILTER_DESCRIPTION", "FILTER_ACTIVE", "NAME_HEADER", "DESCRIPTION_HEADER", "AMOUNT_HEADER", "ROW_DATE_HEADER", "ACTIVE_HEADER", "ACTION_HEADER", "Test Kaydı 1", "Test Kaydı 2", "Test Kaydı 3", "VIEW_ICON", "DELETE_ICON", "1 to 3 of 3", "INPUT_OK", "SELECT_OK", "SVG_OK")) {
                assertTrue(text.contains(value), "Missing PDF content: " + value);
            }
            for (String value : TURKISH.split(" ")) assertTrue(text.contains(value), "Missing Turkish PDF text: " + value);
            assertHorizontal(stripper, "FLEX_LEFT", "FLEX_RIGHT");
            assertHorizontal(stripper, "GRID_LEFT", "GRID_RIGHT");
            assertHorizontal(stripper, "TITLE_FIELD", "STATUS_FIELD");
            assertHorizontal(stripper, "Test Kaydı 1", "VIEW_ICON");
            assertHorizontal(stripper, "Test Kaydı 2", "DELETE_ICON");
            LocatedText name = stripper.find("NAME_HEADER");
            LocatedText description = stripper.find("DESCRIPTION_HEADER");
            LocatedText amount = stripper.find("AMOUNT_HEADER");
            assertTrue(amount.x() - description.x() > description.x() - name.x(), "Description column must receive materially more width");
            assertTextOrder(text, "NAME_HEADER", "DESCRIPTION_HEADER", "AMOUNT_HEADER", "ROW_DATE_HEADER", "ACTIVE_HEADER", "ACTION_HEADER");
            assertTextOrder(text, "Test Kaydı 1", "DESC_ROW1", "1250.5", "9/11/2026", "Yes", "VIEW_ICON");
            assertTextOrder(text, "Test Kaydı 2", "DESC_ROW2", "2500", "9/11/2026", "Yes", "DELETE_ICON");

            BufferedImage page = new PDFRenderer(document).renderImageWithDPI(0, 96);
            assertTrue(countColor(page, 0x12, 0x61, 0xa0, 12) > 100, "Blue backgrounds/borders must remain");
            assertTrue(countColor(page, 0x19, 0xa9, 0x74, 12) > 20, "Green status background must remain");
            assertTrue(countColor(page, 0xd3, 0x36, 0x82, 12) > 20, "Colored border must remain");
        }
    }

    @Test void supportsAutoPortraitAndLandscapeConfiguration() throws Exception {
        var executable = ChromiumExecutableLocator.requireExecutable();
        String html = "<!doctype html><html><head><meta charset='UTF-8'></head><body>Orientation</body></html>";
        for (ChromiumPdfOptions.Orientation orientation : List.of(ChromiumPdfOptions.Orientation.AUTO, ChromiumPdfOptions.Orientation.PORTRAIT)) {
            String orientedHtml = orientation == ChromiumPdfOptions.Orientation.AUTO
                ? "<html data-html-pdf-source-width='700' data-html-pdf-source-height='900' data-html-pdf-orientation='auto'><body>Orientation</body></html>"
                : html;
            byte[] pdf = new ChromiumPdfRenderer(executable, ChromiumPdfOptions.defaults().withOrientation(orientation)).render(orientedHtml, null);
            try (PDDocument document = PDDocument.load(pdf)) {
                assertTrue(document.getPage(0).getMediaBox().getHeight() > document.getPage(0).getMediaBox().getWidth(), orientation + " must render portrait");
            }
        }
        byte[] landscape = new ChromiumPdfRenderer(executable,
            ChromiumPdfOptions.defaults().withOrientation(ChromiumPdfOptions.Orientation.LANDSCAPE)).render(html, null);
        try (PDDocument document = PDDocument.load(landscape)) {
            assertTrue(document.getPage(0).getMediaBox().getWidth() > document.getPage(0).getMediaBox().getHeight(), "Landscape must render landscape");
        }
    }

    @Test void parsesGeometryAndChoosesAutoOrientationDeterministically() {
        ChromiumPdfOptions options = ChromiumPdfOptions.defaults();
        String narrow = "<html data-html-pdf-source-width='700' data-html-pdf-source-height='1000' data-html-pdf-orientation='auto'></html>";
        String wide = "<html data-html-pdf-source-width='1804' data-html-pdf-source-height='920' data-html-pdf-orientation='auto'></html>";
        ChromiumPdfRenderer.RenderPlan narrowPlan = ChromiumPdfRenderer.planFor(narrow, options);
        ChromiumPdfRenderer.RenderPlan widePlan = ChromiumPdfRenderer.planFor(wide, options);
        assertEquals(ChromiumPdfOptions.Orientation.PORTRAIT, narrowPlan.orientation());
        assertEquals(ChromiumPdfOptions.Orientation.LANDSCAPE, widePlan.orientation());
        assertEquals(1804, widePlan.viewportWidth());
        assertEquals(920, widePlan.viewportHeight());
        assertEquals(1804, widePlan.sourceWidth());
        assertTrue(widePlan.landscapeScale() > widePlan.portraitScale());
        assertEquals(widePlan.landscapeScale(), widePlan.scale());
        assertEquals(widePlan, ChromiumPdfRenderer.planFor(wide, options));
    }

    private static int countColor(BufferedImage image, int red, int green, int blue, int tolerance) {
        int matches = 0;
        for (int y = 0; y < image.getHeight(); y++) for (int x = 0; x < image.getWidth(); x++) {
            int rgb = image.getRGB(x, y);
            if (Math.abs(((rgb >> 16) & 255) - red) <= tolerance && Math.abs(((rgb >> 8) & 255) - green) <= tolerance && Math.abs((rgb & 255) - blue) <= tolerance) matches++;
        }
        return matches;
    }

    private static void assertHorizontal(PositionStripper stripper, String left, String right) {
        LocatedText a = stripper.find(left); LocatedText b = stripper.find(right);
        assertNotNull(a, left); assertNotNull(b, right);
        assertEquals(a.y(), b.y(), 5, left + " and " + right + " must share a row");
        assertTrue(b.x() > a.x() + 20, right + " must be to the right of " + left);
    }

    private static void assertTextOrder(String text, String... values) {
        int previous = -1;
        for (String value : values) {
            int current = text.indexOf(value, previous + 1);
            assertTrue(current > previous, value + " must retain its visual column order");
            previous = current;
        }
    }

    private record LocatedText(String text, float x, float y) {}

    private static final class PositionStripper extends PDFTextStripper {
        private final List<LocatedText> values = new ArrayList<>();
        PositionStripper() throws IOException { setSortByPosition(true); }
        @Override protected void writeString(String text, List<TextPosition> positions) throws IOException {
            for (int index = 0; index < positions.size() && index < text.length(); index++) {
                if (index == 0 || Character.isWhitespace(text.charAt(index - 1))) {
                    values.add(new LocatedText(text.substring(index), positions.get(index).getXDirAdj(), positions.get(index).getYDirAdj()));
                }
            }
            super.writeString(text, positions);
        }
        LocatedText find(String expected) { return values.stream().filter(value -> value.text().startsWith(expected)).findFirst().orElse(null); }
    }
}
