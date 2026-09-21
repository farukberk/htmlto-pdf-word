package com.example.mendix.stress;

import java.math.BigDecimal;
import java.time.Instant;

public final class StressDataFactory {
    private static final Instant BASE_DATE = Instant.parse("2025-01-01T00:00:00Z");
    private StressDataFactory() { }

    public static StressRowData create(long rowNumber, long rowCount) {
        if (rowNumber < 1 || rowNumber > rowCount) throw new IllegalArgumentException("invalid row number");
        return new StressRowData(rowNumber, StressMarkers.name(rowNumber, rowCount),
            "Açıklama Türkçe veri çğıöşü " + rowNumber,
            "Category " + (char) ('A' + (int) ((rowNumber - 1) % 5)),
            new BigDecimal("1250.50").add(BigDecimal.valueOf(rowNumber - 1)),
            BASE_DATE.plusSeconds((rowNumber - 1) * 86_400L),
            rowNumber % 7 == 0 ? "Inactive" : "Active");
    }
}
