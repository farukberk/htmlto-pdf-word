<!doctype html>
<html><head><meta charset="UTF-8"><style>
@page { size: A4 landscape; margin: 10mm; }
body { font-family: "DejaVu Sans", Arial, sans-serif; font-size: 8pt; color: #222; }
h1 { font-size: 16pt; margin: 0 0 4mm; }
table { border-collapse: collapse; width: 100%; table-layout: fixed; }
thead { display: table-header-group; } tr { break-inside: avoid; }
th, td { border: 0.2mm solid #aaa; padding: 1.2mm; overflow-wrap: anywhere; }
th { background: #e9eef5; } .number { text-align: right; }
</style></head><body>
<h1>${report.name?html}</h1>
<p>Rows: ${report.rowCount?c} | Generated: ${report.generatedDate?html}</p>
<table><thead><tr><th>Row No</th><th>Name</th><th>Description</th><th>Category</th><th>Amount</th><th>Date</th><th>Status</th></tr></thead><tbody>
<#list rows as row><tr><td class="number">${row.rowNumber?c}</td><td>${row.name?html}</td><td>${row.description?html}</td><td>${row.category?html}</td><td class="number">${row.amount?string["0.00"]}</td><td>${row.rowDate?html}</td><td>${row.status?html}</td></tr></#list>
</tbody></table></body></html>
