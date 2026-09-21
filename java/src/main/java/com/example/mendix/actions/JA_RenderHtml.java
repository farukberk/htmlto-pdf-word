package com.example.mendix.actions;

import com.example.mendix.rendering.FreeMarkerHtmlRenderer;
import com.example.mendix.rendering.HtmlRenderingException;

public final class JA_RenderHtml {
    private JA_RenderHtml() {}
    public static String execute(String templateContent, String jsonData) throws HtmlRenderingException {
        return new FreeMarkerHtmlRenderer().render(templateContent, jsonData);
    }
}
