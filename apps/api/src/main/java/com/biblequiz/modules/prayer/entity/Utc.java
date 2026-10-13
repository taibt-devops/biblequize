package com.biblequiz.modules.prayer.entity;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

/** Mốc giờ của module cầu nguyện lưu dạng LocalDateTime UTC, như module reading. */
public final class Utc {
    private Utc() {}

    public static LocalDateTime of(Instant i) { return i == null ? null : LocalDateTime.ofInstant(i, ZoneOffset.UTC); }

    public static Instant instant(LocalDateTime t) { return t == null ? null : t.toInstant(ZoneOffset.UTC); }
}
