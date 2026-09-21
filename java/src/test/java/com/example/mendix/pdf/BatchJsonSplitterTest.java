package com.example.mendix.pdf;

import static org.junit.jupiter.api.Assertions.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class BatchJsonSplitterTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private final BatchJsonSplitter splitter = new BatchJsonSplitter();

    @Test void offPreservesOriginalWithoutAPath() throws Exception {
        String json = "{\"items\":[1,2],\"metadata\":\"kept\"}";
        var plan = splitter.plan(json, new FullDataBatchOptions(BatchMode.OFF, 100, ""));
        assertEquals(List.of(json), plan.batchJson());
        assertFalse(plan.batchingEnabled());
    }

    @Test void autoSmallExactAndEmptyCollectionsRenderOnce() throws Exception {
        for (int size : new int[] { 0, 100 }) {
            var plan = splitter.plan(json("items", size), options(BatchMode.AUTO, 100, "items"));
            assertEquals(1, plan.batchJson().size());
            assertFalse(plan.batchingEnabled());
            assertEquals(size, collection(plan.batchJson().get(0), "items").size());
        }
    }

    @Test void autoAndAlwaysSplitBatchSizePlusOne() throws Exception {
        for (BatchMode mode : List.of(BatchMode.AUTO, BatchMode.ALWAYS)) {
            var plan = splitter.plan(json("items", 101), options(mode, 100, "items"));
            assertEquals(2, plan.batchJson().size());
            assertEquals(100, collection(plan.batchJson().get(0), "items").size());
            assertEquals(1, collection(plan.batchJson().get(1), "items").size());
        }
    }

    @Test void nestedPathPreservesMetadataAndReplacesReservedBatchMetadata() throws Exception {
        ObjectNode root = (ObjectNode) mapper.readTree(json("unused", 0));
        ObjectNode report = root.putObject("report");
        report.put("title", "Çağrı raporu");
        ArrayNode rows = report.putArray("rows");
        for (int i = 1; i <= 101; i++) rows.addObject().put("id", i).put("name", i == 1 ? "İlk çğıöşü" : "R" + i);
        root.putObject("_batch").put("untrusted", true);
        var plan = splitter.plan(mapper.writeValueAsString(root), options(BatchMode.AUTO, 100, "report.rows"));
        JsonNode first = mapper.readTree(plan.batchJson().get(0));
        assertEquals("Çağrı raporu", first.at("/report/title").asText());
        assertFalse(first.at("/_batch").has("untrusted"));
        assertEquals(0, first.at("/_batch/index").asInt());
        assertEquals(1, first.at("/_batch/number").asInt());
        assertEquals(2, first.at("/_batch/total").asInt());
        assertEquals(0, first.at("/_batch/startIndex").asInt());
        assertEquals(99, first.at("/_batch/endIndex").asInt());
        assertEquals(101, first.at("/_batch/totalRecords").asInt());
        assertTrue(first.at("/_batch/isFirst").asBoolean());
        assertFalse(first.at("/_batch/isLast").asBoolean());
        assertTrue(plan.batchJson().get(0).contains("İlk çğıöşü"));
    }

    @Test void twelveThousandFiveHundredHasNoLossDuplicatesOrReordering() throws Exception {
        var plan = splitter.plan(json("records", 12_500), options(BatchMode.AUTO, 5_000, "records"));
        assertEquals(3, plan.batchJson().size());
        List<Integer> ids = new ArrayList<>();
        for (String batch : plan.batchJson()) collection(batch, "records").forEach(node -> ids.add(node.get("id").asInt()));
        assertEquals(12_500, ids.size());
        assertEquals(12_500, ids.stream().distinct().count());
        for (int i = 0; i < ids.size(); i++) assertEquals(i + 1, ids.get(i));
        JsonNode last = mapper.readTree(plan.batchJson().get(2));
        assertEquals(10_000, last.at("/_batch/startIndex").asInt());
        assertEquals(12_499, last.at("/_batch/endIndex").asInt());
        assertTrue(last.at("/_batch/isLast").asBoolean());
    }

    @Test void invalidPathAndNonArrayFailClearly() {
        var options = options(BatchMode.AUTO, 100, "report.rows");
        var missing = assertThrows(IllegalArgumentException.class, () -> splitter.plan("{\"report\":{}}", options));
        assertEquals("FullData batch collection path 'report.rows' was not found.", missing.getMessage());
        var wrong = assertThrows(IllegalArgumentException.class, () -> splitter.plan("{\"report\":{\"rows\":{}}}", options));
        assertEquals("FullData batch collection path 'report.rows' is not an array.", wrong.getMessage());
    }

    private FullDataBatchOptions options(BatchMode mode, int size, String path) { return new FullDataBatchOptions(mode, size, path); }
    private ArrayNode collection(String json, String path) throws Exception {
        JsonNode node = mapper.readTree(json);
        for (String part : path.split("\\.")) node = node.get(part);
        return (ArrayNode) node;
    }
    private String json(String path, int count) throws Exception {
        ObjectNode root = mapper.createObjectNode();
        root.put("title", "metadata");
        ArrayNode array = root.putArray(path);
        for (int i = 1; i <= count; i++) array.addObject().put("id", i).put("name", i == count ? "LAST-" + i : "R-" + i);
        return mapper.writeValueAsString(root);
    }
}
