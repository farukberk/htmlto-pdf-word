const CELL_ROLES = "[role='columnheader'],[role='gridcell'],[role='cell']";
const INTERACTION_ONLY = "[aria-hidden='true'],[data-html-pdf-clean-filter-shell='true'],[data-html-pdf-clean-neutralized='true']";

/** Converts cleaned browser-only layout structures into semantic HTML for editable DOCX rendering. */
export function normalizeWordSemantics(root: Element): void {
    const candidates = Array.from(root.querySelectorAll("[role='grid'],[role='table'],.widget-datagrid"));
    candidates.filter(candidate => !candidate.closest("table") && root.contains(candidate)).forEach(convertGrid);
    convertHorizontalForms(root);
}

function convertGrid(grid: Element): void {
    const rows = Array.from(grid.querySelectorAll("[role='row'],.tr"))
        .filter(row => row.closest("[role='grid'],[role='table'],.widget-datagrid") === grid)
        .filter(row => !row.matches(INTERACTION_ONLY) && !row.closest(INTERACTION_ONLY));
    const normalized = rows.map(row => ({ row, cells: orderedCells(row) })).filter(item => item.cells.length > 0);
    if (!normalized.length) return;
    const headerIndex = normalized.findIndex(item => item.cells.some(cell => cell.getAttribute("role") === "columnheader" || cell.matches(".th,.column-header")));
    const expectedColumns = normalized[headerIndex >= 0 ? headerIndex : 0].cells.length;
    if (expectedColumns < 2) return;

    const table = document.createElement("table");
    table.setAttribute("data-html-pdf-word-grid", "true");
    table.className = `${grid.className || ""} html-pdf-word-table`.trim();
    appendColumnWidths(table, grid, expectedColumns);
    const head = document.createElement("thead"), body = document.createElement("tbody");
    normalized.forEach((item, index) => {
        if (item.cells.length !== expectedColumns) return;
        const outputRow = document.createElement("tr");
        const isHeader = index === headerIndex;
        item.cells.forEach(cell => {
            const outputCell = document.createElement(isHeader ? "th" : "td");
            copyRepresentableCell(cell, outputCell);
            outputRow.append(outputCell);
        });
        (isHeader ? head : body).append(outputRow);
    });
    if (head.children.length) table.append(head);
    if (body.children.length) table.append(body);
    grid.replaceWith(table);
}

function orderedCells(row: Element): Element[] {
    const cells = Array.from(row.querySelectorAll(CELL_ROLES + ",.th,.td"))
        .filter(cell => cell.closest("[role='row'],.tr") === row)
        .filter(cell => !cell.matches(INTERACTION_ONLY) && !cell.closest(INTERACTION_ONLY));
    return cells.map((cell, domIndex) => ({ cell, domIndex, col: positiveInteger(cell.getAttribute("aria-colindex")) }))
        .sort((a, b) => (a.col ?? Number.MAX_SAFE_INTEGER) - (b.col ?? Number.MAX_SAFE_INTEGER) || a.domIndex - b.domIndex)
        .map(item => item.cell);
}

function positiveInteger(value: string | null): number | undefined {
    const parsed = Number(value); return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function copyRepresentableCell(source: Element, target: HTMLElement): void {
    target.innerHTML = source.innerHTML;
    if (source instanceof HTMLElement) {
        for (const property of ["color", "backgroundColor", "textAlign", "fontWeight", "fontStyle", "textDecoration"]) {
            const value = source.style[property as keyof CSSStyleDeclaration];
            if (typeof value === "string" && value) (target.style as unknown as Record<string, string>)[property] = value;
        }
    }
}

function appendColumnWidths(table: HTMLTableElement, grid: Element, count: number): void {
    const template = grid instanceof HTMLElement ? grid.style.gridTemplateColumns : "";
    const tracks = template && !/[()]/.test(template) ? template.trim().split(/\s+/) : [];
    if (tracks.length !== count) return;
    const values = tracks.map(track => Number.parseFloat(track));
    if (values.some(value => !Number.isFinite(value) || value <= 0)) return;
    const total = values.reduce((sum, value) => sum + value, 0), colgroup = document.createElement("colgroup");
    values.forEach(value => { const col = document.createElement("col"); col.style.width = `${value / total * 100}%`; colgroup.append(col); });
    table.append(colgroup);
}

function convertHorizontalForms(root: Element): void {
    const groups = Array.from(root.querySelectorAll("[data-word-form-layout],.form-horizontal,.mx-layoutgrid"));
    groups.filter(group => !group.closest("table") && root.contains(group)).forEach(group => {
        const containers = formFieldContainers(group);
        const fields = containers.map(extractField).filter((field): field is Field => field !== undefined);
        if (fields.length < 2 || fields.length !== containers.length) return;
        const table = document.createElement("table"); table.setAttribute("data-html-pdf-word-form", "true"); table.style.borderCollapse = "collapse";
        const headRow = document.createElement("tr"), valueRow = document.createElement("tr");
        fields.forEach(field => {
            const th = document.createElement("th"); th.textContent = field.caption; th.style.border = "0";
            const td = document.createElement("td"); td.style.border = "0"; td.append(...Array.from(field.value.childNodes).map(node => node.cloneNode(true)));
            headRow.append(th); valueRow.append(td);
        });
        const head = document.createElement("thead"), body = document.createElement("tbody"); head.append(headRow); body.append(valueRow); table.append(head, body); group.replaceWith(table);
    });
}

function formFieldContainers(group: Element): Element[] {
    const direct = Array.from(group.children);
    if (direct.length >= 2 && direct.every(child => extractField(child))) return direct;
    if (direct.length === 1) {
        const nested = Array.from(direct[0].children);
        if (nested.length >= 2 && nested.every(child => extractField(child))) return nested;
    }
    const known = Array.from(group.querySelectorAll(":scope .form-group,:scope .mx-layoutgrid-col,:scope [data-word-field]"))
        .filter(candidate => !candidate.querySelector(".form-group .form-group,.mx-layoutgrid-col .mx-layoutgrid-col,[data-word-field] [data-word-field]"));
    return known;
}

interface Field { caption: string; value: Element }
function extractField(container: Element): Field | undefined {
    const label = container.querySelector("label,.control-label,[data-word-label]");
    const value = container.querySelector(".html-pdf-static-value,[data-word-value]");
    const caption = label?.textContent?.trim();
    return caption && value ? { caption, value } : undefined;
}
