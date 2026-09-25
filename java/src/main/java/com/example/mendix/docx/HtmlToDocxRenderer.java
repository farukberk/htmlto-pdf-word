package com.example.mendix.docx;

import org.apache.poi.util.Units;
import org.apache.poi.xwpf.usermodel.*;
import org.apache.xmlbeans.XmlCursor;
import org.jsoup.Jsoup;
import org.jsoup.nodes.*;
import org.jsoup.select.Elements;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.*;

import javax.xml.namespace.QName;
import java.io.*;
import java.net.URI;
import java.net.URLConnection;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.Base64;

/** Semantic, editable HTML to WordprocessingML converter. Browser-only CSS is intentionally ignored. */
public final class HtmlToDocxRenderer implements DocxRenderer {
    private static final int A4_PORTRAIT_W = 11906, A4_PORTRAIT_H = 16838;

    @Override
    public void render(String html, String baseUri, OutputStream output, DocxOrientation requested) throws IOException {
        render(html, baseUri, output, DocxRenderOptions.defaults(requested));
    }

    @Override
    public void render(String html, String baseUri, OutputStream output, DocxRenderOptions options) throws IOException {
        if (html == null) throw new IllegalArgumentException("HTML is required.");
        Objects.requireNonNull(output, "Output stream is required.");
        org.jsoup.nodes.Document source = Jsoup.parse(html, baseUri == null ? "" : baseUri);
        try (XWPFDocument target = new XWPFDocument()) {
            configureMetadata(target, source);
            DocxOrientation orientation = options.orientation() == DocxOrientation.AUTO ? chooseOrientation(source) : options.orientation();
            configurePage(target, orientation, options.horizontalMarginMm(), options.verticalMarginMm());
            NumberingIds numbering = createNumbering(target);
            Context context = new Context(target, baseUri, numbering, options.smartPageBreaks());
            for (Node child : source.body().childNodes()) appendBlock(context, child);
            removeInitialEmptyParagraph(target);
            target.write(output);
            output.flush();
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new DocxRenderingException("The Word document could not be generated.", e);
        }
    }

    private static void appendBlock(Context c, Node node) {
        if (node instanceof TextNode text && !text.isBlank()) addText(c.document.createParagraph(), text.text(), Style.PLAIN);
        if (!(node instanceof Element element)) return;
        String tag = element.normalName();
        if (tag.matches("h[1-6]")) {
            XWPFParagraph p = c.document.createParagraph();
            p.setStyle("Heading" + tag.substring(1));
            if (c.smartPageBreaks) { p.setKeepNext(true); keepLines(p); }
            applyParagraphCss(p, element);
            appendInline(c, p, element, Style.PLAIN);
        } else if (tag.equals("p")) {
            XWPFParagraph p = c.document.createParagraph(); applyParagraphCss(p, element); appendInline(c, p, element, Style.PLAIN);
        } else if (tag.equals("ul") || tag.equals("ol")) {
            appendList(c, element, tag.equals("ol"), 0);
        } else if (tag.equals("table")) {
            appendTable(c, element);
        } else if (tag.equals("img")) {
            XWPFParagraph p = c.document.createParagraph(); appendImage(c, p, element);
        } else if (Set.of("div", "section", "article", "main", "header", "footer", "blockquote").contains(tag)) {
            if (hasDirectInlineContent(element)) { XWPFParagraph p = c.document.createParagraph(); appendInline(c, p, element, Style.PLAIN); }
            else for (Node child : element.childNodes()) appendBlock(c, child);
        } else if (!Set.of("script", "style", "noscript", "button", "input", "select", "textarea").contains(tag)) {
            XWPFParagraph p = c.document.createParagraph(); appendInline(c, p, element, Style.PLAIN);
        }
    }

    private static boolean hasDirectInlineContent(Element element) {
        return element.childNodes().stream().anyMatch(n -> n instanceof TextNode t && !t.isBlank()) ||
            element.children().stream().anyMatch(e -> Set.of("span", "strong", "b", "em", "i", "u", "a", "img", "br").contains(e.normalName()));
    }

    private static void appendInline(Context c, XWPFParagraph p, Node node, Style inherited) {
        for (Node child : node.childNodes()) {
            if (child instanceof TextNode text) addText(p, text.getWholeText(), inherited);
            else if (child instanceof Element element) {
                String tag = element.normalName();
                Style style = inherited.merge(element);
                if (tag.equals("br")) p.createRun().addBreak();
                else if (tag.equals("img")) appendImage(c, p, element);
                else if (tag.equals("a") && !element.attr("href").isBlank()) appendHyperlink(p, element.text(), element.absUrl("href").isBlank() ? element.attr("href") : element.absUrl("href"), style);
                else if (tag.equals("ul") || tag.equals("ol")) appendList(c, element, tag.equals("ol"), 0);
                else appendInline(c, p, element, style);
            }
        }
    }

    private static void appendList(Context c, Element list, boolean ordered, int level) {
        for (Element li : directChildren(list, "li")) {
            XWPFParagraph p = c.document.createParagraph();
            p.setNumID(ordered ? c.numbering.ordered : c.numbering.bullet);
            p.setNumILvl(java.math.BigInteger.valueOf(Math.min(level, 8)));
            for (Node child : li.childNodes()) {
                if (child instanceof Element nested && (nested.normalName().equals("ul") || nested.normalName().equals("ol"))) continue;
                if (child instanceof TextNode t) addText(p, t.getWholeText(), Style.PLAIN); else appendInline(c, p, child, Style.PLAIN);
            }
            for (Element nested : directChildren(li, "ul", "ol")) appendList(c, nested, nested.normalName().equals("ol"), level + 1);
        }
    }

    private static void appendTable(Context c, Element htmlTable) {
        Elements rows = htmlTable.select("tr");
        if (rows.isEmpty()) return;
        int columns = rows.stream().mapToInt(r -> directChildren(r, "th", "td").size()).max().orElse(1);
        XWPFTable table = c.document.createTable(rows.size(), columns);
        table.setWidth("100%");
        table.setTableAlignment(TableRowAlign.CENTER);
        if (htmlTable.hasAttr("data-html-pdf-word-form")) table.removeBorders();
        List<String> columnWidths = htmlTable.select("colgroup > col").stream().map(col -> css(col, "width")).toList();
        for (int r = 0; r < rows.size(); r++) {
            Elements cells = directChildren(rows.get(r), "th", "td");
            XWPFTableRow row = table.getRow(r);
            if (r == 0 || rows.get(r).parent() != null && rows.get(r).parent().normalName().equals("thead")) row.setRepeatHeader(true);
            if (c.smartPageBreaks && rows.get(r).text().length() < 500) row.setCantSplitRow(true);
            for (int col = 0; col < columns; col++) {
                XWPFTableCell cell = row.getCell(col); cell.removeParagraph(0);
                if (columnWidths.size() == columns && !columnWidths.get(col).isBlank()) cell.setWidth(columnWidths.get(col));
                XWPFParagraph p = cell.addParagraph();
                if (col < cells.size()) {
                    Element sourceCell = cells.get(col);
                    appendInline(c, p, sourceCell, sourceCell.normalName().equals("th") ? Style.BOLD : Style.PLAIN);
                    applyCellCss(cell, sourceCell);
                }
            }
        }
    }

    private static void appendImage(Context c, XWPFParagraph p, Element image) {
        String src = image.attr("src");
        try {
            ImageData data = loadImage(src, c.baseUri);
            if (data == null) return;
            int width = parsePixels(image.attr("width"), 320), height = parsePixels(image.attr("height"), 180);
            p.createRun().addPicture(new ByteArrayInputStream(data.bytes), data.type, "image", Units.pixelToEMU(width), Units.pixelToEMU(height));
        } catch (Exception ignored) {
            String alternative = image.attr("alt").trim();
            if (!alternative.isBlank()) addText(p, "[Image: " + alternative + "]", Style.PLAIN);
        }
    }

    private static ImageData loadImage(String src, String baseUri) throws Exception {
        if (src == null || src.isBlank()) return null;
        byte[] bytes;
        String media = src;
        if (src.startsWith("data:")) {
            int comma = src.indexOf(','); if (comma < 0) return null;
            String header = src.substring(0, comma); media = header;
            bytes = header.contains(";base64") ? Base64.getDecoder().decode(src.substring(comma + 1)) : URI.create(src).getPath().getBytes();
        } else {
            URI uri = baseUri == null || baseUri.isBlank() ? URI.create(src) : URI.create(baseUri).resolve(src);
            if ("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme())) {
                URLConnection connection = uri.toURL().openConnection(); connection.setConnectTimeout(5000); connection.setReadTimeout(10000);
                try (InputStream input = connection.getInputStream()) { bytes = input.readNBytes(10 * 1024 * 1024 + 1); }
                if (bytes.length > 10 * 1024 * 1024) throw new IOException("Image exceeds the 10 MB safety limit.");
                media = connection.getContentType() == null ? uri.getPath() : connection.getContentType();
            } else {
                if (!"file".equalsIgnoreCase(uri.getScheme()) && uri.getScheme() != null) return null;
                bytes = Files.readAllBytes(uri.getScheme() == null ? Path.of(uri.getPath()) : Path.of(uri));
            }
        }
        int type = media.toLowerCase().contains("png") || isPng(bytes) ? org.apache.poi.xwpf.usermodel.Document.PICTURE_TYPE_PNG : org.apache.poi.xwpf.usermodel.Document.PICTURE_TYPE_JPEG;
        return new ImageData(bytes, type);
    }

    private static boolean isPng(byte[] b) { return b.length > 4 && b[0] == (byte)137 && b[1] == 80 && b[2] == 78 && b[3] == 71; }
    private static int parsePixels(String value, int fallback) { try { return Math.min(900, Math.max(1, Integer.parseInt(value.replaceAll("[^0-9]", "")))); } catch (Exception e) { return fallback; } }

    private static void appendHyperlink(XWPFParagraph p, String text, String url, Style style) {
        if (!url.matches("(?i)https?://.+|mailto:.+")) { addText(p, text, style); return; }
        String id = p.getDocument().getPackagePart().addExternalRelationship(url, XWPFRelation.HYPERLINK.getRelation()).getId();
        CTHyperlink link = p.getCTP().addNewHyperlink(); link.setId(id);
        CTR ctr = link.addNewR(); CTRPr props = ctr.addNewRPr(); props.addNewColor().setVal("0563C1"); props.addNewU().setVal(STUnderline.SINGLE);
        CTText value = ctr.addNewT(); value.setStringValue(text); value.setSpace(org.apache.xmlbeans.impl.xb.xmlschema.SpaceAttribute.Space.PRESERVE);
    }

    private static XWPFRun addText(XWPFParagraph p, String text, Style style) {
        XWPFRun run = p.createRun(); run.setText(text); run.setBold(style.bold); run.setItalic(style.italic); run.setUnderline(style.underline ? UnderlinePatterns.SINGLE : UnderlinePatterns.NONE);
        if (style.color != null) run.setColor(style.color); if (style.fontSize != null) run.setFontSize(style.fontSize); if (style.fontFamily != null) run.setFontFamily(style.fontFamily);
        return run;
    }

    private static void applyParagraphCss(XWPFParagraph p, Element e) {
        String align = css(e, "text-align");
        if ("center".equals(align)) p.setAlignment(ParagraphAlignment.CENTER); else if ("right".equals(align)) p.setAlignment(ParagraphAlignment.RIGHT); else if ("justify".equals(align)) p.setAlignment(ParagraphAlignment.BOTH);
    }

    private static void applyCellCss(XWPFTableCell cell, Element e) {
        String bg = normalizeColor(css(e, "background-color"));
        if (bg != null) cell.setColor(bg);
    }

    private static String css(Element e, String name) {
        for (String declaration : e.attr("style").split(";")) { String[] pair = declaration.split(":", 2); if (pair.length == 2 && pair[0].trim().equalsIgnoreCase(name)) return pair[1].trim(); }
        return "";
    }

    private static String normalizeColor(String color) {
        if (color == null) return null; color = color.trim();
        if (color.matches("#[0-9a-fA-F]{6}")) return color.substring(1).toUpperCase();
        if (color.matches("#[0-9a-fA-F]{3}")) return ("" + color.charAt(1) + color.charAt(1) + color.charAt(2) + color.charAt(2) + color.charAt(3) + color.charAt(3)).toUpperCase();
        java.util.regex.Matcher rgb = java.util.regex.Pattern.compile("rgba?\\(\\s*(\\d{1,3})\\s*,\\s*(\\d{1,3})\\s*,\\s*(\\d{1,3})(?:\\s*,[^)]*)?\\)", java.util.regex.Pattern.CASE_INSENSITIVE).matcher(color);
        if (rgb.matches()) return String.format("%02X%02X%02X", Math.min(255, Integer.parseInt(rgb.group(1))), Math.min(255, Integer.parseInt(rgb.group(2))), Math.min(255, Integer.parseInt(rgb.group(3))));
        return null;
    }

    private static void configureMetadata(XWPFDocument doc, org.jsoup.nodes.Document html) {
        String title = html.title(); if (!title.isBlank()) doc.getProperties().getCoreProperties().setTitle(title);
        doc.getProperties().getCoreProperties().setCreator("Mendix HtmlPdfExport");
    }

    private static DocxOrientation chooseOrientation(org.jsoup.nodes.Document html) {
        int maxColumns = html.select("tr").stream().mapToInt(r -> directChildren(r, "th", "td").size()).max().orElse(0);
        return maxColumns > 6 ? DocxOrientation.LANDSCAPE : DocxOrientation.PORTRAIT;
    }

    private static void configurePage(XWPFDocument doc, DocxOrientation orientation, int horizontalMarginMm, int verticalMarginMm) {
        CTSectPr section = doc.getDocument().getBody().isSetSectPr() ? doc.getDocument().getBody().getSectPr() : doc.getDocument().getBody().addNewSectPr();
        CTPageSz size = section.isSetPgSz() ? section.getPgSz() : section.addNewPgSz();
        boolean landscape = orientation == DocxOrientation.LANDSCAPE;
        size.setW(java.math.BigInteger.valueOf(landscape ? A4_PORTRAIT_H : A4_PORTRAIT_W));
        size.setH(java.math.BigInteger.valueOf(landscape ? A4_PORTRAIT_W : A4_PORTRAIT_H));
        size.setOrient(landscape ? STPageOrientation.LANDSCAPE : STPageOrientation.PORTRAIT);
        CTPageMar margins = section.isSetPgMar() ? section.getPgMar() : section.addNewPgMar();
        java.math.BigInteger horizontal = java.math.BigInteger.valueOf(mmToTwips(horizontalMarginMm));
        java.math.BigInteger vertical = java.math.BigInteger.valueOf(mmToTwips(verticalMarginMm));
        margins.setTop(vertical); margins.setBottom(vertical); margins.setLeft(horizontal); margins.setRight(horizontal);
    }

    private static long mmToTwips(int millimeters) { return Math.round(millimeters * 1440d / 25.4d); }

    private static void keepLines(XWPFParagraph paragraph) {
        CTPPr properties = paragraph.getCTP().isSetPPr() ? paragraph.getCTP().getPPr() : paragraph.getCTP().addNewPPr();
        if (!properties.isSetKeepLines()) properties.addNewKeepLines();
    }

    private static NumberingIds createNumbering(XWPFDocument doc) {
        XWPFNumbering numbering = doc.createNumbering();
        return new NumberingIds(addNumbering(numbering, true), addNumbering(numbering, false));
    }

    private static java.math.BigInteger addNumbering(XWPFNumbering numbering, boolean ordered) {
        CTAbstractNum abs = CTAbstractNum.Factory.newInstance();
        java.math.BigInteger abstractId = java.math.BigInteger.valueOf(ordered ? 10 : 11); abs.setAbstractNumId(abstractId);
        for (int i = 0; i < 9; i++) { CTLvl lvl = abs.addNewLvl(); lvl.setIlvl(java.math.BigInteger.valueOf(i)); lvl.addNewStart().setVal(java.math.BigInteger.ONE); lvl.addNewNumFmt().setVal(ordered ? STNumberFormat.DECIMAL : STNumberFormat.BULLET); lvl.addNewLvlText().setVal(ordered ? "%" + (i + 1) + "." : "•"); }
        numbering.addAbstractNum(new XWPFAbstractNum(abs)); return numbering.addNum(abstractId);
    }

    private static void removeInitialEmptyParagraph(XWPFDocument doc) {
        if (!doc.getParagraphs().isEmpty() && doc.getParagraphs().get(0).getText().isBlank() && doc.getBodyElements().size() > 1) doc.removeBodyElement(doc.getPosOfParagraph(doc.getParagraphs().get(0)));
    }

    private static Elements directChildren(Element parent, String... tags) {
        Set<String> names = Set.of(tags); Elements result = new Elements();
        for (Element child : parent.children()) if (names.contains(child.normalName())) result.add(child);
        return result;
    }

    private record Context(XWPFDocument document, String baseUri, NumberingIds numbering, boolean smartPageBreaks) {}
    private record NumberingIds(java.math.BigInteger ordered, java.math.BigInteger bullet) {}
    private record ImageData(byte[] bytes, int type) {}
    private record Style(boolean bold, boolean italic, boolean underline, String color, Integer fontSize, String fontFamily) {
        static final Style PLAIN = new Style(false, false, false, null, null, null), BOLD = new Style(true, false, false, null, null, null);
        Style merge(Element e) {
            String tag = e.normalName(), weight = css(e, "font-weight"), decoration = css(e, "text-decoration"), colorValue = normalizeColor(css(e, "color"));
            Integer size = null; String sizeCss = css(e, "font-size"); try { if (!sizeCss.isBlank()) size = Math.max(1, (int)Math.round(Double.parseDouble(sizeCss.replaceAll("[^0-9.]", "")) * (sizeCss.contains("px") ? .75 : 1))); } catch (Exception ignored) {}
            String family = css(e, "font-family").replace("\"", "").replace("'", "").split(",")[0].trim();
            return new Style(bold || tag.equals("strong") || tag.equals("b") || weight.equals("bold") || weight.matches("[6-9]00"), italic || tag.equals("em") || tag.equals("i") || css(e, "font-style").equals("italic"), underline || tag.equals("u") || decoration.contains("underline"), colorValue == null ? color : colorValue, size == null ? fontSize : size, family.isBlank() ? fontFamily : family);
        }
    }
}
