<!doctype html>
<html lang="tr" data-html-pdf-source-width="1400" data-html-pdf-source-height="900" data-html-pdf-orientation="landscape">
<head><meta charset="UTF-8"><title>${reportTitle?html}</title><style>
@page{size:A4 landscape;margin:8mm}body{font-family:Arial,sans-serif;color:#183153;margin:0}
.header{background:#1261a0;color:#fff;padding:12px;border-bottom:4px solid #19a974}.meta,.section{padding:8px;border:1px solid #b8c2cc;margin:8px 0}
table{width:100%;border-collapse:collapse;font-size:9px}thead{display:table-header-group}th{background:#1261a0;color:white}
th,td{border:1px solid #829ab1;padding:3px;text-align:left}tr{break-inside:avoid;page-break-inside:avoid}.status{color:#087f5b;font-weight:bold}
</style></head><body>
<header class="header"><h1>${reportTitle?html}</h1><div>FullData kapasite ve bütünlük ölçümü</div></header>
<section class="meta">Satır sayısı: ${rowCount} | Tarih: 2026-09-11 | Dil: Türkçe ç Ç ğ Ğ ı İ ö Ö ş Ş ü Ü</section>
<section class="section">Başarılı Çağrı — İstanbul, Şişli — Özgür Güneş</section>
<section class="section">Bu rapor deterministik sentetik veri kullanır; şirket veya proje verisi içermez.</section>
<table><thead><tr><th>Row No</th><th>Name</th><th>Description</th><th>Category</th><th>Amount</th><th>Date</th><th>Status</th></tr></thead><tbody>
<#list rows as row><tr data-stress-row="${row.number}"><td>${row.marker}</td><td>${row.name?html}</td><td>${row.description?html}</td><td>${row.category}</td><td>${row.amount}</td><td>${row.date}</td><td class="status">${row.status}</td></tr>
</#list></tbody></table></body></html>
