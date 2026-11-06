export function collectStyles(doc: Document = document, excludeApplicationPrintRules = false): string {
    const css: string[] = [];
    for (const sheet of Array.from(doc.styleSheets)) {
        try {
            const baseUri = sheet.href || doc.baseURI;
            css.push(Array.from(sheet.cssRules)
                .filter(rule => !excludeApplicationPrintRules || !isPrintMediaRule(rule))
                .map(rule => absolutizeCssUrls(rule.cssText, baseUri)).join("\n"));
        } catch (error) {
            if (!(error instanceof DOMException) || error.name !== "SecurityError") continue;
        }
    }
    return css.join("\n");
}

/** Embeds font binaries while the authenticated Mendix page can still access them. */
export async function collectStylesWithEmbeddedFonts(doc: Document = document,
                                                     excludeApplicationPrintRules = false): Promise<string> {
    return embedFontResources(collectStyles(doc, excludeApplicationPrintRules), doc.defaultView?.fetch?.bind(doc.defaultView));
}

export async function embedFontResources(css: string, fetchResource: typeof fetch | undefined = globalThis.fetch): Promise<string> {
    if (!fetchResource || !css.includes("@font-face")) return css;
    const fontFaces = Array.from(css.matchAll(/@font-face\s*\{[^}]*\}/gi));
    const urls = new Set<string>();
    for (const face of fontFaces) {
        for (const match of face[0].matchAll(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi)) {
            const url = match[2].trim();
            if (!/^(data:|blob:|file:|#)/i.test(url)) urls.add(url);
        }
    }
    const embedded = new Map<string, string>();
    await Promise.all(Array.from(urls, async url => {
        try {
            const response = await fetchResource(url, { credentials: "same-origin" });
            if (!response.ok) return;
            const blob = await response.blob();
            embedded.set(url, await blobToDataUrl(blob, fontMimeType(url, blob.type)));
        } catch { /* Keep the absolute URL when the font cannot be embedded. */ }
    }));
    if (embedded.size === 0) return css;
    return css.replace(/@font-face\s*\{[^}]*\}/gi, face => face.replace(
        /url\(\s*(["']?)([^"')]+)\1\s*\)/gi,
        (match, quote: string, resource: string) => {
            const dataUrl = embedded.get(resource.trim());
            return dataUrl ? `url(${quote}${dataUrl}${quote})` : match;
        }));
}

function blobToDataUrl(blob: Blob, mimeType: string): Promise<string> {
    const normalized = blob.type === mimeType ? blob : blob.slice(0, blob.size, mimeType);
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener("load", () => resolve(String(reader.result)), { once: true });
        reader.addEventListener("error", () => reject(reader.error ?? new Error("Font data could not be read.")), { once: true });
        reader.readAsDataURL(normalized);
    });
}

function fontMimeType(url: string, declaredType: string): string {
    if (/^font\//i.test(declaredType) || declaredType === "application/font-woff") return declaredType;
    const path = url.split(/[?#]/, 1)[0].toLowerCase();
    if (path.endsWith(".woff2")) return "font/woff2";
    if (path.endsWith(".woff")) return "font/woff";
    if (path.endsWith(".otf")) return "font/otf";
    if (path.endsWith(".ttf")) return "font/ttf";
    return declaredType || "application/octet-stream";
}

function isPrintMediaRule(rule: CSSRule): boolean {
    if (rule.type !== CSSRule.MEDIA_RULE) return false;
    const mediaText = (rule as CSSMediaRule).media.mediaText.toLowerCase();
    return /(?:^|[,\s])print(?:$|[,\s])/.test(mediaText);
}

function absolutizeCssUrls(cssText: string, baseUri: string): string {
    return cssText.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi, (match, quote: string, resource: string) => {
        const value = resource.trim();
        if (/^(data:|blob:|https?:|file:|#|\/\/)/i.test(value)) return match;
        try { return `url(${quote}${new URL(value, baseUri).href}${quote})`; }
        catch { return match; }
    });
}

/** Preserves the rendered font even when its selector depends on ancestors outside the export boundary. */
export function inlineComputedStyles(source: Element, clone: Element): void {
    const sourceElements = [source, ...Array.from(source.querySelectorAll("*"))];
    const cloneElements = [clone, ...Array.from(clone.querySelectorAll("*"))];
    sourceElements.forEach((sourceElement, index) => {
        const cloneElement = cloneElements[index];
        if (!(sourceElement instanceof HTMLElement) || !(cloneElement instanceof HTMLElement)) return;
        const family = inheritedComputedValue(sourceElement, "font-family");
        if (family) cloneElement.style.setProperty("font-family", family);
    });
}

function inheritedComputedValue(element: HTMLElement, property: string): string {
    for (let current: HTMLElement | null = element; current; current = current.parentElement) {
        const value = current.ownerDocument.defaultView?.getComputedStyle(current).getPropertyValue(property).trim();
        if (value) return value;
    }
    return "";
}
