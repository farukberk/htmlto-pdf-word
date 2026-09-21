package com.example.mendix.rendering;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import freemarker.core.TemplateClassResolver;
import freemarker.template.Configuration;
import freemarker.template.Template;
import freemarker.template.TemplateException;
import freemarker.template.TemplateExceptionHandler;

import java.io.IOException;
import java.io.StringReader;
import java.io.StringWriter;
import java.util.Map;

public final class FreeMarkerHtmlRenderer implements HtmlRenderer {
    private final ObjectMapper mapper;
    private final Configuration configuration;

    public FreeMarkerHtmlRenderer() {
        mapper = new ObjectMapper();
        configuration = new Configuration(Configuration.VERSION_2_3_34);
        configuration.setDefaultEncoding("UTF-8");
        configuration.setTemplateExceptionHandler(TemplateExceptionHandler.RETHROW_HANDLER);
        configuration.setLogTemplateExceptions(false);
        configuration.setWrapUncheckedExceptions(true);
        configuration.setNewBuiltinClassResolver(TemplateClassResolver.ALLOWS_NOTHING_RESOLVER);
        configuration.setAPIBuiltinEnabled(false);
    }

    @Override public String render(String templateContent, String jsonData) throws HtmlRenderingException {
        if (templateContent == null || jsonData == null) throw new IllegalArgumentException("TemplateContent and JsonData are required");
        final Map<String, Object> model;
        try { model = mapper.readValue(jsonData, new TypeReference<>() {}); }
        catch (JsonProcessingException e) { throw new HtmlRenderingException("JsonData is not valid JSON: " + e.getOriginalMessage(), e); }
        try (StringReader reader = new StringReader(templateContent); StringWriter writer = new StringWriter(Math.max(1024, templateContent.length()))) {
            Template template = new Template("inline-report", reader, configuration);
            template.process(model, writer);
            return writer.toString();
        } catch (IOException | TemplateException e) {
            throw new HtmlRenderingException("FreeMarker rendering failed: " + e.getMessage(), e);
        }
    }
}
