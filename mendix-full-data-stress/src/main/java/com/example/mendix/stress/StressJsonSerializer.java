package com.example.mendix.stress;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class StressJsonSerializer {
    private final ObjectMapper mapper = new ObjectMapper();

    public String serialize(String reportName, long rowCount, String generatedDate, List<StressRowData> rows)
            throws Exception {
        Map<String, Object> report = new LinkedHashMap<>();
        report.put("name", reportName);
        report.put("rowCount", rowCount);
        report.put("generatedDate", generatedDate);
        Map<String, Object> root = new LinkedHashMap<>();
        root.put("report", report);
        List<Map<String, Object>> jsonRows = new ArrayList<>(rows.size());
        for (StressRowData row : rows) {
            Map<String, Object> jsonRow = new LinkedHashMap<>();
            jsonRow.put("rowNumber", row.rowNumber());
            jsonRow.put("name", row.name());
            jsonRow.put("description", row.description());
            jsonRow.put("category", row.category());
            jsonRow.put("amount", row.amount());
            jsonRow.put("rowDate", row.rowDate().toString());
            jsonRow.put("status", row.status());
            jsonRows.add(jsonRow);
        }
        root.put("rows", jsonRows);
        return mapper.writeValueAsString(root);
    }
}
