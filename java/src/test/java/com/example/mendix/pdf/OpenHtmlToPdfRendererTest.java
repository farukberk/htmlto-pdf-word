package com.example.mendix.pdf;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class OpenHtmlToPdfRendererTest {
    @Test void createsPdfBytes() throws Exception {
        byte[] bytes = new OpenHtmlToPdfRenderer().render("<!doctype html><html><head><meta charset='UTF-8'/></head><body><p>çğıİöşü</p></body></html>", null);
        assertTrue(bytes.length > 500);
        assertEquals("%PDF", new String(bytes, 0, 4, java.nio.charset.StandardCharsets.US_ASCII));
    }
}
