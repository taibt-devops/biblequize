-- V77: Phòng chơi v2 đợt 2 (PCV-11..16) — trạng thái theo mode của người chơi trong phòng.
-- Chỉ thêm cột, có giá trị mặc định: phòng cũ và phòng đang chơi không bị ảnh hưởng.
--   answer_streak      Đua tốc độ: số câu đúng liên tiếp (thưởng chuỗi)
--   lives              Sinh tồn: số mạng còn lại
--   ghost_streak       Sinh tồn: số câu đúng liên tiếp khi đang là "bóng" (đủ 3 thì hồi sinh)
--   revived            Sinh tồn: đã hồi sinh (mỗi người tối đa 1 lần)
--   eliminated_round   Sinh tồn: chỉ số câu (0-based) lúc bị loại — xếp hạng người bị loại
--   matches_won / best_streak / matches_played   Đấu vương: thống kê xếp hạng
--   prediction_points  Đấu vương: số lần khán giả đoán đúng người thắng
--   room_answers.ghost câu trả lời của "bóng" (không điểm, không tính kết thúc vòng sớm)

ALTER TABLE room_room_players
    ADD COLUMN answer_streak     INT     NOT NULL DEFAULT 0,
    ADD COLUMN lives             INT     NOT NULL DEFAULT 0,
    ADD COLUMN ghost_streak      INT     NOT NULL DEFAULT 0,
    ADD COLUMN revived           BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN eliminated_round  INT     NULL,
    ADD COLUMN matches_won       INT     NOT NULL DEFAULT 0,
    ADD COLUMN best_streak       INT     NOT NULL DEFAULT 0,
    ADD COLUMN matches_played    INT     NOT NULL DEFAULT 0,
    ADD COLUMN prediction_points INT     NOT NULL DEFAULT 0;

ALTER TABLE room_answers
    ADD COLUMN ghost BOOLEAN NOT NULL DEFAULT FALSE;
