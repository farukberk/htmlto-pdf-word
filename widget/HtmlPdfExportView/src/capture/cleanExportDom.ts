const GRID_ROOT = ".widget-datagrid";

const FILTER_ROOT = ".widget-datagrid-header.header-filters,.header-filters";
const SAFE_CHROME = [
    ".widget-datagrid-top-bar",
    ".widget-datagrid-footer",
    ".widget-datagrid-paging-top",
    ".widget-datagrid-paging-bottom",
    ".pagination-bar",
    ".paging-status",
    ".widget-datagrid-select-all-bar",
    ".widget-datagrid-selection-counter",
    ".column-selector",
    ".column-resizer",
    ".column-resizer-bar"
].join(",");
const SORT_INDICATOR = ".mx-datagrid-sort-icon,[data-datagrid-sort-icon]";
const FILTER_COMPONENT = [
    ".filter", ".filter-container", ".filter-selector",
    ".widget-datagrid-text-filter", ".widget-datagrid-number-filter", ".widget-datagrid-date-filter",
    ".widget-datagrid-dropdown-filter", ".widget-dropdown-filter",
    "[data-testid*='filter']", "[data-widget*='filter']"
].join(",");
const ICON_SELECTOR = "svg,img,i,.glyphicon,.mx-icon-filled,.mx-icon-lined";
const INTERACTIVE_SELECTOR = "button,a,[role='button'],input,select,textarea";
const STRUCTURAL_SELECTOR = [
    ".tr", ".th", ".td", ".td-text", ".td-custom-content", ".widget-datagrid-col-select",
    "[role='row']", "[role='gridcell']", "[role='columnheader']", "[role='rowheader']"
].join(",");
const GRID_MATRIX_PARENT = [
    ".widget-datagrid-grid-head", ".widget-datagrid-grid-body", ".widget-datagrid-header",
    ".header-filters", ".tr", "[role='row']"
].join(",");

export type ExportAppearanceMode = "exactView" | "cleanReport";

export function cleanExportDom(root: Element, appearanceMode: ExportAppearanceMode): void {
    root.querySelectorAll('[data-html-pdf-export-exclude="true"],[data-html-pdf-export-control="true"]')
        .forEach(element => element.remove());

    if (appearanceMode === "exactView") return;
    root.classList.add("html-pdf-clean-report");

    convertBusinessControls(root);

    root.querySelectorAll(GRID_ROOT).forEach(grid => {
        grid.querySelectorAll(FILTER_ROOT).forEach(filter => {
            clearFilterRow(filter);
        });
        Array.from(grid.querySelectorAll(FILTER_COMPONENT)).forEach(filter => {
            if (!grid.contains(filter) || filter.closest(FILTER_ROOT)) return;
            clearFilterComponent(filter);
        });
        grid.querySelectorAll(SORT_INDICATOR).forEach(removeOrNeutralize);
        grid.querySelectorAll(".column-header").forEach(cleanSortHeader);
        grid.querySelectorAll("input[type='checkbox'],input[type='radio']").forEach(neutralizeInteractive);
        grid.querySelectorAll(INTERACTIVE_SELECTOR).forEach(element => {
            if (isIconOnlyControl(element)) neutralizeInteractive(element);
        });
        grid.querySelectorAll(SAFE_CHROME).forEach(removeOrNeutralize);
    });
    root.querySelectorAll("button,input[type='button'],input[type='submit'],[role='button']")
        .forEach(element => {
            if (!element.closest(GRID_ROOT) && isApplicationAction(element)) element.remove();
        });
}

function convertBusinessControls(root: Element): void {
    const controls = Array.from(root.querySelectorAll("input,textarea,select"))
        .filter(control => !control.closest(GRID_ROOT));
    const radios = controls.filter((control): control is HTMLInputElement =>
        control instanceof HTMLInputElement && control.type === "radio");
    convertRadioGroups(radios);
    controls.forEach(control => {
        if (!control.isConnected && !root.contains(control)) return;
        if (control instanceof HTMLInputElement && control.type === "radio") return;
        if (control instanceof HTMLInputElement && control.type === "checkbox") {
            replaceWithStatic(control, control.checked
                ? control.dataset.trueCaption || "Yes"
                : control.dataset.falseCaption || "No");
            return;
        }
        if (control instanceof HTMLSelectElement) {
            replaceWithStatic(control, control.selectedIndex >= 0 ? control.options[control.selectedIndex]?.text ?? "" : "");
            return;
        }
        if (control instanceof HTMLTextAreaElement) {
            replaceWithStatic(control, control.value, true);
            return;
        }
        if (control instanceof HTMLInputElement && !["hidden", "button", "submit", "reset", "file", "image"].includes(control.type)) {
            const value = control.dataset.htmlPdfDisplayValue || control.getAttribute("aria-valuetext") || control.value;
            replaceWithStatic(control, value);
        }
    });
}

function convertRadioGroups(radios: HTMLInputElement[]): void {
    const groups = new Map<string, HTMLInputElement[]>();
    radios.forEach((radio, index) => {
        const key = radio.name || `__unnamed_${index}`;
        groups.set(key, [...groups.get(key) ?? [], radio]);
    });
    groups.forEach(group => {
        const selected = group.find(radio => radio.checked);
        if (!selected) { group.forEach(removeRadioOption); return; }
        const label = associatedRadioLabel(selected);
        const caption = selected.dataset.htmlPdfCaption || selected.getAttribute("aria-label") || labelText(label, selected) ||
            wrapperCaption(selected) || selected.value;
        const container = radioValueContainer(selected, group);
        if (container) {
            const legend = container instanceof HTMLFieldSetElement ? container.querySelector(":scope > legend")?.cloneNode(true) : null;
            container.replaceChildren();
            if (legend) container.append(legend);
            container.append(staticValue(caption));
            container.classList.add("html-pdf-static-choice-group");
        } else {
            group.forEach(removeRadioOption);
            replaceWithStatic(selected, caption);
        }
    });
}

function associatedRadioLabel(radio: HTMLInputElement): Element | null {
    return radio.closest("label") ?? (radio.id
        ? radio.ownerDocument.querySelector(`label[for='${safeSelectorValue(radio.id)}']`)
        : null);
}

function wrapperCaption(radio: HTMLInputElement): string {
    const wrapper = radio.closest("[role='radio'],.radio,.radio-button,.mx-radiogroup-option") ?? radio.parentElement;
    return wrapper ? (wrapper.textContent ?? "").trim() : "";
}

function radioValueContainer(selected: HTMLInputElement, group: HTMLInputElement[]): Element | null {
    const explicit = selected.closest(".mx-radiogroup,[role='radiogroup'],[data-radio-group],.radio-group,.radiobuttons");
    if (explicit) return explicit;
    let candidate: Element | null = selected.parentElement;
    while (candidate && group.some(radio => !candidate!.contains(radio))) candidate = candidate.parentElement;
    return candidate?.matches("body,html,[data-html-pdf-export-view='true']") ? null : candidate;
}

function removeRadioOption(radio: HTMLInputElement): void {
    const label = associatedRadioLabel(radio);
    const wrapper = radio.closest("label,[role='radio'],.radio,.radio-button,.mx-radiogroup-option");
    if (wrapper) wrapper.remove();
    else { radio.remove(); label?.remove(); }
}

function replaceWithStatic(control: Element, value: string, multiline = false): void {
    const replacement = staticValue(value);
    if (control instanceof HTMLElement) {
        replacement.className = `${control.className} html-pdf-static-value`.trim();
        replacement.style.cssText = control.style.cssText;
        applyStaticValueStyle(replacement);
    }
    replacement.dataset.htmlPdfSourceControl = control instanceof HTMLInputElement ? control.type : control.tagName.toLowerCase();
    if (multiline) replacement.style.whiteSpace = "pre-wrap";
    control.replaceWith(replacement);
}

function staticValue(value: string): HTMLSpanElement {
    const replacement = document.createElement("span");
    replacement.className = "html-pdf-static-value";
    replacement.textContent = value;
    applyStaticValueStyle(replacement);
    return replacement;
}

function applyStaticValueStyle(replacement: HTMLElement): void {
    replacement.style.background = "transparent";
    replacement.style.border = "0";
    replacement.style.boxShadow = "none";
    replacement.style.color = "inherit";
    replacement.style.font = "inherit";
    replacement.style.display = "block";
    replacement.style.minWidth = "0";
    replacement.style.overflowWrap = "anywhere";
}

function collapseFilterShell(filter: Element): void {
    filter.setAttribute("data-html-pdf-clean-filter-shell", "true");
    for (const element of [filter, ...Array.from(filter.children)]) {
        if (!(element instanceof HTMLElement)) continue;
        element.style.background = "transparent";
        element.style.border = "0";
        element.style.boxShadow = "none";
        element.style.paddingTop = "0";
        element.style.paddingBottom = "0";
        element.style.minHeight = "0";
        element.style.height = "0";
        element.style.overflow = "hidden";
    }
}

function clearFilterRow(filter: Element): void {
    const structuralChildren = Array.from(filter.children);
    if (structuralChildren.length === 0) filter.replaceChildren();
    else structuralChildren.forEach(child => {
        if (child.matches(INTERACTIVE_SELECTOR)) preserveBoxAndHide(child);
        else child.replaceChildren();
        collapseFilterShell(child);
    });
    collapseFilterShell(filter);
}

function clearFilterComponent(filter: Element): void {
    filter.replaceChildren();
    if (isStructural(filter)) collapseFilterShell(filter);
    else filter.remove();
}

function cleanSortHeader(header: Element): void {
    header.classList.remove("clickable");
    header.removeAttribute("aria-sort");
    header.removeAttribute("tabindex");
    if (header instanceof HTMLElement) {
        header.style.cursor = "default";
        header.style.pointerEvents = "none";
    }
    header.querySelectorAll(`${SORT_INDICATOR},button,svg,[class*='sort']`).forEach(element => {
        if (element !== header) element.remove();
    });
}

function isApplicationAction(element: Element): boolean {
    if (element.matches("[data-html-pdf-content='true']") || element.querySelector("[data-html-pdf-business-icon='true']")) return false;
    const text = (element.textContent ?? "").trim().toLowerCase();
    const label = (element.getAttribute("aria-label") ?? "").toLowerCase();
    return element.matches(".mx-button,[data-microflow],[data-nanoflow],[type='button'],[type='submit']") ||
        /\b(export|save|delete|edit|view|next|previous|cancel|test|act|calendar|open)\b/i.test(`${text} ${label}`);
}

function labelText(label: Element | null, control: Element): string {
    if (!label) return "";
    return Array.from(label.childNodes).filter(node => node !== control).map(node => node.textContent ?? "").join(" ").trim();
}

function safeSelectorValue(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function neutralizeInteractive(element: Element): void {
    if (isStructural(element)) preserveBoxAndHide(element);
    else element.remove();
}

function removeOrNeutralize(element: Element): void {
    if (isStructural(element)) preserveBoxAndHide(element);
    else element.remove();
}

function preserveBoxAndHide(element: Element): void {
    element.setAttribute("data-html-pdf-clean-neutralized", "true");
    element.setAttribute("aria-hidden", "true");
    if (element instanceof HTMLElement) {
        element.style.visibility = "hidden";
        element.style.pointerEvents = "none";
    }
    if (element instanceof HTMLInputElement) {
        element.checked = false;
        element.value = "";
    } else if (element instanceof HTMLTextAreaElement) {
        element.value = "";
        element.textContent = "";
    } else if (element instanceof HTMLSelectElement) {
        element.selectedIndex = -1;
    }
}

function isStructural(element: Element): boolean {
    if (element.matches(STRUCTURAL_SELECTOR)) return true;
    if (element.parentElement?.matches(GRID_MATRIX_PARENT)) return true;
    if (element instanceof HTMLElement && (element.style.gridColumn || element.style.gridRow || element.style.gridArea)) return true;
    const parent = element.parentElement;
    if (parent instanceof HTMLElement) {
        const display = getComputedStyle(parent).display;
        if (display === "grid" || display === "inline-grid" || display === "subgrid") return true;
    }
    return false;
}

function isIconOnlyControl(element: Element): boolean {
    if (!element.querySelector(ICON_SELECTOR)) return false;
    const visibleText = Array.from(element.childNodes).map(visibleNodeText).join("").trim();
    return visibleText.length === 0;
}

function visibleNodeText(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
    if (!(node instanceof Element) || node.matches(".sr-only,[aria-hidden='true']")) return "";
    return Array.from(node.childNodes).map(visibleNodeText).join("");
}
