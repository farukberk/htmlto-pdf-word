package com.example.mendix.pdf;

import java.util.Locale;

public enum BatchMode {
    OFF, AUTO, ALWAYS;

    public static BatchMode from(String value) {
        if (value == null || value.isBlank()) return AUTO;
        try { return valueOf(value.trim().toUpperCase(Locale.ROOT)); }
        catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("BatchMode must be Off, Auto, or Always");
        }
    }
}
