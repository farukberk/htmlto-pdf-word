# Word stress test

Java 21; Apache POI semantic DOCX; one editable table per document.

| Rows | HTML ms | DOCX ms | Size bytes | Heap delta | Markers | Table rows |
|---:|---:|---:|---:|---:|:---:|---:|
| 100 | 2 | 69 | 3958 | 0 | PASS | 101 |
| 1000 | 7 | 264 | 11003 | 16360880 | PASS | 1001 |
| 5000 | 9 | 982 | 41959 | 107064600 | PASS | 5001 |
| 10000 | 22 | 1130 | 80069 | 87220704 | PASS | 10001 |
| 25000 | 18 | 4170 | 195177 | 180369120 | PASS | 25001 |
