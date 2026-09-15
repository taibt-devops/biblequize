package com.biblequiz.modules.memorize.service;

/** Lỗi nghiệp vụ Học Thuộc; controller map {@link Kind} sang HTTP status. */
public class MemoryVerseException extends RuntimeException {

    public enum Kind { INVALID, DUPLICATE, NOT_FOUND }

    private final Kind kind;

    public MemoryVerseException(Kind kind, String message) {
        super(message);
        this.kind = kind;
    }

    public Kind getKind() { return kind; }
}
