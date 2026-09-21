package com.example.mendix.stress;

import static org.junit.jupiter.api.Assertions.*;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.junit.jupiter.api.Test;

class StressHelperTest {
    @Test void markersAreDeterministic() {
        assertEquals("STRESS-FIRST-ROW-000001", StressMarkers.name(1, 10_000));
        assertEquals("STRESS-LAST-ROW-010000", StressMarkers.name(10_000, 10_000));
        assertEquals("STRESS-LAST-ROW-025000", StressMarkers.last(25_000));
    }

    @Test void dataIncludesTurkishUnicodeAndExpectedAmount() {
        StressRowData row = StressDataFactory.create(1, 1_000);
        assertEquals("Açıklama Türkçe veri çğıöşü 1", row.description());
        assertEquals("1250.50", row.amount().toPlainString());
    }

    @Test void serializerProducesSafeUtf8JsonAndMarkers() throws Exception {
        var rows = List.of(StressDataFactory.create(1, 2), StressDataFactory.create(2, 2));
        String json = new StressJsonSerializer().serialize("Rapor \"A\"", 2, "2025-01-01T00:00:00Z", rows);
        assertTrue(json.contains("STRESS-FIRST-ROW-000001"));
        assertTrue(json.contains("STRESS-LAST-ROW-000002"));
        assertTrue(json.contains("Açıklama Türkçe veri çğıöşü"));
        assertTrue(json.getBytes(StandardCharsets.UTF_8).length > json.length());
        assertTrue(json.contains("Rapor \\\"A\\\""));
    }

    @Test void rejectsUnsupportedStressSizes() {
        assertThrows(IllegalArgumentException.class, () -> StressMarkers.last(0));
        assertThrows(IllegalArgumentException.class, () -> StressMarkers.last(1_000_000));
    }
}
