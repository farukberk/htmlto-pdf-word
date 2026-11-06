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
