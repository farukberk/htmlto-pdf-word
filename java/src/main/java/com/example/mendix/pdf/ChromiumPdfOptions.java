package com.example.mendix.pdf;

public record ChromiumPdfOptions(
    PageSize pageSize,
    Orientation orientation,
    double marginTopMm,
    double marginRightMm,
    double marginBottomMm,
    double marginLeftMm,
    double scale,
    boolean printBackgrounds,
    long loadWaitMilliseconds,
    long processTimeoutSeconds
) {
    public enum PageSize { A4 }
    public enum Orientation { AUTO, PORTRAIT, LANDSCAPE }

    public ChromiumPdfOptions {
        if (pageSize == null || orientation == null) throw new IllegalArgumentException("Page size and orientation are required");
        if (marginTopMm < 0 || marginRightMm < 0 || marginBottomMm < 0 || marginLeftMm < 0) throw new IllegalArgumentException("Margins cannot be negative");
        if (scale <= 0 || scale > 2) throw new IllegalArgumentException("Scale must be greater than zero and at most 2");
        if (loadWaitMilliseconds < 0 || processTimeoutSeconds < 1) throw new IllegalArgumentException("Wait and timeout values are invalid");
    }

    public static ChromiumPdfOptions defaults() {
        return new ChromiumPdfOptions(PageSize.A4, Orientation.PORTRAIT, 8, 8, 8, 8, 1, true, 2_000, 60);
    }

    public ChromiumPdfOptions withOrientation(Orientation value) {
        return new ChromiumPdfOptions(pageSize, value, marginTopMm, marginRightMm, marginBottomMm, marginLeftMm, scale, printBackgrounds, loadWaitMilliseconds, processTimeoutSeconds);
    }
}
