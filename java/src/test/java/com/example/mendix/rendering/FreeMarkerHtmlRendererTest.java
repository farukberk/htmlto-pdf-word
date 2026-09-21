package com.example.mendix.rendering;

import org.junit.jupiter.api.Test;
import java.util.stream.IntStream;
import static org.junit.jupiter.api.Assertions.*;

class FreeMarkerHtmlRendererTest {
    private final FreeMarkerHtmlRenderer renderer = new FreeMarkerHtmlRenderer();

    @Test void rendersBasicNestedArraysAndTurkish() throws Exception {
        String result = renderer.render("${title}: ${customer.city}; <#list rows as r>${r.name}<#sep>,</#list>",
            "{\"title\":\"Çığ ÖŞÜ\",\"customer\":{\"city\":\"İstanbul\"},\"rows\":[{\"name\":\"bir\"},{\"name\":\"iki\"}]}");
        assertEquals("Çığ ÖŞÜ: İstanbul; bir,iki", result);
    }

    @Test void rejectsMalformedJson() { assertThrows(HtmlRenderingException.class, () -> renderer.render("ok", "{")); }
    @Test void reportsInvalidTemplate() { assertThrows(HtmlRenderingException.class, () -> renderer.render("<#if>", "{}")); }
    @Test void reportsMissingValues() { assertThrows(HtmlRenderingException.class, () -> renderer.render("${missing}", "{}")); }

    @Test void rendersLargeRepeatedDatasets() throws Exception {
        for (int size : new int[] {100, 1_000, 5_000, 10_000}) {
            String rows = IntStream.range(0, size).mapToObj(i -> "{\"id\":" + i + "}").reduce((a,b) -> a + "," + b).orElse("");
            String result = renderer.render("<#list rows as r>${r.id}\n</#list>", "{\"rows\":[" + rows + "]}");
            assertEquals(size, result.lines().count());
        }
    }
}
