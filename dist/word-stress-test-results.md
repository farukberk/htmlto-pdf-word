# Word stress test

Java 21; Apache POI semantic DOCX; one editable table per document.

| Rows | HTML ms | DOCX ms | Size bytes | Heap delta | Markers | Table rows |
|---:|---:|---:|---:|---:|:---:|---:|
| 100 | 1 | 40 | 3992 | 0 | PASS | 101 |
| 1000 | 4 | 251 | 11049 | 49074864 | PASS | 1001 |
| 5000 | 10 | 1341 | 42006 | 84308408 | PASS | 5001 |
| 10000 | 51 | 1833 | 80118 | 15248992 | PASS | 10001 |
| 25000 | 41 | 6500 | 195229 | 142698120 | PASS | 25001 |
