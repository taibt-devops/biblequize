package com.biblequiz.modules.room.service;

import com.biblequiz.modules.room.entity.Room;
import com.biblequiz.modules.room.entity.RoomPlayer;

import java.util.List;

/**
 * PCV-5 — luật số người và cài đặt theo mode (Phòng chơi v2, design §1.6). Một chỗ duy nhất
 * cho cả tạo phòng, Đấu nhanh và bắt đầu trận; giao diện có bản sao trong
 * {@code create-room/modeMeta.ts} để hiện trước cho người chơi.
 */
public final class RoomModeRules {

    public static final int MAX_PLAYERS = 100;
    /** Đấu vương đấu tay đôi lần lượt — phòng đông thì đa số không tới lượt (DECISIONS 2026-10-12). */
    public static final int MAX_PLAYERS_SUDDEN_DEATH = 12;
    public static final int MIN_QUESTIONS = 5;
    public static final int MAX_QUESTIONS = 30;
    public static final int MIN_SECONDS = 10;
    public static final int MAX_SECONDS = 60;

    private RoomModeRules() {}

    public static int minPlayers(Room.RoomMode mode) {
        if (mode == null) return 2;
        return switch (mode) {
            case BATTLE_ROYALE, SUDDEN_DEATH -> 3;
            case TEAM_VS_TEAM -> 4;
            default -> 2;
        };
    }

    public static int maxPlayers(Room.RoomMode mode) {
        return mode == Room.RoomMode.SUDDEN_DEATH ? MAX_PLAYERS_SUDDEN_DEATH : MAX_PLAYERS;
    }

    /** Kẹp số người tối đa vào [số tối thiểu của mode, trần của mode]; null → 4. */
    public static int clampMaxPlayers(Room.RoomMode mode, Integer requested) {
        int value = requested != null ? requested : 4;
        return Math.max(minPlayers(mode), Math.min(value, maxPlayers(mode)));
    }

    public static int clampQuestionCount(Integer requested) {
        int value = requested != null ? requested : 10;
        return Math.max(MIN_QUESTIONS, Math.min(value, MAX_QUESTIONS));
    }

    public static int clampTimePerQuestion(Integer requested) {
        int value = requested != null ? requested : 30;
        return Math.max(MIN_SECONDS, Math.min(value, MAX_SECONDS));
    }

    /** Tên mode tiếng Việt cho thông báo lỗi. */
    public static String label(Room.RoomMode mode) {
        if (mode == null) return "Đua tốc độ";
        return switch (mode) {
            case BATTLE_ROYALE -> "Sinh tồn";
            case TEAM_VS_TEAM -> "Đội đấu đội";
            case SUDDEN_DEATH -> "Đấu vương";
            case GROUP_LIVE_SEQUENTIAL -> "Chơi cùng nhau";
            default -> "Đua tốc độ";
        };
    }

    /**
     * Lý do chưa bắt đầu được, hoặc {@code null} nếu được.
     *
     * @param players RoomPlayer của phòng ở sảnh chờ (Quản trò không nằm trong đây)
     * @param hostPlaysGame false = Quản trò mode (thông báo ghi rõ "không tính Quản trò")
     */
    public static String startError(Room.RoomMode mode, List<RoomPlayer> players, boolean hostPlaysGame) {
        // PCV-20: người máy không tự chơi với nhau — cần ít nhất một người thật trong trận.
        if (!players.isEmpty() && players.stream().allMatch(RoomPlayer::isBot)) {
            return "Phòng cần ít nhất 1 người chơi thật";
        }
        int count = players.size();
        int max = maxPlayers(mode);
        if (count > max) return label(mode) + " tối đa " + max + " người (tính cả người máy)";
        int min = minPlayers(mode);
        if (count < min) {
            String suffix = hostPlaysGame ? "" : " (không tính Quản trò)";
            if (mode == null || mode == Room.RoomMode.SPEED_RACE || mode == Room.RoomMode.GROUP_LIVE_SEQUENTIAL) {
                // Giữ nguyên chữ cũ cho các mode tối thiểu 2 người.
                return hostPlaysGame ? "Cần ít nhất 2 người chơi để bắt đầu" : "Cần ít nhất 2 người chơi (không tính Quản trò)";
            }
            return label(mode) + " cần ít nhất " + min + " người chơi" + suffix;
        }
        if (mode == Room.RoomMode.TEAM_VS_TEAM) {
            long a = players.stream().filter(p -> p.getTeam() == RoomPlayer.Team.A).count();
            long b = players.stream().filter(p -> p.getTeam() == RoomPlayer.Team.B).count();
            if (a < 2 || b < 2) return "Mỗi đội cần ít nhất 2 người";
            long diff = Math.abs(a - b);
            if (diff > 1) return "Hai đội đang lệch nhau " + diff + " người — đổi đội hoặc bấm Xáo đội";
        }
        return null;
    }
}
