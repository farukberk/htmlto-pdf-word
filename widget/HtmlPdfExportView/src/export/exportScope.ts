import { ActionValue, DynamicValue, Option } from "mendix";
import { Big } from "big.js";

export type FullDataScope = "allFiltered" | "selected";
export const DEFAULT_EXPORT_SCOPE = "currentView" as const;

export interface FullDataExportInput {
    scope: FullDataScope;
    reportJson?: DynamicValue<string>;
    template?: DynamicValue<string>;
    batchMode: "off" | "auto" | "always";
    batchSize: number;
    batchCollectionPath: string;
    action?: ActionValue<{
        ReportJson: Option<string>;
        TemplateContent: Option<string>;
        ExportScope: Option<string>;
        BatchMode: Option<string>;
        BatchSize: Option<Big>;
        BatchCollectionPath: Option<string>;
    }>;
}

function requiredValue(value: DynamicValue<string> | undefined, message: string): string {
    if (!value || value.status !== "available" || !value.value.trim()) {
        throw new Error(message);
    }
    return value.value;
}

export function executeFullDataExport(input: FullDataExportInput): void {
    const template = requiredValue(input.template, "FullData template is not configured.");
    const reportJson = requiredValue(input.reportJson, "FullData report JSON is not configured.");
    if (!input.action) throw new Error("FullData export action is not configured.");
    if (!input.action.canExecute) throw new Error("FullData export action cannot execute in the current context.");
    if (input.action.isExecuting) throw new Error("FullData export action is already executing.");
    if (!Number.isInteger(input.batchSize) || input.batchSize < 100 || input.batchSize > 25_000) {
        throw new Error("Batch Size must be between 100 and 25000.");
    }
    const collectionPath = input.batchCollectionPath.trim();
    if (input.batchMode !== "off") {
        if (!collectionPath) throw new Error("Batch Collection Path is required when batching is enabled.");
        validateCollectionPath(reportJson, collectionPath);
    }
    input.action.execute({
        ReportJson: reportJson,
        TemplateContent: template,
        ExportScope: input.scope,
        BatchMode: input.batchMode,
        BatchSize: new Big(input.batchSize),
        BatchCollectionPath: collectionPath
    });
}

function validateCollectionPath(reportJson: string, path: string): void {
    let current: unknown;
    try { current = JSON.parse(reportJson); }
    catch { throw new Error("Report JSON is not valid JSON."); }
    for (const part of path.split(".")) {
        if (!part || typeof current !== "object" || current === null || !(part in current)) {
            throw new Error(`FullData batch collection path '${path}' was not found.`);
        }
        current = (current as Record<string, unknown>)[part];
    }
    if (!Array.isArray(current)) throw new Error(`FullData batch collection path '${path}' is not an array.`);
}
