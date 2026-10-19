package com.biblequiz.modules.prayer.entity;

import com.biblequiz.modules.prayer.service.PrayerInput;
import com.biblequiz.modules.prayer.service.PrayerInput.Update;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Tin mới của một điều, lưu ở cột updates_json dạng [{"id","text","at"}]; at viết như PrayerInput.iso. */
public final class PrayerUpdatesJson {

    private static final ObjectMapper JSON = new ObjectMapper();

    private PrayerUpdatesJson() {}

    /** Rỗng thì null, để cột trống như các điều bản 1. */
    public static String write(List<Update> updates) {
        if (updates == null || updates.isEmpty()) return null;
        List<Map<String, String>> rows = new ArrayList<>(updates.size());
        for (Update u : updates) rows.add(Map.of("id", u.id(), "text", u.text(), "at", PrayerInput.iso(u.at())));
        try {
            return JSON.writeValueAsString(rows);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Không ghi được tin mới", e);
        }
    }

    /** Cột trống hay hỏng thì danh sách rỗng: thiếu tin mới không được làm hỏng cả sổ. */
    public static List<Update> read(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            List<Map<String, String>> rows = JSON.readValue(json, new TypeReference<>() {});
            List<Update> out = new ArrayList<>(rows.size());
            for (Map<String, String> r : rows) out.add(new Update(r.get("id"), r.get("text"), Instant.parse(r.get("at"))));
            return List.copyOf(out);
        } catch (Exception e) {
            return List.of();
        }
    }
}
