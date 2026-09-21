# Mendix FullData stress-test setup (Studio Pro 10.24.24)

The `.mpr` was intentionally not edited outside Studio Pro. The test-only helper is in `mendix-full-data-stress` and does not alter the renderer, widget, or existing stress harness.

## 1. Install the helper

Build `mendix-full-data-stress` with Java 21 and copy `target/html-pdf-export-mendix-stress-helper-1.0.0.jar` into the test app's `userlib`. Keep the existing shaded renderer JAR.

## 2. Domain model in `MyFirstModule`

Create persistent entities:

- `StressReport`: `Name` String(200), `RequestedRowCount` Long, `CreatedDate` DateTime.
- `StressRow`: `RowNumber` Long, `Name` String(200), `Description` String(unlimited), `Category` String(50), `Amount` Decimal, `RowDate` DateTime, `Status` String(30).
- Association `StressRow_StressReport`, many `StressRow` to one `StressReport`. Set delete behavior so deleting a report also deletes associated rows only if that behavior is acceptable for this isolated test module; the cleanup action does not rely on cascade.
- `StressTestResult`: `RequestedRowCount`, `CreatedRowCount`, `RetrievedRowCount`, `DataGenerationMs`, `CommitMs`, `RetrieveMs`, `JsonSerializeMs`, `JsonSizeBytes`, `HtmlRenderMs`, `HtmlSizeBytes`, `PdfRenderMs`, `PdfSizeBytes`, `FileDocumentStoreMs`, `TotalMs`, `HeapUsedBytes` (all Long); `Success`, `JsonMarkersValid`, `HtmlMarkersValid`, `PdfMarkersValid` (Boolean); `FailureStage`, `ExceptionClass`, `ExceptionMessage` (String).
- Association `StressTestResult_StressReport` (one-to-one) and `StressTestResult_GeneratedPdf` (one-to-one).

Give the test user role create/read/write/delete access to these entities and read/write access to `GeneratedPdf`. Do not expose the helper actions to production roles.

## 3. Java Actions

Create these Java Actions in `MyFirstModule`, deploy for Eclipse, and put only the shown statements inside each generated `BEGIN USER CODE` region. Fully qualified names avoid imports.

### `JA_CreateStressData`

Parameters: `StressReport` (`MyFirstModule.StressReport`), `RowCount` (Long), `BatchSize` (Integer), `Result` (`MyFirstModule.StressTestResult`). Return Long.

```java
var value = com.example.mendix.stress.MendixStressService.createRows(
    getContext(), StressReport.getMendixObject(), RowCount, BatchSize);
Result.setDataGenerationMs(value.generationMs());
Result.setCommitMs(value.commitMs());
Result.setCreatedRowCount(value.createdCount());
return value.createdCount();
```

### `JA_SerializeStressData`

Parameters: `StressReport` (`MyFirstModule.StressReport`), `Result` (`MyFirstModule.StressTestResult`). Return String.

```java
var value = com.example.mendix.stress.MendixStressService.retrieveAndSerialize(
    getContext(), StressReport.getMendixObject());
Result.setRetrieveMs(value.retrieveMs());
Result.setJsonSerializeMs(value.serializeMs());
Result.setRetrievedRowCount(value.retrievedCount());
Result.setJsonSizeBytes(value.jsonSizeBytes());
Result.setHeapUsedBytes(value.heapUsedBytes());
return value.json();
```

### `JA_ConvertHtmlToPdfMeasured`

Parameters: `Html` String, `BaseUri` String, `OutputFile` System.FileDocument, `Result` StressTestResult. Return Nothing. This is test-only instrumentation and delegates rendering to the unchanged production abstraction.

```java
if (OutputFile == null) throw new IllegalArgumentException("OutputFile is required");
String base = BaseUri == null || BaseUri.isBlank() ? null : BaseUri.trim();
long started = System.nanoTime();
byte[] bytes;
try (var output = new java.io.ByteArrayOutputStream()) {
    com.example.mendix.pdf.PdfRenderers.preferred().render(Html, base, output);
    bytes = output.toByteArray();
}
Result.setPdfRenderMs((System.nanoTime() - started) / 1_000_000L);
Result.setPdfSizeBytes((long) bytes.length);
started = System.nanoTime();
try (var input = new java.io.ByteArrayInputStream(bytes)) {
    com.mendix.core.Core.storeFileDocumentContent(
        getContext(), OutputFile.getMendixObject(), input);
}
Result.setFileDocumentStoreMs((System.nanoTime() - started) / 1_000_000L);
return null;
```

### `JA_VerifyStressPdf`

Parameters: `OutputFile` System.FileDocument, `RowCount` Long. Return Boolean.

```java
try (var input = com.mendix.core.Core.getFileDocumentContent(
        getContext(), OutputFile.getMendixObject())) {
    return com.example.mendix.stress.StressPdfVerifier.containsMarkers(input, RowCount);
}
```

### `JA_CleanupStressData`

Parameters: `StressReport` StressReport, `BatchSize` Integer. Return Long.

```java
return com.example.mendix.stress.MendixStressService.cleanup(
    getContext(), StressReport.getMendixObject(), BatchSize);
```

### `JA_GetStressFinalMarker`

Parameter: `RowCount` Long. Return String.

```java
return com.example.mendix.stress.StressMarkers.last(RowCount);
```

### `JA_Utf8Size`

Parameter: `Value` String. Return Long.

```java
return Value == null ? 0L : (long) Value.getBytes(java.nio.charset.StandardCharsets.UTF_8).length;
```

## 4. Template

Create a String constant `FullDataStressTemplate` and paste the UTF-8 contents of `mendix-full-data-stress/src/main/resources/full-data-stress.ftl`. Do not use ExactView CSS.

## 5. Microflow `SUB_RunFullDataStressTest`

Parameter: `RowCount` Long. Return: `StressTestResult`.

Create activities in this exact order:

1. Create `StressReport` as `$Report`: `Name = 'FullData stress ' + toString($RowCount)`, `RequestedRowCount = $RowCount`, `CreatedDate = [%CurrentDateTime%]`.
2. Commit `$Report` with events = No, refresh = No.
3. Create `StressTestResult` as `$Result`: `RequestedRowCount = $RowCount`, `Success = false`, `FailureStage = 'data-generation'`. Associate it to `$Report`.
4. Set `$Started = [%CurrentDateTime%]`.
5. Call `JA_CreateStressData`: Report `$Report`, RowCount `$RowCount`, BatchSize `500`, Result `$Result`. Use custom error handling that records `FailureStage`, `ExceptionClass`, and `ExceptionMessage`, commits `$Result`, and ends without starting a larger test.
6. Set `FailureStage = 'retrieve-json'`; call `JA_SerializeStressData($Report,$Result)` as `$JsonData`.
7. Call `JA_GetStressFinalMarker($RowCount)` as `$FinalMarker`.
8. Set `JsonMarkersValid = contains($JsonData,'STRESS-FIRST-ROW-000001') and contains($JsonData,$FinalMarker)`.
9. Decision: require `$Result/RetrievedRowCount = $RowCount and $Result/CreatedRowCount = $RowCount and $Result/JsonMarkersValid`. On false, set failure stage `json-integrity`, commit result, stop.
10. Set `FailureStage = 'html-render'` and `$PhaseStart = [%CurrentDateTime%]`.
11. Call existing `JA_RenderHtml`: TemplateContent `$FullDataStressTemplate`, JsonData `$JsonData`, return `$Html`.
12. Call `JA_Utf8Size($Html)` as `$HtmlSize`; set `HtmlRenderMs = millisecondsBetween($PhaseStart,[%CurrentDateTime%])`, `HtmlSizeBytes = $HtmlSize`, and `HtmlMarkersValid = contains($Html,'STRESS-FIRST-ROW-000001') and contains($Html,$FinalMarker)`.
13. Decision: require `HtmlMarkersValid`; otherwise record `html-integrity` and stop.
14. Create `GeneratedPdf` as `$Pdf`; set `Name = 'FullData-' + toString($RowCount) + '.pdf'`.
15. Set `FailureStage = 'pdf-render-store'`; call `JA_ConvertHtmlToPdfMeasured`: Html `$Html`, BaseUri `empty`, OutputFile `$Pdf`, Result `$Result`.
16. Commit `$Pdf` with events = No, refresh = No. Associate `$Result` to `$Pdf`.
17. Set `FailureStage = 'pdf-integrity'`; call `JA_VerifyStressPdf($Pdf,$RowCount)` as `$PdfValid`; set `PdfMarkersValid = $PdfValid`.
18. Set `TotalMs = millisecondsBetween($Started,[%CurrentDateTime%])`, `Success = $PdfValid`, and `FailureStage = if $PdfValid then empty else 'pdf-integrity'`.
19. Commit `$Result` with events = No, refresh = No. Return `$Result`. Do not download inside this subflow.

For every Java Action use an error handler that sets `Success=false`, the current `FailureStage`, `ExceptionClass='JavaActionException'`, `ExceptionMessage=$latestError/Message`, `TotalMs`, commits `$Result`, and returns it. Runtime logs may contain counts/timings but never JSON, HTML, or document contents.

## 6. Orchestrator `ACT_RunFullDataStressSuite`

No parameters; return Nothing. Run synchronously from an admin-only test page/button:

1. Create list variable `[1000,5000,10000,25000]` (or call the subflow four times in this order).
2. For each size call `SUB_RunFullDataStressTest`.
3. Decision after each call: continue only when `Success` is true and created/retrieved counts equal the requested count and all three marker flags are true. Otherwise end immediately. This enforces the stop policy.
4. Retain successful PDFs for download until inspected. Do not run 50,000.

## 7. Download and cleanup

- `ACT_DownloadStressPdf(Result)`: retrieve `GeneratedPdf` over `StressTestResult_GeneratedPdf`; use **Download file**, FileDocument `$Pdf`, Show file in browser = No.
- `ACT_CleanupStressData(Result)`: retrieve associated report; call `JA_CleanupStressData($Report,500)`; delete the associated PDF; delete `$Result`; commit/deletes with refresh = No. Run after recording measurements/download verification.

After model creation, select **App > Deploy for Eclipse**, keep generated code outside user/extra regions untouched, run the Gradle compile/package command, then execute sizes in order from the Mendix Runtime. The present repository results are helper/unit/build validation only; they are not real Mendix database export measurements.
