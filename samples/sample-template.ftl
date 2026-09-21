<!doctype html>
<html lang="tr">
<head>
<meta charset="UTF-8" />
<title>${title?html}</title>
<style>
@page { size: A4; margin: 12mm; }
body { font-family: sans-serif; color: #222; }
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid #aaa; padding: 5px; text-align: left; }
thead { display: table-header-group; }
tr { break-inside: avoid; page-break-inside: avoid; }
.summary { break-inside: avoid; page-break-inside: avoid; }
</style>
</head>
<body>
<h1>${title?html}</h1>
<section class="summary"><strong>Müşteri:</strong> ${customer.name?html} — ${customer.city?html}</section>
<table><thead><tr><th>No</th><th>Açıklama</th><th>Tutar</th></tr></thead>
<tbody><#list rows as row><tr><td>${row.id}</td><td>${row.description?html}</td><td>${row.amount?string["0.00"]}</td></tr></#list></tbody></table>
</body></html>
