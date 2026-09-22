# Mendix HTML → PDF & Word Export

Mendix Studio Pro uygulamalarında mevcut ekranları ve büyük veri setlerini **PDF** veya **Microsoft Word (.docx)** formatına aktarmak için geliştirilmiş, tekrar kullanılabilir bir export altyapısıdır.

Projenin temel amacı; Mendix'in standart document generation yaklaşımından bağımsız olarak:

- mevcut Mendix ekranını mümkün olduğunca görsel yapısını koruyarak PDF'e aktarmak,
- DataGrid2, RichText, form alanları, Atlas, custom SCSS/CSS ve özel layout'ları desteklemek,
- UI pagination sınırından bağımsız şekilde büyük veri setlerini export etmek,
- yüksek veri hacimlerinde batching + PDF merge kullanmak,
- düzenlenebilir Word belgeleri oluşturmak,
- kurumsal `.docx` template'lerine JSON verisi basmak,
- Mendix Studio Pro 10.24.x / Java 21 ortamında tekrar kullanılabilir bir çözüm sunmaktır.

Temel mimari:

```text
Mendix UI / Application Data
            │
            ▼
           HTML
            │
      ┌─────┴─────┐
      ▼           ▼
     PDF         Word
 Chromium     Apache POI
```

PDF ve Word aynı problemi farklı hedeflerle çözer:

- **PDF:** sabit, yazdırılabilir ve görsel sadakati yüksek çıktı
- **Word:** düzenlenebilir, semantik ve native `.docx` çıktı

---

# Proje Durumu

## PDF — Ana / Öncelikli Kullanım

PDF export tarafı projenin şu anki **ana ve doğrulanmış kullanım yoludur**.

Doğrulanmış özellikler:

- Current View PDF
- Exact View
- Clean Report
- A4 Portrait
- A4 Landscape
- Auto orientation
- runtime form state korunması
- DataGrid2 desteği
- RichText desteği
- Atlas / custom SCSS / CSS desteği
- CSS Grid / Flexbox
- SVG / image desteği
- Türkçe karakter desteği
- Current View / All Filtered / Selected export scope
- FullData
- FreeMarker template
- büyük veri batching
- PDFBox ile PDF merge
- 50.000 kayıtlık batched PDF testi
- runtime orientation selector
- runtime appearance selector
- runtime export scope selector
- busy state
- repeated-click protection
- configuration validation
- Studio Pro property help text
- accessibility kontrolleri

PDF tarafı gerçek Studio Pro smoke testleri ve otomatik regression testleri ile doğrulanmıştır.

---

## Word / DOCX — İkincil Özellik

Word export altyapısı projede bulunmaktadır.

Desteklenen özellikler:

- Current View (Editable)
- FullData Word
- native Word paragraphs
- headings
- bold / italic / underline
- gerçek Word listeleri
- native Word tabloları
- images
- hyperlinks
- Türkçe Unicode
- Portrait / Landscape / Auto
- corporate `.docx` templates
- dotted-path placeholders
- repeating table rows
- header/footer preservation
- logo preservation
- Word field preservation

Word tarafının hedefi PDF gibi pixel-perfect görünüm değildir.

Word için amaç:

> Mendix içeriğini düzenlenebilir ve semantik bir Microsoft Word belgesine dönüştürmektir.

### Word doğrulama notu

Gerçek Studio Pro Current View Word testinde Mendix DataGrid2'nin `div + CSS Grid` yapısının ilk sürümde normal paragraflara dönüştüğü görülmüştür.

Bunun için ARIA/Mendix grid yapılarını semantic HTML table'a dönüştüren bir normalizer eklenmiştir.

Otomatik widget ve Java testleri başarılıdır.

Ancak son semantic DataGrid → native Word table düzeltmesi için yeni bir gerçek Studio Pro smoke testi henüz tamamlanmamıştır.

Bu nedenle mevcut kurumsal kullanımda önerilen ana yol:

**PDF**

Word desteği kullanılabilir durumdadır ancak son gerçek Studio Pro doğrulaması tamamlanana kadar ikincil özellik olarak değerlendirilmelidir.

---

# Desteklenen Ortam

Ana geliştirme/test ortamı:

```text
Mendix Studio Pro : 10.24.24
Mendix Tooling    : @mendix/pluggable-widgets-tools@10.24.1
Java              : 21
Platform          : Windows
PDF Renderer      : Microsoft Edge / Google Chrome / Chromium
DOCX Renderer     : Apache POI XWPF 5.4.1
PDF Merge         : Apache PDFBox
Template Engine   : FreeMarker
```

Widget identity:

```text
HtmlPdfExport.HtmlPdfExportView
```

Proje Mendix `10.24.x` ailesi hedeflenerek geliştirilmiştir.

---

# Export Mimarisi

Projede iki ana export yolu vardır:

```text
1. Current View
2. FullData
```

Bu iki yaklaşım bilinçli şekilde birbirinden ayrılmıştır.

---

# 1. Current View

Current View, kullanıcının o anda Mendix ekranında gördüğü ve browser DOM'unda render edilmiş içeriği export eder.

Akış:

```text
Mendix Page
    │
    ▼
Rendered DOM
    │
    ├── Runtime Form State
    ├── Atlas CSS
    ├── Custom SCSS / CSS
    ├── Images / SVG
    └── Widget State
    │
    ▼
Standalone HTML
    │
    ▼
Chromium
    │
    ▼
PDF
```

Current View özellikle aşağıdaki içerikler için uygundur:

- Forms
- DataGrid2
- RichText
- Cards
- Lists
- Images
- SVG
- Custom widgets
- Flex layouts
- CSS Grid
- custom SCSS / CSS
- dashboard yapıları
- rapor ekranları

## Önemli

Current View yalnızca **o anda render edilmiş içeriği** export eder.

Örneğin DataGrid2:

```text
1 - 20 of 500
```

gösteriyorsa Current View browser üzerinden diğer 480 kaydı yüklemeye çalışmaz.

Ekranda render edilmiş olan kayıtlar export edilir.

500 kaydın tamamı gerekiyorsa:

```text
FullData
```

kullanılmalıdır.

---

# Exact View

Exact View, Current View'in en yüksek görsel sadakat modudur.

Amaç:

> Kullanıcının Mendix ekranında gördüğü layout'u PDF'e mümkün olduğunca aynı şekilde aktarmaktır.

Korunmaya çalışılan yapılar:

- layout
- form values
- radio state
- checkbox state
- select values
- textarea values
- date values
- DataGrid2
- filters
- sort controls
- pagination
- actions
- icons
- colors
- backgrounds
- borders
- spacing
- typography
- CSS variables
- Flexbox
- CSS Grid
- Atlas styling
- custom SCSS
- custom CSS

Exact View sırasında canlı Mendix DOM'u değiştirilmez.

Tüm export işlemleri clone üzerinde gerçekleştirilir.

---

# Clean Report

Clean Report, aynı veriyi daha temiz ve rapor odaklı şekilde sunar.

Temel prensip:

```text
Caption
+
Current Value
+
Report Data
```

korunur.

Interaction-only UI temizlenir.

Örneğin Mendix ekranında:

```text
Active

● Yes
○ No
```

varsa Clean Report:

```text
Active

Yes
```

üretir.

Benzer şekilde:

```text
Status

○ Taslak
○ Onaylandı
● Reddedildi
```

yerine:

```text
Status

Reddedildi
```

oluşturulur.

DataGrid2 içinde aşağıdaki application UI elementleri temizlenebilir:

- filters
- filter operators
- sort controls
- selection controls
- pagination
- view/edit/delete actions
- dropdown arrows
- date-picker buttons
- interaction-only icons

Ancak DataGrid2'nin structural CSS Grid hücreleri korunur.

Bu sayede kolon/satır hizasının bozulması engellenir.

Clean Report'un amacı:

> Uygulama ekranını baştan tasarlamak değil, interaction chrome'u kaldırıp okunabilir bir rapor üretmektir.

---

# CSS / SCSS Desteği

Current View export sırasında mümkün olduğunca aşağıdaki stil kaynakları korunur:

- Mendix Atlas
- theme SCSS
- `main.scss`
- custom SCSS
- custom CSS
- widget CSS
- CSS variables
- typography
- colors
- backgrounds
- borders
- spacing
- Flexbox
- CSS Grid

Örneğin uygulamada bulunan:

```text
.report-section
.custom-blue-card
.status-approved
.dg2-first-row-highlight
```

gibi custom class'lar export sırasında korunabilir.

Clean Report CSS'i kaldırmaz.

Temel yaklaşım:

```text
Preserve CSS
Preserve Structure
Staticize Values
Remove Interaction Chrome
```

---

# PDF Rendering

PDF çıktısı local Chromium tabanlı renderer ile oluşturulur.

Desteklenen browser motorları:

- Microsoft Edge
- Google Chrome
- Chromium

Mendix Document Generation kullanılmaz.

Akış:

```text
Standalone HTML
      │
      ▼
Chromium Headless
      │
      ▼
PDF
```

Bu yaklaşım sayesinde modern browser özellikleri desteklenebilir:

- CSS Grid
- Flexbox
- SVG
- modern CSS
- backgrounds
- borders
- web typography
- complex layouts

---

# Chromium Gereksinimi

PDF üretilecek runtime makinesinde aşağıdakilerden biri bulunmalıdır:

```text
Microsoft Edge
Google Chrome
Chromium
```

Renderer local browser'ı otomatik bulmaya çalışır.

Gerekirse browser executable path environment üzerinden verilebilir:

```text
HTML_PDF_CHROMIUM_PATH
```

Örnek Windows path:

```text
C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe
```

İnternet bağlantısı gerekmez.

---

# PDF Orientation

Desteklenen orientation değerleri:

```text
Portrait
Landscape
Auto
```

Varsayılan:

```text
Portrait
```

Exact View sırasında layout önce kaynak genişliğinde oluşturulur.

Sonrasında seçilen A4 yüzeyine proportional scale uygulanır.

Amaç, kağıt genişliği nedeniyle responsive layout'un tekrar hesaplanmasını mümkün olduğunca engellemektir.

Örneğin kaynak ekran:

```text
Title | Description | Date | Active | Status
```

şeklindeyse Portrait PDF'e geçerken mümkün olduğunca:

```text
Title | Description | Date | Active | Status
```

yapısı korunur ve bütün layout küçültülür.

---

# Export Scope

Desteklenen scope'lar:

```text
Current View
All Filtered
Selected
```

## Current View

Browser'da o anda render edilmiş içerik export edilir.

UI pagination arkasındaki kayıtlar otomatik olarak retrieve edilmez.

---

## All Filtered

Host Mendix application filtrelenmiş dataset'in tamamını export engine'e sağlar.

Örnek:

```text
UI:
20 of 438

All Filtered:
438 records
```

Browser pagination butonlarına otomatik olarak basılmaz.

Veri application/backend tarafında hazırlanır.

---

## Selected

Host Mendix application yalnızca seçilmiş kayıtları sağlar.

Widget DataGrid2'nin private/internal selection state'ini reverse-engineer etmeye çalışmaz.

Bu nedenle yapı DataGrid2'ye bağımlı değildir.

---

# 2. FullData

FullData büyük veri export'ları için kullanılır.

Akış:

```text
Mendix Application Data
        │
        ▼
     Report JSON
        │
        ▼
     FreeMarker
        │
        ▼
Standalone HTML
        │
    ┌───┴────┐
    ▼        ▼
   PDF      Word
```

FullData browser DOM'una bağlı değildir.

Örneğin kullanıcı ekranında yalnızca 20 kayıt görünmesine rağmen application 10.000 kayıtlık dataset sağlayabilir.

---

# Report JSON

FullData veri modeli application tarafından belirlenir.

Örnek:

```json
{
  "report": {
    "title": "Monthly Report",
    "generatedDate": "2026-09-12"
  },
  "rows": [
    {
      "name": "Record 1",
      "description": "Example",
      "amount": 1250.50
    }
  ]
}
```

Array adının `rows` olması zorunlu değildir.

Örneğin:

```text
transactions
employees
cases
items
records
data.transactions
report.rows
```

kullanılabilir.

---

# FreeMarker Template

FullData HTML üretimi için FreeMarker kullanılabilir.

Örnek:

```html
<h1>${report.title}</h1>

<table>
    <thead>
        <tr>
            <th>Name</th>
            <th>Description</th>
            <th>Amount</th>
        </tr>
    </thead>

    <tbody>
        <#list rows as row>
            <tr>
                <td>${row.name}</td>
                <td>${row.description}</td>
                <td>${row.amount}</td>
            </tr>
        </#list>
    </tbody>
</table>
```

Bu HTML daha sonra PDF veya Word renderer'a gönderilir.

---

# Büyük Veri / Batching

Tek bir Chromium render işleminin kapasitesi sınırsız değildir.

Bu nedenle FullData PDF tarafında batching desteği bulunmaktadır.

Desteklenen modlar:

```text
Off
Auto
Always
```

Varsayılan:

```text
Auto
```

Varsayılan Batch Size:

```text
5000
```

Akış:

```text
Large Report JSON
      │
      ▼
Split collection
      │
      ├── Batch 1 → HTML → PDF
      ├── Batch 2 → HTML → PDF
      ├── Batch 3 → HTML → PDF
      └── ...
      │
      ▼
PDFBox Merge
      │
      ▼
Single Final PDF
```

Batch PDF'ler kullanıcıya ayrı ayrı verilmez.

Geçici dosyalardır.

Finalde tek bir PDF oluşturulur.

---

# Batch Collection Path

Batch yapılacak JSON array dotted-path ile belirtilir.

Örnek:

```text
rows
```

veya:

```text
report.rows
```

veya:

```text
data.transactions
```

Target property bir JSON array olmalıdır.

Örnek JSON:

```json
{
  "data": {
    "transactions": [
      {},
      {},
      {}
    ]
  }
}
```

Batch Collection Path:

```text
data.transactions
```

---

# Batch Metadata

Her batch için template'e özel metadata verilebilir.

Örnek:

```text
_batch.enabled
_batch.index
_batch.number
_batch.total
_batch.startIndex
_batch.endIndex
_batch.totalRecords
_batch.isFirst
_batch.isLast
```

Örneğin rapor header'ının yalnızca ilk batch'te gösterilmesi:

```ftl
<#if !_batch.enabled || _batch.isFirst>
    <h1>${report.title}</h1>
</#if>
```

---

# PDF Stress Test Sonuçları

Testler local geliştirme ortamında yapılmıştır.

Bu değerler **evrensel garanti değildir**.

Makine, CPU, RAM, Chromium sürümü, HTML complexity ve CSS yapısına göre sonuçlar değişebilir.

## Single Render

| Kayıt | Synthetic | Real JSON |
|---:|---:|---:|
| 100 | 2.2 sn | 2.5 sn |
| 1.000 | 2.6 sn | 3.2 sn |
| 5.000 | 8.9 sn | 9.3 sn |
| 10.000 | 18.6 sn | 23.3 sn |
| 25.000 | 67.9 sn | 76.5 sn |
| 50.000 | FAIL | FAIL |

### Sonuç

```text
25.000 rows:
PASS

50.000 rows:
HTML generation PASS
Chromium PDF generation FAIL
```

HTML üretimi 50.000 kayıt seviyesinde de başarılı olmuştur.

İlk ölçülen darboğaz:

```text
Chromium single PDF rendering
```

olmuştur.

Bu nedenle:

```text
25.000
```

bir universal production limit değildir.

Yalnızca test edilen makinedeki ölçülmüş single-render headroom'dur.

---

# 50.000 Kayıt Batched PDF Testi

Batch configuration:

```text
Batch Size : 5000
Batch Count: 10
```

Sonuç:

```text
50.000 rows
→ 10 × 5.000 batch
→ 10 Chromium render
→ PDFBox merge
→ 1 final PDF
```

Test sonucu:

```text
PASS
```

Toplam süre:

```text
155.291 seconds
```

Yaklaşık:

```text
2 dakika 35 saniye
```

Final PDF boyutu:

```text
79,143,177 bytes
```

Yaklaşık:

```text
75.5 MiB
```

İlk kayıt doğrulaması:

```text
PASS
```

Son kayıt doğrulaması:

```text
PASS
```

Batch order:

```text
PASS
```

---

# Production İçin Önerilen Batch Size

Varsayılan:

```text
5000
```

Bu değer conservative başlangıç noktası olarak seçilmiştir.

Daha küçük değer:

```text
daha düşük render pressure
daha fazla batch
daha uzun toplam süre
```

Daha büyük değer:

```text
daha az batch
daha yüksek Chromium pressure
```

25.000 satırın test ortamında çalışmış olması her production runtime'da 25.000'in güvenli olacağı anlamına gelmez.

---

# Word / DOCX Mimarisi

Word PDF üzerinden üretilmez.

Akış:

```text
Semantic HTML
      │
      ▼
Apache POI XWPF
      │
      ▼
WordprocessingML
      │
      ▼
.docx
```

Hedef:

```text
editable text
editable paragraphs
native tables
native lists
native hyperlinks
images
```

Word çıktısı screenshot değildir.

---

# Word Current View

Current View Word, Exact View yerine daha temiz semantic representation kullanır.

Örneğin:

```text
Active

● Yes
○ No
```

Word tarafında:

```text
Active

Yes
```

olarak aktarılır.

DataGrid2 interaction UI:

```text
filters
sorting
pagination
delete
edit
view
selection
```

Word çıktısına taşınmaz.

---

# Word Stress Test Sonuçları

| Kayıt | Süre | DOCX Boyutu |
|---:|---:|---:|
| 100 | 0.100 sn | 3,957 bytes |
| 1.000 | 0.332 sn | 11,002 bytes |
| 5.000 | 1.974 sn | 41,958 bytes |
| 10.000 | 2.570 sn | 80,068 bytes |
| 25.000 | 9.004 sn | 195,176 bytes |

25.000 kayıt:

```text
PASS
```

İlk/son marker:

```text
PASS
```

Native Word table:

```text
PASS
```

Editability:

```text
PASS
```

Bu sonuçlar Java test fixture'ları üzerinde alınmıştır.

Son Mendix DataGrid semantic normalization düzeltmesi için gerçek Studio Pro smoke testi ayrıca yapılmalıdır.

---

# Corporate Word Template

Kurumsal `.docx` template kullanılabilir.

Örnek placeholder:

```text
{{report.title}}
```

```text
{{customer.name}}
```

Nested dotted path desteklenir.

---

# Repeating Word Table Rows

Bir Word table prototype row içinde:

```text
{{rows[].name}}
{{rows[].description}}
{{rows[].amount}}
```

kullanılabilir.

Engine prototype row'u array elemanları kadar çoğaltır.

Örnek JSON:

```json
{
  "rows": [
    {
      "name": "Record 1",
      "description": "Description 1",
      "amount": "1250.50"
    },
    {
      "name": "Record 2",
      "description": "Description 2",
      "amount": "2500.00"
    }
  ]
}
```

Template içinde:

```text
{{rows[].name}}
{{rows[].description}}
{{rows[].amount}}
```

kullanılır.

---

# Word Template Preservation

Template mode aşağıdaki Word yapılarını korumayı hedefler:

- header
- footer
- logo
- styles
- page fields
- signature areas
- company text
- document formatting

Placeholder'lar yalnızca data lookup yapar.

Java / SpEL / script çalıştırılmaz.

---

# Release Dosyaları

Hazır artifact'ler:

```text
dist/HtmlPdfExport.HtmlPdfExportView.mpk
```

ve:

```text
dist/html-pdf-export-1.0.0-all.jar
```

MPK:

```text
<YourMendixApp>/widgets/
```

altına kopyalanır.

JAR:

```text
<YourMendixApp>/userlib/
```

altına kopyalanır.

---

# Hızlı PDF Kurulumu

PDF kullanmak için minimum entegrasyon:

## 1. Repository'i indir

GitHub:

```text
Code
→ Download ZIP
```

ZIP'i çıkart.

---

## 2. MPK'yi kopyala

```text
dist/HtmlPdfExport.HtmlPdfExportView.mpk
```

dosyasını:

```text
<YourMendixProject>/widgets/
```

altına kopyala.

---

## 3. JAR'ı kopyala

```text
dist/html-pdf-export-1.0.0-all.jar
```

dosyasını:

```text
<YourMendixProject>/userlib/
```

altına kopyala.

Eski HtmlPdfExport JAR sürümleri varsa duplicate bırakma.

---

## 4. Java 21 kontrol et

Studio Pro:

```text
Edit
→ Preferences
→ Deployment
```

altındaki JDK path Java 21 root klasörünü göstermelidir.

Örnek:

```text
C:\Program Files\Eclipse Adoptium\jdk-21.x.x-hotspot
```

`bin` klasörü değil, JDK root path verilmelidir.

---

## 5. Synchronize

Studio Pro:

```text
Synchronize App Directory
```

---

## 6. Clean Deployment

```text
App
→ Clean Deployment Directory
```

---

## 7. Java Action entegrasyonu

PDF için gerekli Java Action'ları Studio Pro içinde oluştur.

`.mpr` dosyasını binary olarak edit etmeyin.

Java Action declaration oluşturulduktan sonra:

```text
App
→ Deploy for Eclipse
```

çalıştırılmalıdır.

Generated Java dosyalarında yalnızca:

```java
// BEGIN USER CODE

// END USER CODE
```

arasında değişiklik yapılmalıdır.

Generated alanları manuel değiştirmeyin.

FullData batching entegrasyonu için:

[FullData Batching Integration](FULLDATA_BATCHING_INTEGRATION.md)

dokümanına bakın.

---

# Word Entegrasyonu

Word Java Action imzaları ve template syntax:

[WORD_DOCX_INTEGRATION.md](WORD_DOCX_INTEGRATION.md)

Studio Pro microflow ve smoke test:

[WORD_STUDIOPRO_SMOKE_TEST.md](WORD_STUDIOPRO_SMOKE_TEST.md)

Word için kullanılan Java Action'lar:

```text
JA_ConvertHtmlToDocx
JA_RenderFullDataToDocx
JA_RenderDocxTemplate
```

---

# Studio Pro Widget Properties

Widget sayfaya eklendikten sonra çift tıklanarak açılan Properties ekranında tüm configurable property'ler için help text bulunmaktadır.

Ana gruplar:

```text
Content
General
PDF
Runtime Export UI
Full Data
Large Exports
Advanced
```

Ana özellikler:

```text
Appearance Mode
Export Scope
PDF Orientation
Export Format
Batch Mode
Batch Size
Batch Collection Path
Debug Mode
```

Runtime selector ayarları:

```text
Show Runtime Appearance Selector
Show Runtime Scope Selector
Show Runtime Orientation Selector
```

Varsayılanlar:

```text
Appearance Mode       : Exact View
Export Scope          : Current View
PDF Orientation       : Portrait

Runtime Appearance    : Off
Runtime Scope         : Off
Runtime Orientation   : On
```

## Automatic Current View export on preview load

For a one-click PDF preview page, let the normal Mendix button open a page containing the widget and report content. Configure **Export Scope = Current View**, **Auto Export On Load = Yes**, **Auto Export Delay (ms) = 500**, **Show Export Button = No**, and map **Current View Export Action** to the HTML-to-PDF microflow. The widget captures after a browser paint and the configured delay, invokes the action once per mount, and does not download an extra `.html` file. Increase the delay for asynchronously rendered content; normal manual exports remain immediate. The widget does not automatically close the preview page.

### Two-stage PDF delivery in Mendix

Some environments abort the HTTP connection when PDF generation and **Download File** run within the same widget-triggered Mendix request. Use separate actions: Current View capture → generate and commit `GeneratedExportFile` → wait for the first action's execution lifecycle to finish → retrieve the exact file by `ExportKey` → Download File. Do not put Download File in the generation microflow.

In Studio Pro, manually add `GeneratedExportFile.ExportKey` as a String (recommended length at least 100). The widget creates a fresh key per export and sends it with the complete standalone HTML to `ACT_CurrentViewToPdf(HtmlContent: String, ExportKey: String)`. In that microflow, create `GeneratedExportFile` with a PDF name such as `'AuditReport-' + formatDateTime([%CurrentDateTime%], 'yyyyMMdd-HHmmss') + '.pdf'` and `ExportKey = $ExportKey`; call `JA_ConvertHtmlToPdf` with `Html = $HtmlContent`, `BaseUri = ''`, and `OutputFile = $OutputFile`; commit `$OutputFile`; then end. **Do not Download File here.**

Create `ACT_OpenGeneratedPdf(ExportKey: String)` as the second microflow. Retrieve the first `GeneratedExportFile` from the database with XPath `[ExportKey = $ExportKey]`. If found, use Mendix **Download File** on that object with **Show file in browser = Yes**. If absent, show or log "Generated PDF could not be found." Never retrieve an unrestricted "latest file". Keep entity access rules intact; production apps may additionally associate generated files with a report, user, or session for authorization, retention, and cleanup. An AuditechReport association is not required for key matching. Browser and corporate policy determine whether the PDF opens in a tab or downloads; the widget does not call `window.open`.

Recommended widget setup: **Auto Export On Load = Yes**, **Auto Export Delay (ms) = 1000**, **Open Generated File After Export = Yes**, **Show Export Button = Yes**, **Current View Export Action = ACT_CurrentViewToPdf**, and **Open Generated File Action = ACT_OpenGeneratedPdf**. The visible button remains a manual re-export fallback and each click uses a new key. When Open Generated File After Export is off, the second action never runs. Replace the MPK, Synchronize App Directory, and Clean Deployment Directory before the real Mendix smoke test.

Mendix 10.24 `ActionValue.execute()` returns `void`; the widget observes `isExecuting` transition from running to stopped before starting the second action. This lifecycle does not expose a success/failure result. A failed generation action that entered execution can therefore still lead to the second lookup; the lookup must handle a missing key without downloading anything. The widget never retries generation automatically.

### Current View Exact View geometry fidelity

Exact View now takes a source geometry snapshot before detaching the export clone. The clone retains the source desktop width and the source grid/flex layout. Only evidence-backed browser-shell constraints are relaxed in the clone: viewport-filling heights, oversized flex wrappers, and report scroll containers whose rendered content exceeds their visible box. Fixed-height business components are not globally resized, and the live Mendix DOM is never modified. Meaningful visible content bounds drive source-height measurement instead of viewport filler. Application `@media print` rules are excluded from Exact View so they cannot hide screen-visible report values; PDF page size and orientation remain controlled by the renderer.

After Auto Export Delay, capture also waits for fonts and visible images where available, takes at least two animation-frame samples, and briefly waits for width/content/text metrics to stabilize (at most about 1.5 seconds of additional capture preparation). Auto orientation uses the measured desktop width and meaningful report height; wide reports can select Landscape before proportional paper fitting. Debug Mode reports only counts and dimensions—including visible text before/after normalization, clipping, expanded containers, selected orientation, and scale—not business text or form values. A local generic nested-report fixture exercises value retention, natural section flow, scroll/flex cleanup, and fixed-height safety; the real corporate PDF still needs side-by-side validation.

---

# Build

## Widget

```bash
cd widget/HtmlPdfExportView
npm install
npm test
npm run build
npm run release
```

Final artifact:

```text
dist/HtmlPdfExport.HtmlPdfExportView.mpk
```

---

## Java

Java 21 gereklidir.

```bash
cd java
mvn clean package
```

Final shaded artifact:

```text
dist/html-pdf-export-1.0.0-all.jar
```

---

# Test Durumu

Son doğrulanan test sonuçları:

```text
Widget tests:
PASS

Java tests:
PASS

PDF regression:
PASS

CleanReport regression:
PASS

DataGrid regression:
PASS

RichText regression:
PASS

Export Scope regression:
PASS

Batching regression:
PASS

PDF merge:
PASS
```

Word tarafındaki otomatik testler de başarılıdır.

Gerçek Studio Pro Word DataGrid semantic-table düzeltmesinin son smoke testi beklemektedir.

---

# Güvenlik / Privacy

Proje export sırasında application document içeriğini harici servislere göndermez.

PDF rendering local Chromium üzerinden yapılır.

Word rendering local Java process üzerinden yapılır.

Temel yaklaşım:

```text
No external document upload
No telemetry requirement
No cloud renderer requirement
```

Debug log'larında business JSON, HTML document content veya document text loglanmamalıdır.

---

# Bilinen Sınırlamalar

## Current View

Current View yalnızca render edilmiş DOM'u görür.

Virtualized / paginated dataset'in tamamını otomatik olarak yüklemez.

Tüm dataset için FullData kullanılmalıdır.

---

## CSS

PDF Chromium kullandığı için modern browser CSS desteği yüksektir.

Word ise browser değildir.

Word tarafında aşağıdaki yapılar birebir temsil edilmeyebilir:

```text
complex CSS Grid
Flex positioning
sticky
hover
responsive browser-only behaviors
pseudo states
```

Word semantic/editable çıktıya öncelik verir.

---

## External assets

Standalone export sırasında erişilemeyen external font/image kaynakları çıktıdan eksik olabilir.

Mümkün olduğunca:

```text
local assets
data URLs
inline SVG
embedded assets
```

tercih edilmelidir.

---

# Troubleshooting

## PDF oluşmuyor

Kontrol edin:

```text
Edge / Chrome / Chromium kurulu mu?
```

Gerekirse:

```text
HTML_PDF_CHROMIUM_PATH
```

tanımlayın.

### Corporate Windows / Chromium troubleshooting

On Windows, first confirm that Edge can print a small local HTML file outside Mendix. For example, replace the two input/output paths below with writable locations and run:

```powershell
& 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' --headless=new --disable-gpu --no-first-run --no-default-browser-check '--user-data-dir=C:\Temp\HtmlPdfTest\profile' '--print-to-pdf=C:\Temp\HtmlPdfTest\test.pdf' 'file:///C:/Temp/HtmlPdfTest/test.html'
```

The renderer automatically discovers Edge (including both Program Files locations), then Chrome or Chromium. Set `HTML_PDF_CHROMIUM_PATH` to the full browser executable path only when auto-discovery is unsuitable. A profile-lock or running-Edge conflict can make the browser exit without producing a PDF; each export now uses a unique temporary `--user-data-dir` and removes it after rendering when possible. Windows does not need `--no-sandbox`; do not add it to bypass corporate security controls. Failed renders report the selected browser, exit status, temporary paths, and abbreviated stdout/stderr without logging the HTML document.

---

## Widget görünmüyor

Kontrol edin:

```text
MPK widgets klasöründe mi?
```

Ardından:

```text
Synchronize App Directory
Clean Deployment Directory
```

çalıştırın.

Widget identity:

```text
HtmlPdfExport.HtmlPdfExportView
```

olmalıdır.

---

## Java compile hatası

Kontrol edin:

```text
Java 21
```

Studio Pro deployment JDK path'i doğru mu?

Ayrıca `userlib` içinde duplicate eski HtmlPdfExport JAR bırakmayın.

---

## Büyük PDF fail oluyor

Single render yerine batching kullanın.

Önerilen başlangıç:

```text
Batch Mode = Auto
Batch Size = 5000
```

Batch Collection Path örneği:

```text
rows
```

veya:

```text
report.rows
```

---

## DataGrid2 yalnızca görünen kayıtları export ediyor

Bu Current View için beklenen davranıştır.

Tüm filtrelenmiş kayıtlar için:

```text
Export Scope = All Filtered
```

ve FullData configuration kullanın.

---

## Clean Report DataGrid hizası

Clean Report structural DataGrid cells'i kaldırmamalıdır.

Mevcut sürüm structural shells'i koruyarak interaction UI'ı temizler.

---

## Türkçe karakter sorunu

Chromium PDF ve DOCX renderer UTF-8/Turkish Unicode testlerinden geçmiştir.

Sorun yaşanıyorsa kullanılan custom font'un ilgili Türkçe glyph'leri içerdiğini kontrol edin.

---

# Repository Dokümanları

## PDF / FullData

[FullData Batching Integration](FULLDATA_BATCHING_INTEGRATION.md)

## Word

[Word / DOCX Integration](WORD_DOCX_INTEGRATION.md)

[Word Studio Pro Smoke Test](WORD_STUDIOPRO_SMOKE_TEST.md)

---

# Önerilen Production Kullanımı

Şu an için önerilen ana kullanım:

```text
PDF
```

Özellikle:

```text
Current View
Exact View
Clean Report
FullData
All Filtered
Selected
Batching
```

production kullanım için ana özellik setidir.

Word / DOCX desteği mevcut olmakla birlikte son gerçek Studio Pro DataGrid semantic-table smoke testi tamamlandıktan sonra production status yeniden değerlendirilebilir.

---

# Özet

Bu proje aşağıdaki iki problemi çözmek üzere tasarlanmıştır:

## Görsel PDF

```text
Mendix UI
→ DOM + CSS
→ Chromium
→ PDF
```

## Büyük Veri PDF

```text
Mendix Data
→ JSON
→ FreeMarker
→ HTML
→ Batches
→ Chromium
→ PDFBox Merge
→ Final PDF
```

## Editable Word

```text
Mendix / FullData
→ Semantic HTML
→ Apache POI
→ Editable DOCX
```

Amaç yalnızca bir DataGrid2 exporter oluşturmak değildir.

Amaç:

> Mendix uygulamalarında tekrar kullanılabilir, büyük veri destekli ve farklı çıktı formatlarına genişleyebilen bir export engine oluşturmaktır.
