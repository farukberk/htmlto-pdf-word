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

// Extension point: a future implementation can walk source/clone pairs and inline computed styles.
export function inlineComputedStyles(_source: Element, _clone: Element): void {}
