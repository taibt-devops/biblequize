-- V32: Track member activity for inactive-filter and last-active sort.
-- Phase 0.5 (the actual update trigger from AnswerService) is deferred —
-- column defaults to joinedAt so existing rows behave as "freshly active"
-- and the inactive filter never returns false positives for legacy data.

ALTER TABLE group_members
    ADD COLUMN last_active_at TIMESTAMP NULL DEFAULT NULL;

UPDATE group_members
SET last_active_at = joined_at
WHERE last_active_at IS NULL;

CREATE INDEX idx_group_members_last_active ON group_members (group_id, last_active_at);
