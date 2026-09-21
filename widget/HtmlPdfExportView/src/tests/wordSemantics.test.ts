import { describe, expect, it } from "vitest";
import { normalizeWordSemantics } from "../capture/normalizeWordSemantics";

describe("Word semantic normalization", () => {
    it("converts a realistic ARIA/CSS DataGrid2 into one ordered semantic table", () => {
        document.body.innerHTML = `<div id="root"><div class="widget-datagrid" role="grid" style="grid-template-columns:2fr 4fr 1fr 2fr 1fr">
          <div role="row" class="tr"><div role="columnheader" aria-colindex="3">Amount</div><div role="columnheader" aria-colindex="1">Name</div><div role="columnheader" aria-colindex="2">Description</div><div role="columnheader" aria-colindex="4">Row date</div><div role="columnheader" aria-colindex="5">Active</div></div>
          <div role="row" data-html-pdf-clean-filter-shell="true"><div role="gridcell">Filter</div></div>
          ${row("Test Kaydı 1", "Açıklama çğıöşü", "1250.5")}${row("Test Kaydı 2", "Açıklama çğıöşü", "2500")}${row("Test Kaydı 3", "Açıklama çğıöşü", "9999.99")}
        </div></div>`;
        const root = document.querySelector("#root")!; normalizeWordSemantics(root);
        const table = root.querySelector("table[data-html-pdf-word-grid='true']")!;
        expect(root.querySelectorAll("table")).toHaveLength(1);
        expect(table.querySelectorAll("tr")).toHaveLength(4);
        expect(Array.from(table.querySelectorAll("tr")).every(item => item.children.length === 5)).toBe(true);
        expect(Array.from(table.querySelectorAll("th")).map(cell => cell.textContent)).toEqual(["Name", "Description", "Amount", "Row date", "Active"]);
        expect(Array.from(table.querySelectorAll("tbody tr:first-child td")).map(cell => cell.textContent)).toEqual(["Test Kaydı 1", "Açıklama çğıöşü", "1250.5", "9/12/2026", "Yes"]);
        expect(table.textContent).not.toContain("Filter");
        expect(Array.from(table.querySelectorAll("col")).map(col => col.style.width)).toEqual(["20%", "40%", "10%", "20%", "10%"]);
    });

    it("supports known Mendix structural roles/classes without requiring one generated class", () => {
        document.body.innerHTML = `<div id="root"><div class="widget-datagrid"><div class="tr"><div class="th">A</div><div class="th">B</div></div><div class="tr"><div class="td">1</div><div class="td">2</div></div></div></div>`;
        const root = document.querySelector("#root")!; normalizeWordSemantics(root);
        expect(root.querySelector("table")?.textContent).toBe("AB12");
    });

    it("does not double-convert literal HTML tables", () => {
        document.body.innerHTML = `<div id="root"><table role="table"><tr><th>A</th></tr><tr><td>1</td></tr></table></div>`;
        const root = document.querySelector("#root")!; normalizeWordSemantics(root);
        expect(root.querySelectorAll("table")).toHaveLength(1); expect(root.querySelector("table")?.hasAttribute("data-html-pdf-word-grid")).toBe(false);
    });

    it("converts a structurally clear horizontal cleaned form to a borderless label/value table", () => {
        document.body.innerHTML = `<div id="root"><div class="form-horizontal"><div class="row">
          ${field("Title", "Test Raporu")}${field("Description", "Açıklama")}${field("Document date", "9/12/2026")}${field("Active", "Yes")}${field("Status", "Reddedildi")}
        </div></div></div>`;
        const root = document.querySelector("#root")!; normalizeWordSemantics(root);
        const table = root.querySelector("table[data-html-pdf-word-form='true']")!;
        expect(Array.from(table.querySelectorAll("th")).map(cell => cell.textContent)).toEqual(["Title", "Description", "Document date", "Active", "Status"]);
        expect(Array.from(table.querySelectorAll("td")).map(cell => cell.textContent)).toEqual(["Test Raporu", "Açıklama", "9/12/2026", "Yes", "Reddedildi"]);
        expect(Array.from(table.querySelectorAll("th,td")).every(cell => (cell as HTMLElement).style.border === "0px")).toBe(true);
    });
});

function row(name: string, description: string, amount: string): string {
    return `<div role="row" class="tr"><div role="gridcell" aria-colindex="1">${name}</div><div role="gridcell" aria-colindex="2">${description}</div><div role="gridcell" aria-colindex="3">${amount}</div><div role="gridcell" aria-colindex="4">9/12/2026</div><div role="gridcell" aria-colindex="5">Yes</div></div>`;
}
function field(caption: string, value: string): string { return `<div><label>${caption}</label><span class="html-pdf-static-value">${value}</span></div>`; }
