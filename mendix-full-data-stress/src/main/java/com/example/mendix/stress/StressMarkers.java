package com.example.mendix.stress;

public final class StressMarkers {
    private StressMarkers() { }

    public static String first() {
        return "STRESS-FIRST-ROW-000001";
    }

    public static String last(long rowCount) {
        if (rowCount < 1 || rowCount > 999_999) {
            throw new IllegalArgumentException("rowCount must be between 1 and 999999");
        }
        return "STRESS-LAST-ROW-" + String.format("%06d", rowCount);
    }

    public static String name(long rowNumber, long rowCount) {
        if (rowNumber == 1) return first();
        if (rowNumber == rowCount) return last(rowCount);
        return "STRESS-ROW-" + String.format("%06d", rowNumber);
    }
}
