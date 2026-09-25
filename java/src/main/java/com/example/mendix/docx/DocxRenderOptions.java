package com.example.mendix.docx;

/** Word-native page options shared with the widget's corporate print settings. */
public record DocxRenderOptions(DocxOrientation orientation, int horizontalMarginMm,
                                int verticalMarginMm, boolean smartPageBreaks) {
    public DocxRenderOptions {
        if (orientation == null) orientation = DocxOrientation.PORTRAIT;
        if (horizontalMarginMm < 0 || horizontalMarginMm > 30) throw new IllegalArgumentException("Horizontal margin must be between 0 and 30 mm.");
        if (verticalMarginMm < 0 || verticalMarginMm > 30) throw new IllegalArgumentException("Vertical margin must be between 0 and 30 mm.");
    }

    public static DocxRenderOptions defaults(DocxOrientation orientation) {
        return new DocxRenderOptions(orientation, 10, 12, true);
    }
}
