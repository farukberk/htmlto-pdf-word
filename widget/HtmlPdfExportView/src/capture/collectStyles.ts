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
                                                     excludeApplicationPrintRules = false,
                                                     fetchResource: typeof fetch | undefined =
                                                         doc.defaultView?.fetch?.bind(doc.defaultView)): Promise<string> {
    const styles = await collectStylesWithFetchFallback(doc, excludeApplicationPrintRules, fetchResource);
    const observedFonts = observedFontFaceFallbacks(doc, styles);
    return embedFontResources([styles, observedFonts].filter(Boolean).join("\n"), fetchResource);
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
            const response = await fetchResource(url, { credentials: "include" });
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

async function collectStylesWithFetchFallback(doc: Document, excludeApplicationPrintRules: boolean,
                                              fetchResource: typeof fetch | undefined): Promise<string> {
    const css: string[] = [];
    for (const sheet of Array.from(doc.styleSheets)) {
        const baseUri = sheet.href || doc.baseURI;
        try {
            css.push(Array.from(sheet.cssRules)
                .filter(rule => !excludeApplicationPrintRules || !isPrintMediaRule(rule))
                .map(rule => absolutizeCssUrls(rule.cssText, baseUri)).join("\n"));
        } catch (error) {
            if (!(error instanceof DOMException) || error.name !== "SecurityError" || !sheet.href || !fetchResource) continue;
            try {
                const response = await fetchResource(sheet.href, { credentials: "include" });
                if (!response.ok) continue;
                css.push(absolutizeCssUrls(await response.text(), sheet.href));
            } catch { /* The observed-font fallback below can still recover discoverable font resources. */ }
        }
    }
    return css.join("\n");
}

function observedFontFaceFallbacks(doc: Document, existingCss: string): string {
    const fontSet = doc.fonts as FontFaceSet | undefined;
    const performance = doc.defaultView?.performance;
    if (!fontSet || !performance?.getEntriesByType) return "";
    const resources = performance.getEntriesByType("resource")
        .map(entry => entry.name)
        .filter(url => /\.(?:woff2?|ttf|otf)(?:[?#]|$)/i.test(url));
    if (resources.length === 0) return "";
    const declaredFamilies = new Set(Array.from(existingCss.matchAll(/@font-face\s*\{[^}]*font-family\s*:\s*(["']?)([^;"'}]+)\1/gi))
        .map(match => normalizeFontName(match[2])));
    const rules: string[] = [];
    for (const face of Array.from(fontSet as unknown as Iterable<FontFace>)) {
        if (face.status !== "loaded" || declaredFamilies.has(normalizeFontName(face.family))) continue;
        const resource = bestFontResource(face, resources);
        if (!resource) continue;
        rules.push(`@font-face { font-family: ${quoteCssString(face.family)}; src: url(${quoteCssString(resource)}); ` +
            `font-style: ${face.style}; font-weight: ${face.weight}; font-stretch: ${face.stretch}; }`);
        declaredFamilies.add(normalizeFontName(face.family));
    }
    return rules.join("\n");
}

function bestFontResource(face: FontFace, resources: string[]): string | undefined {
    const family = normalizeFontName(face.family);
    if (!family) return undefined;
    const matches = resources.filter(url => normalizeFontName(decodeURIComponent(url)).includes(family));
    if (matches.length === 0) return resources.length === 1 ? resources[0] : undefined;
    return matches.sort((left, right) => fontResourceScore(face, right) - fontResourceScore(face, left))[0];
}

function fontResourceScore(face: FontFace, url: string): number {
    const value = normalizeFontName(decodeURIComponent(url));
    const weight = Number.parseInt(face.weight, 10);
    let score = 0;
    if (face.style.toLowerCase().includes("italic") === value.includes("italic")) score += 4;
    if (weight >= 700 && value.includes("bold")) score += 3;
    else if (weight >= 600 && value.includes("semibold")) score += 3;
    else if (weight <= 400 && (value.includes("regular") || value.includes("normal"))) score += 2;
    return score;
}

function normalizeFontName(value: string): string {
    return value.replace(/["']/g, "").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function quoteCssString(value: string): string {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`;
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
