import { createElement, ReactElement } from "react";
import { HtmlPdfExportViewPreviewProps } from "../typings/HtmlPdfExportViewProps";

export function preview(props: HtmlPdfExportViewPreviewProps): ReactElement {
    const Content = props.content.renderer;
    return <div><Content>{null}</Content><div style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
        {props.showRuntimeFormatSelector && <label>Format<select disabled><option>{props.exportFormat === "word" ? "Word" : "PDF"}</option></select></label>}
        {props.showRuntimeAppearanceSelector && <label>Appearance<select disabled><option>Exact View</option></select></label>}
        {props.showRuntimeScopeSelector && <label>Scope<select disabled><option>Current View</option></select></label>}
        {props.showRuntimeOrientationSelector && <label>Orientation<select disabled><option>Portrait</option></select></label>}
        {props.showExportButton && <button type="button">{props.showRuntimeFormatSelector ? "Export" : props.exportFormat === "word" ? "Export Word" : props.buttonCaption || "Export PDF"}</button>}
    </div></div>;
}

export function getPreviewCss(): string { return ""; }
