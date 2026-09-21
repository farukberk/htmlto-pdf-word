package com.example.mendix.stress;

import com.mendix.core.Core;
import com.mendix.systemwideinterfaces.core.IContext;
import com.mendix.systemwideinterfaces.core.IMendixObject;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;

/** Test-only Mendix object generation/retrieval adapter. */
public final class MendixStressService {
    public static final String ROW_ENTITY = "MyFirstModule.StressRow";
    public static final String ASSOCIATION = "MyFirstModule.StressRow_StressReport";
    private MendixStressService() { }

    public record GenerationResult(long generationMs, long commitMs, long createdCount) { }
    public record SerializationResult(String json, long retrieveMs, long serializeMs, long retrievedCount,
                                      long jsonSizeBytes, long heapUsedBytes) { }

    public static GenerationResult createRows(IContext context, IMendixObject report, long rowCount, int batchSize) {
        if (report == null) throw new IllegalArgumentException("StressReport is required");
        if (rowCount < 1 || rowCount > 25_000) throw new IllegalArgumentException("RowCount must be 1..25000");
        if (batchSize < 1 || batchSize > 5_000) throw new IllegalArgumentException("BatchSize must be 1..5000");
        long generationNanos = 0, commitNanos = 0;
        List<IMendixObject> batch = new ArrayList<>(batchSize);
        for (long number = 1; number <= rowCount; number++) {
            long start = System.nanoTime();
            StressRowData value = StressDataFactory.create(number, rowCount);
            IMendixObject row = Core.instantiate(context, ROW_ENTITY);
            row.setValue(context, "RowNumber", value.rowNumber());
            row.setValue(context, "Name", value.name());
            row.setValue(context, "Description", value.description());
            row.setValue(context, "Category", value.category());
            row.setValue(context, "Amount", value.amount());
            row.setValue(context, "RowDate", Date.from(value.rowDate()));
            row.setValue(context, "Status", value.status());
            row.setValue(context, ASSOCIATION, report.getId());
            batch.add(row);
            generationNanos += System.nanoTime() - start;
            if (batch.size() == batchSize || number == rowCount) {
                start = System.nanoTime();
                Core.commit(context, batch);
                commitNanos += System.nanoTime() - start;
                batch.clear();
            }
        }
        return new GenerationResult(toMs(generationNanos), toMs(commitNanos), rowCount);
    }

    public static SerializationResult retrieveAndSerialize(IContext context, IMendixObject report) throws Exception {
        long start = System.nanoTime();
        String xpath = "//" + ROW_ENTITY + "[" + ASSOCIATION + "=$report]";
        List<IMendixObject> objects = Core.createXPathQuery(xpath)
            .setVariable("report", report)
            .addSort("RowNumber", true)
            .execute(context);
        long retrieveMs = toMs(System.nanoTime() - start);
        start = System.nanoTime();
        List<StressRowData> rows = new ArrayList<>(objects.size());
        for (IMendixObject row : objects) {
            Date date = row.getValue(context, "RowDate");
            rows.add(new StressRowData(((Number) row.getValue(context, "RowNumber")).longValue(),
                row.getValue(context, "Name"), row.getValue(context, "Description"),
                row.getValue(context, "Category"), (BigDecimal) row.getValue(context, "Amount"),
                date.toInstant(), row.getValue(context, "Status")));
        }
        String name = report.getValue(context, "Name");
        Number requested = report.getValue(context, "RequestedRowCount");
        Date created = report.getValue(context, "CreatedDate");
        String json = new StressJsonSerializer().serialize(name, requested.longValue(), created.toInstant().toString(), rows);
        long serializeMs = toMs(System.nanoTime() - start);
        long heap = Runtime.getRuntime().totalMemory() - Runtime.getRuntime().freeMemory();
        return new SerializationResult(json, retrieveMs, serializeMs, rows.size(),
            json.getBytes(StandardCharsets.UTF_8).length, heap);
    }

    public static long cleanup(IContext context, IMendixObject report, int batchSize) throws Exception {
        long deleted = 0;
        String xpath = "//" + ROW_ENTITY + "[" + ASSOCIATION + "=$report]";
        while (true) {
            List<IMendixObject> batch = Core.createXPathQuery(xpath)
                .setVariable("report", report)
                .setAmount(batchSize)
                .execute(context);
            if (batch.isEmpty()) break;
            Core.delete(context, batch);
            deleted += batch.size();
        }
        Core.delete(context, report);
        return deleted;
    }

    private static long toMs(long nanos) { return nanos / 1_000_000L; }
}
