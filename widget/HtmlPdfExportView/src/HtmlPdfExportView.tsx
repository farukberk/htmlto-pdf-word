import { createElement, ReactElement, useCallback, useEffect, useRef, useState } from "react";
import { HtmlPdfExportViewContainerProps } from "../typings/HtmlPdfExportViewProps";
import { cloneExportRoot } from "./capture/cloneExportRoot";
import { buildHtmlDocument } from "./capture/buildHtmlDocument";
import { measureSourceGeometry } from "./capture/measureSourceGeometry";
import { normalizeWordSemantics } from "./capture/normalizeWordSemantics";
import { executeFullDataExport } from "./export/exportScope";
import { createExportKey } from "./export/exportKey";
import "./ui/HtmlPdfExportView.css";

export function HtmlPdfExportView(props: HtmlPdfExportViewContainerProps): ReactElement {
    const rootRef = useRef<HTMLDivElement>(null);
    const [exportError, setExportError] = useState<string>();
    const [runtimeAppearance, setRuntimeAppearance] = useState(props.appearanceMode);
    const [runtimeScope, setRuntimeScope] = useState(props.exportScope);
    const [runtimeOrientation, setRuntimeOrientation] = useState(props.pdfOrientation);
    const [runtimeFormat, setRuntimeFormat] = useState(props.exportFormat);
    const [busy, setBusy] = useState(false);
    const [autoDelayElapsed, setAutoDelayElapsed] = useState(false);
    const clickGuard = useRef(false);
    const autoExportTriggeredRef = useRef(false);
    const exportContentRef = useRef<(trigger?: "manual" | "auto") => void>(() => undefined);
    const activeAction = useRef<"currentView" | "fullData" | "currentViewWord" | "fullDataWord" | "postExport">();
    const observedExecuting = useRef(false);
    const pendingPostExport = useRef<{ key: string; stage: "waitingStart" | "waitingFinish" | "scheduled" | "running" }>();
    const startTimer = useRef<number>();
    const postTimer = useRef<number>();
    const postActionRef = useRef(props.onAfterExport);
    postActionRef.current = props.onAfterExport;
    const appearance = props.showRuntimeAppearanceSelector ? runtimeAppearance : props.appearanceMode;
    const scope = props.showRuntimeScopeSelector ? runtimeScope : props.exportScope;
    const orientation = props.showRuntimeOrientationSelector ? runtimeOrientation : props.pdfOrientation;
    const format = props.showRuntimeFormatSelector ? runtimeFormat : props.exportFormat;
    const selectedFullDataAction = format === "word" ? props.onFullDataWordExport : props.onFullDataExport;
    const fullDataConfigured = Boolean(selectedFullDataAction && props.fullDataJson?.status === "available" &&
        props.fullDataJson.value.trim() && props.fullDataTemplate?.status === "available" && props.fullDataTemplate.value.trim());

    useEffect(() => {
        if (!busy || !activeAction.current) return;
        const pending = pendingPostExport.current;
        if (activeAction.current === "currentView" && pending) {
            const isExecuting = Boolean(props.onExport?.isExecuting);
            if (pending.stage === "waitingStart" && isExecuting) {
                pending.stage = "waitingFinish";
                if (startTimer.current !== undefined) window.clearTimeout(startTimer.current);
            } else if (pending.stage === "waitingFinish" && !isExecuting) {
                pending.stage = "scheduled";
                postTimer.current = window.setTimeout(() => {
                    if (pendingPostExport.current !== pending || pending.stage !== "scheduled") return;
                    const postAction = postActionRef.current;
                    if (!postAction || !postAction.canExecute || postAction.isExecuting) {
                        setExportError("Open Generated File Action is not ready. The PDF may already be stored.");
                        finishExport();
                        return;
                    }
                    pending.stage = "running";
                    activeAction.current = "postExport";
                    observedExecuting.current = false;
                    try {
                        postAction.execute({ ExportKey: pending.key });
                        startTimer.current = window.setTimeout(() => {
                            if (pendingPostExport.current !== pending || observedExecuting.current) return;
                            setExportError("Open Generated File Action did not start. The PDF may already be stored.");
                            finishExport();
                        }, 30_000);
                    }
                    catch (error) {
                        setExportError("Open Generated File Action failed. The PDF may already be stored.");
                        if (props.debugMode) console.error("HtmlPdfExportView post-export action failed", error);
                        finishExport();
                    }
                }, 0);
            }
            return;
        }
        const isExecuting = activeAction.current === "fullData" ? Boolean(props.onFullDataExport?.isExecuting)
            : activeAction.current === "fullDataWord" ? Boolean(props.onFullDataWordExport?.isExecuting)
            : activeAction.current === "currentViewWord" ? Boolean(props.onWordExport?.isExecuting)
            : activeAction.current === "postExport" ? Boolean(props.onAfterExport?.isExecuting)
            : Boolean(props.onExport?.isExecuting);
        if (isExecuting) observedExecuting.current = true;
        if (activeAction.current === "postExport") {
            if (observedExecuting.current && !isExecuting) finishExport();
            return;
        }
        if (observedExecuting.current && !isExecuting) finishExport();
        const fallback = window.setTimeout(() => {
            if (!observedExecuting.current) finishExport();
        }, 1500);
        return () => window.clearTimeout(fallback);
    });

    function finishExport(): void {
        if (startTimer.current !== undefined) window.clearTimeout(startTimer.current);
        if (postTimer.current !== undefined) window.clearTimeout(postTimer.current);
        startTimer.current = undefined;
        postTimer.current = undefined;
        pendingPostExport.current = undefined;
        clickGuard.current = false;
        activeAction.current = undefined;
        observedExecuting.current = false;
        setBusy(false);
    }

    useEffect(() => () => {
        if (startTimer.current !== undefined) window.clearTimeout(startTimer.current);
        if (postTimer.current !== undefined) window.clearTimeout(postTimer.current);
    }, []);

    const exportContent = useCallback((trigger: "manual" | "auto" = "manual") => {
        if (clickGuard.current) return;
        clickGuard.current = true;
        if (trigger === "manual" && props.autoExportOnLoad) autoExportTriggeredRef.current = true;
        const exportKey = createExportKey();
        setBusy(true);
        setExportError(undefined);
        if (scope !== "currentView") {
            try {
                if (format === "word") {
                    if (!fullDataConfigured || !props.onFullDataWordExport?.canExecute || props.onFullDataWordExport.isExecuting) {
                        throw new Error("FullData Word export action cannot execute.");
                    }
                    props.onFullDataWordExport.execute({
                        ReportJson: props.fullDataJson!.value,
                        TemplateContent: props.fullDataTemplate!.value,
                        ExportScope: scope,
                        Orientation: orientation
                    });
                    activeAction.current = "fullDataWord";
                    return;
                }
                executeFullDataExport({
                    scope,
                    reportJson: props.fullDataJson,
                    template: props.fullDataTemplate,
                    action: props.onFullDataExport,
                    batchMode: props.batchMode,
                    batchSize: props.batchSize,
                    batchCollectionPath: props.batchCollectionPath
                });
                activeAction.current = "fullData";
                if (props.debugMode) console.info("HtmlPdfExportView FullData export started", {
                    exportScope: scope, batchMode: props.batchMode, batchSize: props.batchSize,
                    batchCollectionPath: props.batchCollectionPath
                });
            } catch (error) {
                const technicalMessage = error instanceof Error ? error.message : "FullData export failed.";
                setExportError(userMessage(technicalMessage));
                if (props.debugMode) console.error("HtmlPdfExportView FullData export failed", { scope, message: technicalMessage });
                finishExport();
            }
            return;
        }
        try {
            if (!rootRef.current) throw new Error("The export content is not available.");
            const action = format === "word" ? props.onWordExport : props.onExport;
            if (trigger === "auto" && !action) throw new Error("Configure the Current View export action before enabling Auto Export On Load.");
            if (action && (!action.canExecute || action.isExecuting)) throw new Error("The Current View export action is not ready.");
            if (format === "word" && !action) throw new Error("The Current View Word export action is not configured.");
            if (format === "pdf" && props.openGeneratedFileAfterExport && (!props.onExport || !props.onAfterExport)) {
                throw new Error("Configure both Current View Export Action and Open Generated File Action for two-stage PDF export.");
            }

            const geometry = measureSourceGeometry(rootRef.current);
            const clone = cloneExportRoot(rootRef.current, { includeImages: props.includeImages, appearanceMode: format === "word" ? "cleanReport" : appearance });
            if (format === "word") normalizeWordSemantics(clone);
            const html = buildHtmlDocument(clone, { includeStyles: props.includeStyles }, {
                sourceWidth: geometry.width,
                sourceHeight: geometry.height,
                orientation
            });
            if (props.debugMode) {
                const portraitWidth = (210 - 16) * 96 / 25.4;
                const landscapeWidth = (297 - 16) * 96 / 25.4;
                const portraitScale = Math.min(1, portraitWidth / geometry.width);
                const landscapeScale = Math.min(1, landscapeWidth / geometry.width);
                const selectedOrientation = orientation === "auto" && landscapeScale >= portraitScale * 1.15 ? "landscape" : orientation === "auto" ? "portrait" : orientation;
                console.info("HtmlPdfExportView captured", {
                    bytes: new Blob([html]).size,
                    appearanceMode: appearance,
                    exportScope: scope,
                    sourceWidth: geometry.width,
                    sourceHeight: geometry.height,
                    selectedOrientation,
                    portraitScale,
                    landscapeScale,
                    chosenScale: selectedOrientation === "landscape" ? landscapeScale : portraitScale,
                    chromiumViewportWidth: geometry.width,
                    printablePageWidth: selectedOrientation === "landscape" ? landscapeWidth : portraitWidth
                });
            }
            if (format === "word" && props.onWordExport) {
                props.onWordExport.execute({ HtmlContent: html, Orientation: orientation });
                activeAction.current = "currentViewWord";
            } else if (format === "pdf" && props.onExport) {
                if (props.openGeneratedFileAfterExport) pendingPostExport.current = { key: exportKey, stage: "waitingStart" };
                props.onExport.execute({ HtmlContent: html, ExportKey: exportKey });
                activeAction.current = "currentView";
                if (props.openGeneratedFileAfterExport) {
                    startTimer.current = window.setTimeout(() => {
                        if (pendingPostExport.current?.key !== exportKey || pendingPostExport.current.stage !== "waitingStart") return;
                        setExportError("Current View export action did not start. No file-open action was run.");
                        finishExport();
                    }, 30_000);
                }
            } else {
                const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
                const link = document.createElement("a");
                link.href = url;
                link.download = props.fileName || "export.html";
                link.click();
                URL.revokeObjectURL(url);
                finishExport();
            }
        } catch (error) {
            const technicalMessage = error instanceof Error ? error.message : "Current View export failed.";
            setExportError(/Current View export action|Open Generated File Action|export content/i.test(technicalMessage) ? technicalMessage : userMessage(technicalMessage));
            if (props.debugMode) console.error("HtmlPdfExportView Current View export failed", { format, message: technicalMessage });
            finishExport();
        }
    }, [props, appearance, scope, orientation, format, fullDataConfigured]);

    exportContentRef.current = exportContent;
    useEffect(() => {
        if (!props.autoExportOnLoad || autoExportTriggeredRef.current) return;
        const delay = Number.isFinite(props.autoExportDelayMs) ? Math.max(0, Math.min(10_000, props.autoExportDelayMs)) : 500;
        let timeout: number | undefined;
        const frame = window.requestAnimationFrame(() => { timeout = window.setTimeout(() => setAutoDelayElapsed(true), delay); });
        return () => { window.cancelAnimationFrame(frame); if (timeout !== undefined) window.clearTimeout(timeout); };
    }, [props.autoExportOnLoad, props.autoExportDelayMs]);

    const currentViewAction = format === "word" ? props.onWordExport : props.onExport;
    useEffect(() => {
        if (!props.autoExportOnLoad || !autoDelayElapsed || autoExportTriggeredRef.current) return;
        if (scope !== "currentView") {
            autoExportTriggeredRef.current = true;
            setExportError("Auto Export On Load supports Current View only.");
            return;
        }
        if (!currentViewAction) {
            autoExportTriggeredRef.current = true;
            setExportError("Configure the Current View export action before enabling Auto Export On Load.");
            return;
        }
        if (!currentViewAction.canExecute || currentViewAction.isExecuting) return;
        autoExportTriggeredRef.current = true;
        if (!clickGuard.current) exportContentRef.current("auto");
    }, [props.autoExportOnLoad, autoDelayElapsed, scope, currentViewAction?.canExecute, currentViewAction?.isExecuting]);

    const defaultCaption = props.showRuntimeFormatSelector ? "Export" : format === "word" ? "Export Word" : "Export PDF";
    const buttonCaption = props.buttonCaption && props.buttonCaption !== "Export PDF" ? props.buttonCaption : defaultCaption;

    return <>
        <div ref={rootRef} className={props.class} style={props.style} data-html-pdf-export-view="true">{props.content}</div>
        {(props.showExportButton || props.showRuntimeAppearanceSelector || props.showRuntimeScopeSelector || props.showRuntimeOrientationSelector || props.showRuntimeFormatSelector || exportError) &&
            <div className="html-pdf-export-runtime-controls" data-html-pdf-export-exclude="true" aria-busy={busy}>
                {props.showRuntimeFormatSelector && <label>Format
                    <select aria-label="Export format" value={runtimeFormat} disabled={busy}
                        onChange={event => setRuntimeFormat(event.target.value as typeof runtimeFormat)}>
                        <option value="pdf">PDF</option><option value="word">Word</option>
                    </select>
                </label>}
                {props.showRuntimeAppearanceSelector && <label>Appearance
                    <select aria-label="Export appearance" value={runtimeAppearance} disabled={busy}
                        onChange={event => setRuntimeAppearance(event.target.value as typeof runtimeAppearance)}>
                        <option value="exactView">Exact View</option><option value="cleanReport">Clean Report</option>
                    </select>
                </label>}
                {props.showRuntimeScopeSelector && <label>Scope
                    <select aria-label="Export scope" value={runtimeScope} disabled={busy}
                        onChange={event => setRuntimeScope(event.target.value as typeof runtimeScope)}>
                        <option value="currentView">Current View</option>
                        <option value="allFiltered" disabled={!fullDataConfigured}>All Filtered</option>
                        <option value="selected" disabled={!fullDataConfigured}>Selected</option>
                    </select>
                </label>}
                {props.showRuntimeScopeSelector && !fullDataConfigured && <span className="sr-only">FullData export is not configured for this scope.</span>}
                {props.showRuntimeOrientationSelector && <label>Orientation
                    <select aria-label="PDF orientation" value={runtimeOrientation} disabled={busy}
                        onChange={event => setRuntimeOrientation(event.target.value as typeof runtimeOrientation)}>
                        <option value="portrait">Portrait</option><option value="landscape">Landscape</option><option value="auto">Auto</option>
                    </select>
                </label>}
                {props.showExportButton && <button type="button" className="btn mx-button btn-primary" aria-label={buttonCaption}
                    disabled={busy} onClick={() => exportContent()}>{busy ? format === "word" ? "Generating Word document..." : scope === "currentView" ? "Generating PDF..." : "Preparing large PDF..." : buttonCaption}</button>}
                {exportError && <div role="alert">{exportError}</div>}
            </div>}
    </>;
}

function userMessage(technicalMessage: string): string {
    if (/template|report json|export action|cannot execute/i.test(technicalMessage)) return "FullData export is not configured for this scope.";
    if (/collection path|not an array/i.test(technicalMessage)) return "The configured batch collection could not be found in the report data.";
    if (/batch size/i.test(technicalMessage)) return "The configured Batch Size must be between 100 and 25000.";
    if (/word|docx/i.test(technicalMessage)) return "The Word document could not be generated.";
    return "The PDF could not be generated. Please try again or contact the application administrator.";
}
