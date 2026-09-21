package com.example.mendix.pdf;

public record FullDataBatchOptions(BatchMode mode, int batchSize, String collectionPath) {
    public static final int DEFAULT_BATCH_SIZE = 5_000;
    public static final int MIN_BATCH_SIZE = 100;
    public static final int MAX_BATCH_SIZE = 25_000;

    public FullDataBatchOptions {
        mode = mode == null ? BatchMode.AUTO : mode;
        if (batchSize < MIN_BATCH_SIZE || batchSize > MAX_BATCH_SIZE) {
            throw new IllegalArgumentException("BatchSize must be between 100 and 25000");
        }
        collectionPath = collectionPath == null ? "" : collectionPath.trim();
        if (mode != BatchMode.OFF && collectionPath.isEmpty()) {
            throw new IllegalArgumentException("BatchCollectionPath is required when batching is enabled");
        }
    }

    public static FullDataBatchOptions defaults(String collectionPath) {
        return new FullDataBatchOptions(BatchMode.AUTO, DEFAULT_BATCH_SIZE, collectionPath);
    }
}
