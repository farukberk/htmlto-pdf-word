# Batched FullData capacity results

| Records | Batches | Total | Final PDF | First | Middle/order | Last | Result |
|---:|---:|---:|---:|---|---|---|---|
| 5000 | 1 | 7190 ms | 5305083 B | true | true | true | PASS |

Batch timings for 5000: [BatchMetric[batchNumber=1, durationMs=3615, pdfSizeBytes=5305083]]
| 12500 | 3 | 39955 ms | 19503552 B | true | true | true | PASS |

Batch timings for 12500: [BatchMetric[batchNumber=1, durationMs=3533, pdfSizeBytes=5304933], BatchMetric[batchNumber=2, durationMs=3375, pdfSizeBytes=5303931], BatchMetric[batchNumber=3, durationMs=2165, pdfSizeBytes=2653533]]
| 50000 | 10 | 155291 ms | 79143177 B | true | true | true | PASS |

Batch timings for 50000: [BatchMetric[batchNumber=1, durationMs=3417, pdfSizeBytes=5304933], BatchMetric[batchNumber=2, durationMs=3340, pdfSizeBytes=5303931], BatchMetric[batchNumber=3, durationMs=3319, pdfSizeBytes=5304140], BatchMetric[batchNumber=4, durationMs=3277, pdfSizeBytes=5304093], BatchMetric[batchNumber=5, durationMs=3296, pdfSizeBytes=5304140], BatchMetric[batchNumber=6, durationMs=3295, pdfSizeBytes=5304099], BatchMetric[batchNumber=7, durationMs=3290, pdfSizeBytes=5304006], BatchMetric[batchNumber=8, durationMs=3344, pdfSizeBytes=5304199], BatchMetric[batchNumber=9, durationMs=3447, pdfSizeBytes=5304079], BatchMetric[batchNumber=10, durationMs=3239, pdfSizeBytes=5304705]]
