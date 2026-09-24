import { createElement, ReactElement, useCallback, useEffect, useRef, useState } from "react";
import { HtmlPdfExportViewContainerProps } from "../typings/HtmlPdfExportViewProps";
import { cloneExportRoot } from "./capture/cloneExportRoot";
import { buildHtmlDocument } from "./capture/buildHtmlDocument";
import { measureSourceGeometry } from "./capture/measureSourceGeometry";
import { normalizeWordSemantics } from "./capture/normalizeWordSemantics";
import { executeFullDataExport } from "./export/exportScope";
import { createExportKey } from "./export/exportKey";
import { GeometryDiagnostics } from "./capture/exactViewGeometry";
import { waitForCaptureStability } from "./capture/waitForCaptureStability";
import { PdfVisualPolishOptions, PdfVisualPolishResult } from "./capture/pdfVisualPolish";
import { CorporatePrintDiagnostics, CorporatePrintLayoutOptions } from "./capture/corporatePrintLayout";
import "./ui/HtmlPdfExportView.css";

type NoticeState = "idle" | "processing" | "success" | "error";

export function HtmlPdfExportView(props: HtmlPdfExportViewContainerProps): ReactElement {
    const rootRef = useRef<HTMLDivElement>(null);
    const [exportError, setExportError] = useState<string>();
    const [runtimeAppearance, setRuntimeAppearance] = useState(props.appearanceMode);
    const [runtimeScope, setRuntimeScope] = useState(props.exportScope);
    const [runtimeOrientation, setRuntimeOrientation] = useState(props.pdfOrientation);
    const [runtimeFormat, setRuntimeFormat] = useState(props.exportFormat);
    const [busy, setBusy] = useState(false);
    const [noticeState, setNoticeState] = useState<NoticeState>("idle");
    const [autoDelayElapsed, setAutoDelayElapsed] = useState(false);
    const clickGuard = useRef(false);
    const autoExportTriggeredRef = useRef(false);
    const exportContentRef = useRef<(trigger?: "manual" | "auto") => void>(() => undefined);
    const activeAction = useRef<"currentView" | "fullData" | "currentViewWord" | "fullDataWord" | "postExport">();
    const observedExecuting = useRef(false);
    const pendingPostExport = useRef<{ key: string; stage: "waitingStart" | "waitingFinish" | "scheduled" | "running" }>();
    const startTimer = useRef<number>();
    const postTimer = useRef<number>();
    const successNoticeTimer = useRef<number>();
    const captureAbort = useRef<AbortController>();
    const mounted = useRef(true);
    const mountEnvironment = useRef({ visibilityState: document.visibilityState,
        hasFocus: typeof document.hasFocus === "function" ? document.hasFocus() : undefined });
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
                if (props.debugMode) console.info("HtmlPdfExportView background export", { currentViewActionCompleted: true });
                pending.stage = "scheduled";
                postTimer.current = window.setTimeout(() => {
                    if (pendingPostExport.current !== pending || pending.stage !== "scheduled") return;
                    const postAction = postActionRef.current;
                    if (!postAction || !postAction.canExecute || postAction.isExecuting) {
                        setExportError("Open Generated File Action is not ready. The PDF may already be stored.");
                        finishExport("error");
                        return;
                    }
                    pending.stage = "running";
                    activeAction.current = "postExport";
                    observedExecuting.current = false;
                    try {
                        if (props.debugMode) console.info("HtmlPdfExportView background export", { postExportActionStarted: true });
                        postAction.execute({ ExportKey: pending.key });
                        startTimer.current = window.setTimeout(() => {
                            if (pendingPostExport.current !== pending || observedExecuting.current) return;
                            setExportError("Open Generated File Action did not start. The PDF may already be stored.");
                            finishExport("error");
                        }, 30_000);
                    }
                    catch (error) {
                        setExportError("Open Generated File Action failed. The PDF may already be stored.");
                        if (props.debugMode) console.error("HtmlPdfExportView post-export action failed", error);
                        finishExport("error");
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
            if (observedExecuting.current && !isExecuting) {
                if (props.debugMode) console.info("HtmlPdfExportView background export", { postExportActionCompleted: true });
                finishExport("success");
            }
            return;
        }
        if (observedExecuting.current && !isExecuting) finishExport("success");
        const fallback = window.setTimeout(() => {
            if (!observedExecuting.current) finishExport("success");
        }, 1500);
        return () => window.clearTimeout(fallback);
    });

    function transitionNotice(state: NoticeState): void {
        if (successNoticeTimer.current !== undefined) window.clearTimeout(successNoticeTimer.current);
        successNoticeTimer.current = undefined;
        setNoticeState(state);
        if (props.debugMode) console.info("HtmlPdfExportView notice", { noticeState: state });
        if (state === "success") {
            const duration = Number.isFinite(props.successNoticeDurationMs)
                ? Math.max(0, Math.min(10_000, props.successNoticeDurationMs)) : 1500;
            successNoticeTimer.current = window.setTimeout(() => {
                successNoticeTimer.current = undefined;
                if (mounted.current) setNoticeState("idle");
            }, duration);
        }
    }

    function finishExport(outcome: "success" | "error" | "idle" = "success"): void {
        if (startTimer.current !== undefined) window.clearTimeout(startTimer.current);
        if (postTimer.current !== undefined) window.clearTimeout(postTimer.current);
        startTimer.current = undefined;
        postTimer.current = undefined;
        pendingPostExport.current = undefined;
        clickGuard.current = false;
        activeAction.current = undefined;
        observedExecuting.current = false;
        setBusy(false);
        transitionNotice(outcome);
    }

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            captureAbort.current?.abort();
            if (startTimer.current !== undefined) window.clearTimeout(startTimer.current);
            if (postTimer.current !== undefined) window.clearTimeout(postTimer.current);
            if (successNoticeTimer.current !== undefined) window.clearTimeout(successNoticeTimer.current);
        };
    }, []);

    const exportContent = useCallback(async (trigger: "manual" | "auto" = "manual") => {
        if (clickGuard.current) return;
        clickGuard.current = true;
        if (trigger === "manual" && props.autoExportOnLoad) autoExportTriggeredRef.current = true;
        const exportKey = createExportKey();
        if (format === "pdf") transitionNotice("processing");
        setBusy(true);
        setExportError(undefined);
        if (trigger === "auto" && scope === "currentView" && rootRef.current) {
            captureAbort.current?.abort();
            const controller = new AbortController();
            captureAbort.current = controller;
            const stability = await waitForCaptureStability(rootRef.current, 1500, controller.signal);
            if (props.debugMode) console.info("HtmlPdfExportView background export", {
                autoExportStarted: true, autoExportDelayMs: props.autoExportDelayMs,
                documentVisibilityStateAtMount: mountEnvironment.current.visibilityState,
                documentVisibilityStateAtCapture: document.visibilityState,
                documentHasFocusAtMount: mountEnvironment.current.hasFocus,
                documentHasFocusAtCapture: typeof document.hasFocus === "function" ? document.hasFocus() : undefined,
                rafFallbackUsed: stability.rafFallbackUsed, rafFallbackCount: stability.rafFallbackCount,
                layoutSettleDurationMs: stability.layoutSettleDurationMs, captureStarted: !stability.cancelled
            });
            if (!mounted.current) return;
            if (stability.cancelled || !rootRef.current) { finishExport("idle"); return; }
        }
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
                finishExport("error");
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
            let geometryDiagnostics: GeometryDiagnostics | undefined;
            let polishResult: PdfVisualPolishResult | undefined;
            let corporateResult: CorporatePrintDiagnostics | undefined;
            const pdfVisualPolish: PdfVisualPolishOptions | undefined = format === "pdf" ? {
                hideScrollbarsInExport: props.hideScrollbarsInExport !== false,
                expandRenderedScrollContent: props.expandRenderedScrollContent !== false,
                trimViewportWhitespace: props.trimViewportWhitespace !== false
            } : undefined;
            const corporatePrintLayout: CorporatePrintLayoutOptions | undefined = format === "pdf" ? {
                orientation,
                horizontalMarginMm: props.horizontalPageMarginMm ?? 10,
                verticalMarginMm: props.verticalPageMarginMm ?? 12,
                smartPageBreaks: props.smartPageBreaks !== false,
                meaningfulSourceWidth: geometry.width,
                meaningfulSourceHeight: geometry.height
            } : undefined;
            const clone = cloneExportRoot(rootRef.current, { includeImages: props.includeImages,
                appearanceMode: format === "word" ? "cleanReport" : appearance,
                pdfVisualPolish,
                corporatePrintLayout,
                onCorporatePrintLayout: result => { corporateResult = result; },
                onVisualPolish: result => { polishResult = result; },
                onGeometryDiagnostics: diagnostics => { geometryDiagnostics = diagnostics; } });
            if (format === "pdf" && appearance === "exactView" && geometryDiagnostics &&
                (geometryDiagnostics.visibleTextElementsAfter < geometryDiagnostics.visibleTextElementsBefore ||
                 geometryDiagnostics.visibleCharactersAfter < geometryDiagnostics.visibleCharactersBefore ||
                 geometryDiagnostics.runtimeValueCountAfter < geometryDiagnostics.runtimeValueCountBefore)) {
                throw new Error("Exact View capture lost visible report content before PDF generation.");
            }
            if (format === "word") normalizeWordSemantics(clone);
            const html = buildHtmlDocument(clone, { includeStyles: props.includeStyles,
                appearanceMode: format === "word" ? "cleanReport" : appearance, pdfVisualPolish,
                corporatePrintLayout: corporateResult }, {
                sourceWidth: geometry.width,
                sourceHeight: geometry.height,
                orientation
            });
            if (props.debugMode) {
                console.info("HtmlPdfExportView captured", {
                    bytes: new Blob([html]).size,
                    appearanceMode: appearance,
                    exportScope: scope,
                    sourceWidth: geometry.width,
                    sourceHeight: geometry.height,
                    captureRootClientWidth: geometryDiagnostics?.captureRootClientWidth,
                    captureRootClientHeight: geometryDiagnostics?.captureRootClientHeight,
                    captureRootScrollWidth: geometryDiagnostics?.captureRootScrollWidth,
                    captureRootScrollHeight: geometryDiagnostics?.captureRootScrollHeight,
                    meaningfulContentWidth: geometryDiagnostics?.meaningfulContentWidth,
                    meaningfulContentHeight: geometryDiagnostics?.meaningfulContentHeight,
                    visibleTextElementsBefore: geometryDiagnostics?.visibleTextElementsBefore,
                    visibleTextElementsAfter: geometryDiagnostics?.visibleTextElementsAfter,
                    visibleCharactersBefore: geometryDiagnostics?.visibleCharactersBefore,
                    visibleCharactersAfter: geometryDiagnostics?.visibleCharactersAfter,
                    runtimeValueCountBefore: geometryDiagnostics?.runtimeValueCountBefore,
                    runtimeValueCountAfter: geometryDiagnostics?.runtimeValueCountAfter,
                    clippedTextElementCount: geometryDiagnostics?.clippedTextElementCount,
                    elementsOutsideParentBounds: geometryDiagnostics?.elementsOutsideParentBounds,
                    collapsedParentCount: geometryDiagnostics?.collapsedParentCount,
                    overflowContainersExpanded: geometryDiagnostics?.overflowContainersExpanded,
                    viewportContainersNormalized: geometryDiagnostics?.viewportContainersNormalized,
                    scrollContainersFound: geometryDiagnostics?.scrollContainersFound,
                    unsafeScrollContainers: geometryDiagnostics?.unsafeScrollContainers,
                    scrollbarsHidden: polishResult?.scrollbarsHidden,
                    resizeGripsRemoved: polishResult?.resizeGripsRemoved,
                    trimmedTrailingWhitespace: geometryDiagnostics?.trimmedTrailingWhitespace,
                    paperOrientation: corporateResult?.paperOrientation,
                    paperWidthMm: corporateResult?.paperWidthMm,
                    paperHeightMm: corporateResult?.paperHeightMm,
                    horizontalMarginMm: corporateResult?.horizontalMarginMm,
                    verticalMarginMm: corporateResult?.verticalMarginMm,
                    printableWidth: corporateResult?.printableWidth,
                    printableHeight: corporateResult?.printableHeight,
                    meaningfulSourceWidth: corporateResult?.meaningfulSourceWidth,
                    meaningfulSourceHeight: corporateResult?.meaningfulSourceHeight,
                    finalScale: corporateResult?.finalScale,
                    logicalSectionsFound: corporateResult?.logicalSectionsFound,
                    keepWithNextGroups: corporateResult?.keepWithNextGroups,
                    avoidBreakBlocks: corporateResult?.avoidBreakBlocks,
                    forcedBreaksInserted: corporateResult?.forcedBreaksInserted,
                    oversizeBlocksAllowedToSplit: corporateResult?.oversizeBlocksAllowedToSplit,
                    tableHeaderGroups: corporateResult?.tableHeaderGroups,
                    orphanBreaksPrevented: corporateResult?.orphanBreaksPrevented,
                    chromiumViewportWidth: geometry.width,
                    printablePageWidth: corporateResult?.printableWidth
                });
            }
            if (format === "word" && props.onWordExport) {
                props.onWordExport.execute({ HtmlContent: html, Orientation: orientation });
                activeAction.current = "currentViewWord";
            } else if (format === "pdf" && props.onExport) {
                if (props.openGeneratedFileAfterExport) pendingPostExport.current = { key: exportKey, stage: "waitingStart" };
                props.onExport.execute({ HtmlContent: html, ExportKey: exportKey });
                activeAction.current = "currentView";
                if (props.debugMode) console.info("HtmlPdfExportView background export", { currentViewActionStarted: true });
                if (props.openGeneratedFileAfterExport) {
                    startTimer.current = window.setTimeout(() => {
                        if (pendingPostExport.current?.key !== exportKey || pendingPostExport.current.stage !== "waitingStart") return;
                        setExportError("Current View export action did not start. No file-open action was run.");
                        finishExport("error");
                    }, 30_000);
                }
            } else {
                const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
                const link = document.createElement("a");
                link.href = url;
                link.download = props.fileName || "export.html";
                link.click();
                URL.revokeObjectURL(url);
                finishExport("success");
            }
        } catch (error) {
            const technicalMessage = error instanceof Error ? error.message : "Current View export failed.";
            setExportError(/Current View export action|Open Generated File Action|export content/i.test(technicalMessage) ? technicalMessage : userMessage(technicalMessage));
            if (props.debugMode) console.error("HtmlPdfExportView Current View export failed", { format, message: technicalMessage });
            finishExport("error");
        }
    }, [props, appearance, scope, orientation, format, fullDataConfigured]);

    exportContentRef.current = exportContent;
    useEffect(() => {
        if (!props.autoExportOnLoad || autoExportTriggeredRef.current) return;
        if (format === "pdf") transitionNotice("processing");
        const delay = Number.isFinite(props.autoExportDelayMs) ? Math.max(0, Math.min(10_000, props.autoExportDelayMs)) : 500;
        const timeout = window.setTimeout(() => setAutoDelayElapsed(true), delay);
        return () => window.clearTimeout(timeout);
    }, [props.autoExportOnLoad, props.autoExportDelayMs, format]);

    const currentViewAction = format === "word" ? props.onWordExport : props.onExport;
    useEffect(() => {
        if (!props.autoExportOnLoad || !autoDelayElapsed || autoExportTriggeredRef.current) return;
        if (scope !== "currentView") {
            autoExportTriggeredRef.current = true;
            setExportError("Auto Export On Load supports Current View only.");
            transitionNotice("error");
            return;
        }
        if (!currentViewAction) {
            autoExportTriggeredRef.current = true;
            setExportError("Configure the Current View export action before enabling Auto Export On Load.");
            transitionNotice("error");
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
        {props.showProcessingNotice !== false && format === "pdf" && noticeState !== "idle" &&
            <div className={`html-pdf-export-notice html-pdf-export-notice--${noticeState}`}
                data-html-pdf-export-exclude="true" role="status"
                aria-live={noticeState === "error" ? "assertive" : "polite"} aria-atomic="true">
                <span className="html-pdf-export-notice__icon" aria-hidden="true">
                    {noticeState === "processing" ? <span className="html-pdf-export-notice__spinner" />
                        : noticeState === "success" ? "✓" : "!"}
                </span>
                <div><p className="html-pdf-export-notice__title">{noticeState === "processing"
                    ? props.processingNoticeTitle || "PDF'iniz hazırlanıyor..."
                    : noticeState === "success" ? props.successNoticeTitle || "PDF hazırlandı"
                    : props.errorNoticeTitle || "PDF oluşturulamadı"}</p>
                <p className="html-pdf-export-notice__message">{noticeState === "processing"
                    ? props.processingNoticeMessage || "Lütfen işlem tamamlanana kadar bu sekmeden ayrılmayınız. PDF hazır olduğunda dosyanız otomatik olarak açılacaktır."
                    : noticeState === "success" ? props.successNoticeMessage || "Dosyanız açılıyor..."
                    : props.errorNoticeMessage || "İşlem sırasında bir hata oluştu. Lütfen tekrar deneyiniz."}</p></div>
            </div>}
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
