-- Add Bible-specific fields to rooms table for rich lobby cards
ALTER TABLE rooms
    ADD COLUMN difficulty ENUM('EASY','MEDIUM','HARD','MIXED') NULL DEFAULT 'MIXED',
    ADD COLUMN book_scope VARCHAR(100) NULL DEFAULT 'ALL';
