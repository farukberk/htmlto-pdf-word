import { describe, expect, it, vi } from "vitest";
import { DEFAULT_EXPORT_SCOPE, executeFullDataExport } from "../export/exportScope";
import { Big } from "big.js";

const available = (value: string) => ({ status: "available", value } as never);
const batching = { batchMode: "auto" as const, batchSize: 5000, batchCollectionPath: "rows" };

describe("export scope", () => {
    it("keeps CurrentView as the default", () => {
        expect(DEFAULT_EXPORT_SCOPE).toBe("currentView");
    });

    it.each(["allFiltered", "selected"] as const)("passes %s FullData without reading DOM", scope => {
        const execute = vi.fn();
        const querySpy = vi.spyOn(document, "querySelector");
        executeFullDataExport({
            scope,
            reportJson: available('{"rows":[1,2]}'),
            template: available("<#list rows as row>${row}</#list>"),
            action: { canExecute: true, isExecuting: false, execute } as never,
            ...batching
        });
        expect(execute).toHaveBeenCalledWith({
            ReportJson: '{"rows":[1,2]}',
            TemplateContent: "<#list rows as row>${row}</#list>",
            ExportScope: scope,
            BatchMode: "auto",
            BatchSize: expect.any(Big),
            BatchCollectionPath: "rows"
        });
        expect(querySpy).not.toHaveBeenCalled();
        querySpy.mockRestore();
    });

    it("fails clearly when FullData configuration is missing", () => {
        expect(() => executeFullDataExport({ scope: "allFiltered", ...batching })).toThrow("FullData template is not configured.");
        expect(() => executeFullDataExport({ scope: "selected", template: available("template"), ...batching }))
            .toThrow("FullData report JSON is not configured.");
        expect(() => executeFullDataExport({ scope: "selected", template: available("template"), reportJson: available("{}"), ...batching }))
            .toThrow("FullData export action is not configured.");
    });

    it("validates batch configuration before invoking the action", () => {
        const action = { canExecute: true, isExecuting: false, execute: vi.fn() } as never;
        expect(() => executeFullDataExport({ scope: "allFiltered", template: available("t"), reportJson: available('{"data":{}}'), action,
            batchMode: "auto", batchSize: 99, batchCollectionPath: "data.rows" })).toThrow("Batch Size");
        expect(() => executeFullDataExport({ scope: "allFiltered", template: available("t"), reportJson: available('{"data":{}}'), action,
            batchMode: "auto", batchSize: 5000, batchCollectionPath: "data.rows" })).toThrow("was not found");
    });

    it("uses only generic FullData inputs", () => {
        expect(executeFullDataExport.name).toBe("executeFullDataExport");
    });
});
