/**
 * This file was generated from HtmlPdfExportView.xml
 * WARNING: All changes made to this file will be overwritten
 * @author Mendix Widgets Framework Team
 */
import { ActionValue, DynamicValue, Option } from "mendix";
import { ComponentType, CSSProperties, ReactNode } from "react";
import { Big } from "big.js";

export type ExportFormatEnum = "pdf" | "word";

export type AppearanceModeEnum = "exactView" | "cleanReport";

export type ExportScopeEnum = "currentView" | "allFiltered" | "selected";

export type PdfOrientationEnum = "portrait" | "landscape" | "auto";

export type BatchModeEnum = "off" | "auto" | "always";

export interface HtmlPdfExportViewContainerProps {
    name: string;
    class: string;
    style?: CSSProperties;
    tabIndex?: number;
    content: ReactNode;
    exportFormat: ExportFormatEnum;
    appearanceMode: AppearanceModeEnum;
    exportScope: ExportScopeEnum;
    pdfOrientation: PdfOrientationEnum;
    horizontalPageMarginMm: number;
    verticalPageMarginMm: number;
    smartPageBreaks: boolean;
    hideScrollbarsInExport: boolean;
    expandRenderedScrollContent: boolean;
    trimViewportWhitespace: boolean;
    showExportButton: boolean;
    autoExportOnLoad: boolean;
    autoExportDelayMs: number;
    showProcessingNotice: boolean;
    processingNoticeTitle: string;
    processingNoticeMessage: string;
    successNoticeTitle: string;
    successNoticeMessage: string;
    errorNoticeTitle: string;
    errorNoticeMessage: string;
    successNoticeDurationMs: number;
    openGeneratedFileAfterExport: boolean;
    onAfterExport?: ActionValue<{ ExportKey: Option<string> }>;
    buttonCaption: string;
    showRuntimeAppearanceSelector: boolean;
    showRuntimeScopeSelector: boolean;
    showRuntimeOrientationSelector: boolean;
    showRuntimeFormatSelector: boolean;
    onExport?: ActionValue<{ HtmlContent: Option<string>; ExportKey: Option<string> }>;
    onWordExport?: ActionValue<{ HtmlContent: Option<string>; Orientation: Option<string> }>;
    fullDataJson?: DynamicValue<string>;
    fullDataTemplate?: DynamicValue<string>;
    onFullDataExport?: ActionValue<{
        ReportJson: Option<string>;
        TemplateContent: Option<string>;
        ExportScope: Option<string>;
        BatchMode: Option<string>;
        BatchSize: Option<Big>;
        BatchCollectionPath: Option<string>;
    }>;
    onFullDataWordExport?: ActionValue<{
        ReportJson: Option<string>;
        TemplateContent: Option<string>;
        ExportScope: Option<string>;
        Orientation: Option<string>;
    }>;
    batchMode: BatchModeEnum;
    batchSize: number;
    batchCollectionPath: string;
    fileName: string;
    includeStyles: boolean;
    includeImages: boolean;
    debugMode: boolean;
}

export interface HtmlPdfExportViewPreviewProps {
    /**
     * @deprecated Deprecated since version 9.18.0. Please use class property instead.
     */
    className: string;
    class: string;
    style: string;
    styleObject?: CSSProperties;
    readOnly: boolean;
    renderMode: "design" | "xray" | "structure";
    translate: (text: string) => string;
    content: { widgetCount: number; renderer: ComponentType<{ children: ReactNode; caption?: string }> };
    exportFormat: ExportFormatEnum;
    appearanceMode: AppearanceModeEnum;
    exportScope: ExportScopeEnum;
    pdfOrientation: PdfOrientationEnum;
    horizontalPageMarginMm: number | null;
    verticalPageMarginMm: number | null;
    smartPageBreaks: boolean;
    hideScrollbarsInExport: boolean;
    expandRenderedScrollContent: boolean;
    trimViewportWhitespace: boolean;
    showExportButton: boolean;
    autoExportOnLoad: boolean;
    autoExportDelayMs: number | null;
    showProcessingNotice: boolean;
    processingNoticeTitle: string;
    processingNoticeMessage: string;
    successNoticeTitle: string;
    successNoticeMessage: string;
    errorNoticeTitle: string;
    errorNoticeMessage: string;
    successNoticeDurationMs: number | null;
    openGeneratedFileAfterExport: boolean;
    onAfterExport: {} | null;
    buttonCaption: string;
    showRuntimeAppearanceSelector: boolean;
    showRuntimeScopeSelector: boolean;
    showRuntimeOrientationSelector: boolean;
    showRuntimeFormatSelector: boolean;
    onExport: {} | null;
    onWordExport: {} | null;
    fullDataJson: string;
    fullDataTemplate: string;
    onFullDataExport: {} | null;
    onFullDataWordExport: {} | null;
    batchMode: BatchModeEnum;
    batchSize: number | null;
    batchCollectionPath: string;
    fileName: string;
    includeStyles: boolean;
    includeImages: boolean;
    debugMode: boolean;
}
