package com.example.mendix.docx;

import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.junit.jupiter.api.Test;
import java.io.*;
import java.nio.file.*;
import java.util.zip.ZipFile;
import static org.junit.jupiter.api.Assertions.*;

class WordProductionFixtureTest {
    @Test void createsReopenableMultiPageCorporateFixture() throws Exception {
        String png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z4xkAAAAASUVORK5CYII=";
        StringBuilder html = new StringBuilder("<html><head><title>Kurumsal Mendix Raporu</title></head><body>")
            .append("<h1>Kurumsal Performans Raporu</h1><h2>Yönetici Özeti</h2><p>İstanbul, Şişli — Türkçe karakterler: ç Ç ğ Ğ ı İ ö Ö ş Ş ü Ü.</p>")
            .append("<table><thead><tr><th>Birim</th><th>Sorumlu</th><th>Durum</th><th>Tutar</th><th>Tarih</th><th>Hedef</th><th>Gerçekleşen</th><th>Fark</th><th>Not</th><th>Aktif</th></tr></thead><tbody>")
            .append("<tr><td>Finans</td><td>Özgür Güneş</td><td>Onaylandı</td><td>1.250,50</td><td>26.09.2026</td><td>100</td><td>96</td><td>-4</td><td>Düzenlenebilir</td><td>☒</td></tr></tbody></table>")
            .append("<h2>Detaylar</h2><blockquote>Bu belge gerçek Word yapıları kullanır.</blockquote><ul><li>Birinci madde<ul><li>Alt madde</li></ul></li></ul><ol><li>Planla</li><li>Uygula</li></ol>")
            .append("<p><a href='https://www.mendix.com'>Mendix bağlantısı</a></p><img alt='Durum göstergesi' width='24' height='24' src='data:image/png;base64,").append(png).append("'/>")
            .append("<h2>Uzun DataGrid Raporu</h2><table><thead><tr><th>Kayıt</th><th>Açıklama</th><th>Tutar</th><th>Tarih</th><th>Durum</th></tr></thead><tbody>");
        for (int i = 1; i <= 140; i++) html.append("<tr><td>ROW-").append(String.format("%04d", i)).append("</td><td>İstanbul operasyon kaydı ").append(i).append("</td><td>").append(i * 125).append("</td><td>26.09.2026</td><td>Aktif</td></tr>");
        html.append("</tbody></table><h2>Form Değerleri</h2><p>Metin: Güncel değer — Seçim: Tamamlandı — Onay: ☒</p></body></html>");
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        new HtmlToDocxRenderer().render(html.toString(), "", out, new DocxRenderOptions(DocxOrientation.PORTRAIT, 10, 12, true));
        Path directory = Path.of("..", "dist", "word-smoke").toAbsolutePath().normalize(); Files.createDirectories(directory);
        Path docx = directory.resolve("word-production-smoke.docx"); Files.write(docx, out.toByteArray());
        try (XWPFDocument reopened = new XWPFDocument(Files.newInputStream(docx))) {
            assertTrue(reopened.getParagraphs().stream().anyMatch(p -> p.getText().contains("Türkçe karakterler")));
            assertEquals(2, reopened.getTables().size()); assertEquals(141, reopened.getTables().get(1).getNumberOfRows());
            assertFalse(reopened.getAllPictures().isEmpty());
        }
        try (ZipFile zip = new ZipFile(docx.toFile())) {
            assertNotNull(zip.getEntry("word/document.xml")); assertNotNull(zip.getEntry("word/_rels/document.xml.rels"));
            assertTrue(zip.stream().anyMatch(entry -> entry.getName().startsWith("word/media/")));
        }
    }
}
