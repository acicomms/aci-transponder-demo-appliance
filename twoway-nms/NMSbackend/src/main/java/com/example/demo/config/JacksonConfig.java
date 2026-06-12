package com.example.demo.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import tools.jackson.core.JsonGenerator;
import tools.jackson.core.JsonParser;
import tools.jackson.databind.DeserializationContext;
import tools.jackson.databind.JacksonModule;
import tools.jackson.databind.SerializationContext;
import tools.jackson.databind.ValueDeserializer;
import tools.jackson.databind.ValueSerializer;
import tools.jackson.databind.module.SimpleModule;

import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;


@Configuration
public class JacksonConfig {

    private static final DateTimeFormatter UTC_OUT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");

    @Bean
    public JacksonModule utcLocalDateTimeModule() {
        SimpleModule module = new SimpleModule("utc-local-date-time");

        module.addSerializer(LocalDateTime.class, new ValueSerializer<LocalDateTime>() {
            @Override
            public void serialize(LocalDateTime value, JsonGenerator gen, SerializationContext ctxt) {
                gen.writeString(UTC_OUT.format(value));
            }
        });

        module.addDeserializer(LocalDateTime.class, new ValueDeserializer<LocalDateTime>() {
            @Override
            public LocalDateTime deserialize(JsonParser p, DeserializationContext ctxt) {
                String text = p.getString();
                if (text == null || text.isBlank()) return null;
                try {
                    return OffsetDateTime.parse(text)
                            .withOffsetSameInstant(ZoneOffset.UTC)
                            .toLocalDateTime();
                } catch (DateTimeParseException ignored) {
                    return LocalDateTime.parse(text, DateTimeFormatter.ISO_LOCAL_DATE_TIME);
                }
            }
        });
        return module;
    }
}