package com.example.mendix.docx;

public enum DocxOrientation {
    PORTRAIT, LANDSCAPE, AUTO;

    public static DocxOrientation parse(String value) {
        if (value == null || value.isBlank()) return PORTRAIT;
        return valueOf(value.trim().toUpperCase());
    }
}
