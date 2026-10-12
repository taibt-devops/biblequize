package com.biblequiz.modules.room.service;

import com.biblequiz.modules.room.entity.Room;
import com.biblequiz.modules.room.entity.RoomPlayer;
import com.biblequiz.modules.user.entity.User;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** PCV-5 — luật số người và cài đặt theo mode (design §1.6). */
class RoomModeRulesTest {

    private static List<RoomPlayer> players(int n) {
        return teams(n, 0);
    }

    /** a người đội A, b người đội B (b=0 và a=n khi mode không chia đội). */
    private static List<RoomPlayer> teams(int a, int b) {
        Room room = new Room();
        List<RoomPlayer> out = new ArrayList<>();
        for (int i = 0; i < a + b; i++) {
            User u = new User();
            u.setId("u" + i);
            RoomPlayer p = new RoomPlayer("p" + i, room, u, "P" + i);
            if (b > 0 || i >= a) p.setTeam(i < a ? RoomPlayer.Team.A : RoomPlayer.Team.B);
            out.add(p);
        }
        return out;
    }

    @Test
    void minimums_perMode() {
        assertEquals(2, RoomModeRules.minPlayers(Room.RoomMode.SPEED_RACE));
        assertEquals(3, RoomModeRules.minPlayers(Room.RoomMode.BATTLE_ROYALE));
        assertEquals(4, RoomModeRules.minPlayers(Room.RoomMode.TEAM_VS_TEAM));
        assertEquals(3, RoomModeRules.minPlayers(Room.RoomMode.SUDDEN_DEATH));
        assertEquals(2, RoomModeRules.minPlayers(Room.RoomMode.GROUP_LIVE_SEQUENTIAL));
    }

    @Test
    void maxPlayers_suddenDeathCappedAt12_othersAt100() {
        assertEquals(12, RoomModeRules.clampMaxPlayers(Room.RoomMode.SUDDEN_DEATH, 40));
        assertEquals(100, RoomModeRules.clampMaxPlayers(Room.RoomMode.BATTLE_ROYALE, 500));
        assertEquals(3, RoomModeRules.clampMaxPlayers(Room.RoomMode.BATTLE_ROYALE, 2), "không nhỏ hơn số tối thiểu");
        assertEquals(4, RoomModeRules.clampMaxPlayers(Room.RoomMode.SPEED_RACE, null), "mặc định 4");
    }

    @Test
    void questionCountAndTime_areClamped() {
        assertEquals(5, RoomModeRules.clampQuestionCount(1));
        assertEquals(30, RoomModeRules.clampQuestionCount(500));
        assertEquals(10, RoomModeRules.clampQuestionCount(null));
        assertEquals(10, RoomModeRules.clampTimePerQuestion(3));
        assertEquals(60, RoomModeRules.clampTimePerQuestion(600));
        assertEquals(30, RoomModeRules.clampTimePerQuestion(null));
    }

    @Test
    void startError_speedRaceKeepsLegacyMessages() {
        assertEquals("Cần ít nhất 2 người chơi để bắt đầu",
                RoomModeRules.startError(Room.RoomMode.SPEED_RACE, players(1), true));
        assertEquals("Cần ít nhất 2 người chơi (không tính Quản trò)",
                RoomModeRules.startError(Room.RoomMode.SPEED_RACE, players(1), false));
        assertNull(RoomModeRules.startError(Room.RoomMode.SPEED_RACE, players(2), true));
    }

    @Test
    void startError_battleRoyaleAndSuddenDeathNeedThree() {
        assertEquals("Sinh tồn cần ít nhất 3 người chơi",
                RoomModeRules.startError(Room.RoomMode.BATTLE_ROYALE, players(2), true));
        assertEquals("Đấu vương cần ít nhất 3 người chơi (không tính Quản trò)",
                RoomModeRules.startError(Room.RoomMode.SUDDEN_DEATH, players(2), false));
        assertNull(RoomModeRules.startError(Room.RoomMode.SUDDEN_DEATH, players(3), true));
    }

    @Test
    void startError_teams() {
        assertEquals("Đội đấu đội cần ít nhất 4 người chơi",
                RoomModeRules.startError(Room.RoomMode.TEAM_VS_TEAM, teams(2, 1), true));
        assertEquals("Mỗi đội cần ít nhất 2 người",
                RoomModeRules.startError(Room.RoomMode.TEAM_VS_TEAM, teams(4, 0), true));
        assertEquals("Hai đội đang lệch nhau 2 người — đổi đội hoặc bấm Xáo đội",
                RoomModeRules.startError(Room.RoomMode.TEAM_VS_TEAM, teams(5, 3), true));
        assertNull(RoomModeRules.startError(Room.RoomMode.TEAM_VS_TEAM, teams(3, 2), true));
    }
}
