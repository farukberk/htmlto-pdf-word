import { HtmlPdfExportViewPreviewProps } from "../typings/HtmlPdfExportViewProps";
import { Problem, Properties } from "@mendix/pluggable-widgets-tools";

export function getProperties(_values: HtmlPdfExportViewPreviewProps, defaultProperties: Properties): Properties {
    return defaultProperties;
}

export function check(values: HtmlPdfExportViewPreviewProps): Problem[] {
    const problems: Problem[] = [];
    if (values.batchSize == null || values.batchSize < 100 || values.batchSize > 25_000) {
        problems.push({ property: "batchSize", severity: "error", message: "Batch Size must be between 100 and 25000; larger batches can cause high Chromium resource usage." });
    }
    if (values.batchMode !== "off" && !values.batchCollectionPath.trim()) {
        problems.push({ property: "batchCollectionPath", severity: "error", message: "Batch Collection Path is required when Batch Mode is Auto or Always." });
    }
    if (values.exportScope !== "currentView") {
        if (!values.fullDataJson.trim()) problems.push({ property: "fullDataJson", severity: "error", message: "Report JSON is required for All Filtered and Selected." });
        if (!values.fullDataTemplate.trim()) problems.push({ property: "fullDataTemplate", severity: "error", message: "Template Content is required for All Filtered and Selected." });
        if (values.exportFormat === "pdf" && !values.onFullDataExport) problems.push({ property: "onFullDataExport", severity: "error", message: "FullData Export Action is required for PDF All Filtered and Selected." });
        if (values.exportFormat === "word" && !values.onFullDataWordExport) problems.push({ property: "onFullDataWordExport", severity: "error", message: "FullData Word Export Action is required for Word All Filtered and Selected." });
    }
    if (values.exportFormat === "word" && values.exportScope === "currentView" && !values.onWordExport) problems.push({ property: "onWordExport", severity: "error", message: "Current View Word Export Action is required for Word Current View." });
    if (values.showExportButton && !values.buttonCaption.trim()) {
        problems.push({ property: "buttonCaption", severity: "warning", message: "Provide an accessible Export Button Caption." });
    }
    return problems;
}
