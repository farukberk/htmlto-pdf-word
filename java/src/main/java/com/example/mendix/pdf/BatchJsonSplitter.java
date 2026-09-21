package com.example.mendix.pdf;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

public final class BatchJsonSplitter {
    private final ObjectMapper mapper;

    public BatchJsonSplitter() { this(new ObjectMapper()); }
    BatchJsonSplitter(ObjectMapper mapper) { this.mapper = mapper; }

    public BatchPlan plan(String reportJson, FullDataBatchOptions options) throws IOException {
        if (reportJson == null || reportJson.isBlank()) throw new IllegalArgumentException("ReportJson is required");
        if (options == null) throw new IllegalArgumentException("FullData batch options are required");
        JsonNode parsed = mapper.readTree(reportJson);
        if (!(parsed instanceof ObjectNode root)) throw new IllegalArgumentException("FullData report JSON root must be an object");
        if (options.mode() == BatchMode.OFF) return new BatchPlan(List.of(reportJson), 0, false);

        JsonNode collection = resolve(root, options.collectionPath());
        if (collection == null) {
            throw new IllegalArgumentException("FullData batch collection path '" + options.collectionPath() + "' was not found.");
        }
        if (!(collection instanceof ArrayNode array)) {
            throw new IllegalArgumentException("FullData batch collection path '" + options.collectionPath() + "' is not an array.");
        }
        int totalRecords = array.size();
        int totalBatches = Math.max(1, (totalRecords + options.batchSize() - 1) / options.batchSize());
        boolean enabled = totalRecords > options.batchSize();
        if (!enabled) totalBatches = 1;
        List<String> batches = new ArrayList<>(totalBatches);
        for (int index = 0; index < totalBatches; index++) {
            int start = enabled ? index * options.batchSize() : 0;
            int endExclusive = enabled ? Math.min(totalRecords, start + options.batchSize()) : totalRecords;
            ObjectNode copy = root.deepCopy();
            ArrayNode target = (ArrayNode) resolve(copy, options.collectionPath());
            target.removeAll();
            for (int position = start; position < endExclusive; position++) target.add(array.get(position).deepCopy());
            ObjectNode metadata = mapper.createObjectNode();
            metadata.put("enabled", enabled);
            metadata.put("index", index);
            metadata.put("number", index + 1);
            metadata.put("total", totalBatches);
            metadata.put("startIndex", start);
            metadata.put("endIndex", endExclusive == 0 ? -1 : endExclusive - 1);
            metadata.put("totalRecords", totalRecords);
            metadata.put("isFirst", index == 0);
            metadata.put("isLast", index == totalBatches - 1);
            copy.set("_batch", metadata); // Reserved input metadata is deliberately replaced in the batch copy.
            batches.add(mapper.writeValueAsString(copy));
        }
        return new BatchPlan(List.copyOf(batches), totalRecords, enabled);
    }

    private static JsonNode resolve(JsonNode root, String path) {
        JsonNode current = root;
        for (String part : path.split("\\.")) {
            if (part.isBlank() || !current.isObject() || !current.has(part)) return null;
            current = current.get(part);
        }
        return current;
    }

    public record BatchPlan(List<String> batchJson, int totalRecords, boolean batchingEnabled) { }
}
