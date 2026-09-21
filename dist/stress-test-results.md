# FullData stress-test results

JVM memory values are sampled used-heap approximations, not process-wide peak RSS. Timeout per Chromium render: 300 seconds.

| Phase | Rows | Data Build | JSON Size | HTML Render | HTML Size | PDF Render | PDF Size | Total | JVM Memory before/HTML/PDF/peak MB | HTML First | HTML Last | PDF First | PDF Last | Result | Failure |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---|---|---|---|---|---|
| Phase 1 | 100 | 0 ms | 0 B | 286 ms | 22006 B | 1229 ms | 292571 B | 2195 ms | 2/14/18/18 | true | true | true | true | PASS |  |
| Phase 1 | 1000 | 0 ms | 0 B | 37 ms | 210337 B | 1921 ms | 2479222 B | 2584 ms | 7/13/18/18 | true | true | true | true | PASS |  |
| Phase 1 | 5000 | 0 ms | 0 B | 45 ms | 1063337 B | 6122 ms | 12340784 B | 8906 ms | 14/41/62/62 | true | true | true | true | PASS |  |
| Phase 1 | 10000 | 0 ms | 0 B | 149 ms | 2130842 B | 16106 ms | 24850822 B | 18605 ms | 47/98/67/98 | true | true | true | true | PASS |  |
| Phase 1 | 25000 | 0 ms | 0 B | 70 ms | 5389592 B | 59963 ms | 62642030 B | 67931 ms | 84/115/213/213 | true | true | true | true | PASS |  |
| Phase 1 | 50000 | 0 ms | 0 B | 88 ms | 10820842 B | 0 ms | 0 B | 55358 ms | 197/259/0/259 | true | true | false | false | FAIL | Chromium PDF rendering failed with exit code 0 |
| Phase 2 | 100 | 1 ms | 19888 B | 489 ms | 22006 B | 1794 ms | 292571 B | 2478 ms | 5/19/20/20 | true | true | true | true | PASS |  |
| Phase 2 | 1000 | 4 ms | 201017 B | 17 ms | 210337 B | 2210 ms | 2479222 B | 3154 ms | 7/16/21/21 | true | true | true | true | PASS |  |
| Phase 2 | 5000 | 17 ms | 1018017 B | 57 ms | 1063337 B | 6649 ms | 12340784 B | 9326 ms | 15/56/77/77 | true | true | true | true | PASS |  |
| Phase 2 | 10000 | 35 ms | 2040522 B | 56 ms | 2130842 B | 17692 ms | 24850822 B | 23264 ms | 48/126/92/126 | true | true | true | true | PASS |  |
| Phase 2 | 25000 | 90 ms | 5164272 B | 120 ms | 5389592 B | 62589 ms | 62642030 B | 76502 ms | 87/128/139/139 | true | true | true | true | PASS |  |
| Phase 2 | 50000 | 172 ms | 10370522 B | 196 ms | 10820842 B | 0 ms | 0 B | 54572 ms | 204/381/0/381 | true | true | false | false | FAIL | Chromium PDF rendering failed with exit code 0 |
