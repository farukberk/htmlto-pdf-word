package com.example.mendix.rendering;

public interface HtmlRenderer {
    String render(String templateContent, String jsonData) throws HtmlRenderingException;
}
