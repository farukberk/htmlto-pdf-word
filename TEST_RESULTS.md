# Test and build results

## Latest release-candidate verification (2026-09-12)

- Widget tests: 41/41 passed, including Word semantic ARIA/Mendix grid normalization, form association, runtime format/scope controls, capture and property-help coverage.
- Java tests: 28/28 passed, including native Word table and header checks, FullData/templated Word, Unicode, PDF regressions and Word stress tests.
- Word stress: 100, 1,000, 5,000, 10,000 and 25,000 rows passed. Each document reopened with first/last markers and expected table-row count. Measurements: `dist/word-stress-test-results.csv`.
- Widget `npm run build` and `npm run release`: passed. Java shaded JAR package: passed. Mendix Gradle `clean-custom-classes compile package`: passed.
- A new real Studio Pro smoke test of the final Word DataGrid2 normalization remains pending.

## Historical baseline

Verified 2026-09-11 on Windows 11:

- Widget unit tests: PASS — 9 tests covering default Portrait, Portrait/Landscape/Auto metadata, dynamic source width/height, runtime input/textarea/radio/checkbox/select state, SVG, canvas, standalone HTML, Turkish UTF-8, ExactView DataGrid2 preservation, exclusions, CleanReport isolation, and live-DOM immutability.
- TypeScript strict typecheck: PASS (`tsc --noEmit`).
- Mendix widget production release: PASS (`pluggable-widgets-tools release:web`); MPK generated.
- Java tests: PASS — 9 tests. Chromium verifies captured geometry parsing, fixed source viewport, proportional scale, deterministic narrow/wide Auto decisions, A4 Portrait/Landscape output, horizontal top-form geometry, six-column/three-row ordering, visible grid controls, flex/grid/SVG/form content, colors, borders, and Turkish Unicode. Existing FreeMarker and OpenHTMLtoPDF tests remain green.
- Java package: PASS (`mvn clean package`); regular and shaded JARs generated.
- FreeMarker HTML demo: PASS; complete UTF-8 HTML generated and Turkish source text verified.
- Chromium fidelity rendering: PASS; landscape sizing, 8 mm margins, scale 1, print backgrounds, layout positions, colors, and Unicode verified.
- Mendix 10.24.24 Gradle `clean-custom-classes compile package`: PASS with `PdfRenderers.preferred()` wired in the supported Java Action user region.

Expected renderer warning: OpenHTMLtoPDF 1.0.10 ignores modern `break-inside` while honoring the paired legacy `page-break-inside` rule.

## FullData stress baseline

The local test-only harness ran lazy-model and real-JSON series at 100, 1,000, 5,000, 10,000, 25,000, and 50,000 rows. Both phases passed through 25,000 rows with HTML and PDF first/last marker verification. At 50,000 rows Chromium exited normally without producing a PDF; this is the first measured capacity bottleneck. Detailed timings, sizes, sampled JVM heap approximations, and failure data are in `dist/stress-test-results.csv` and `dist/stress-test-results.md`. Production sources and artifacts were not changed by this harness.
