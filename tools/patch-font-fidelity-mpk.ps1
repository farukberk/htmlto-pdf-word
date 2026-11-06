param(
    [Parameter(Mandatory = $true)][string]$InputMpk,
    [Parameter(Mandatory = $true)][string]$OutputMpk
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression.FileSystem
$temporaryDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ("html-pdf-font-patch-" + [guid]::NewGuid().ToString("N"))
[System.IO.Directory]::CreateDirectory($temporaryDirectory) | Out-Null

try {
    [System.IO.Compression.ZipFile]::ExtractToDirectory((Resolve-Path -LiteralPath $InputMpk), $temporaryDirectory)
    $functionCode = 'function copyExportFontStyles(e,t){const r=[e,...Array.from(e.querySelectorAll("*"))],o=[t,...Array.from(t.querySelectorAll("*"))];r.forEach((e,r)=>{const n=o[r];if(!(e instanceof HTMLElement)||!(n instanceof HTMLElement))return;let i="",a=e;for(;a&&!i;a=a.parentElement)i=a.ownerDocument.defaultView?.getComputedStyle(a).getPropertyValue("font-family").trim()||"";i&&n.style.setProperty("font-family",i)})}'
    $patches = @(
        @{ Path = 'HtmlPdfExport\htmlpdfexportview\HtmlPdfExportView.js'; Needle = '}}(a,n):void 0;!function(e,t)'; Replacement = '}}(a,n):void 0;copyExportFontStyles(e,a),!function(e,t)' },
        @{ Path = 'HtmlPdfExport\htmlpdfexportview\HtmlPdfExportView.mjs'; Needle = '}}(l,i):void 0;!function(e,t)'; Replacement = '}}(l,i):void 0;copyExportFontStyles(t,l),!function(e,t)' }
    )

    foreach ($patch in $patches) {
        $relativePath = $patch.Path
        $bundlePath = Join-Path $temporaryDirectory $relativePath
        $bundle = [System.IO.File]::ReadAllText($bundlePath)
        if (($bundle.Split($patch.Needle).Count - 1) -ne 1) { throw "Unexpected clone call count in $relativePath" }
        $bundle = $functionCode + $bundle.Replace($patch.Needle, $patch.Replacement)
        [System.IO.File]::WriteAllText($bundlePath, $bundle, [System.Text.UTF8Encoding]::new($false))
    }

    $outputDirectory = Split-Path -Parent $OutputMpk
    if ($outputDirectory) { [System.IO.Directory]::CreateDirectory($outputDirectory) | Out-Null }
    if (Test-Path -LiteralPath $OutputMpk) { Remove-Item -LiteralPath $OutputMpk -Force }
    [System.IO.Compression.ZipFile]::CreateFromDirectory($temporaryDirectory, $OutputMpk, [System.IO.Compression.CompressionLevel]::Optimal, $false)
}
finally {
    if (Test-Path -LiteralPath $temporaryDirectory) { Remove-Item -LiteralPath $temporaryDirectory -Recurse -Force }
}
