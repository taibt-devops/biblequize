-- V78: Phòng chơi v2 đợt 3 (PCV-20..24). Chỉ thêm cột/dòng, có giá trị mặc định.
--   users.is_bot                   người máy (không đăng nhập được: không mật khẩu, provider 'bot',
--                                  email *.invalid; ẩn khỏi bảng xếp hạng)
--   room_room_players.bot_level    cấp người máy trong phòng: EASY | MEDIUM | HARD
--   rooms.team_consensus           Đội đấu đội — chế độ Hội ý (đáp án đội = đa số phiếu)
--   rooms.passage_scope            Ôn phần đọc: JSON [{"book","fromChapter","toChapter"}]

ALTER TABLE users
    ADD COLUMN is_bot BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE room_room_players
    ADD COLUMN bot_level VARCHAR(10) NULL;

ALTER TABLE rooms
    ADD COLUMN team_consensus BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN passage_scope  TEXT    NULL;

INSERT IGNORE INTO users (id, name, email, provider, role, leaderboard_visible, is_bot) VALUES
    ('bot-01', 'Máy An',    'bot-01@bots.forbible.invalid', 'bot', 'USER', FALSE, TRUE),
    ('bot-02', 'Máy Bình',  'bot-02@bots.forbible.invalid', 'bot', 'USER', FALSE, TRUE),
    ('bot-03', 'Máy Châu',  'bot-03@bots.forbible.invalid', 'bot', 'USER', FALSE, TRUE),
    ('bot-04', 'Máy Dũng',  'bot-04@bots.forbible.invalid', 'bot', 'USER', FALSE, TRUE),
    ('bot-05', 'Máy Giang', 'bot-05@bots.forbible.invalid', 'bot', 'USER', FALSE, TRUE),
    ('bot-06', 'Máy Hà',    'bot-06@bots.forbible.invalid', 'bot', 'USER', FALSE, TRUE);
