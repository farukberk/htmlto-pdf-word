# Status

- PDF Current View (Exact View/Clean Report), FullData scopes, Chromium rendering, batching and PDFBox merge are implemented. The earlier real Studio Pro PDF smoke tests passed.
- Word Current View, FullData and DOCX template rendering are implemented. The Mendix Java Action wrappers compile, and a real Word smoke test confirmed a valid editable DOCX. Its div-based DataGrid2 layout defect was subsequently corrected with Word-only semantic grid normalization; that final correction still needs a new real Studio Pro smoke test.
- Widget tests: 41/41 passed. Java tests: 28/28 passed. Widget build/release and Mendix Gradle compile/package passed.
- Current release artifacts are in `dist/`. See `WORD_STUDIOPRO_SMOKE_TEST.md` for the remaining end-to-end verification.
