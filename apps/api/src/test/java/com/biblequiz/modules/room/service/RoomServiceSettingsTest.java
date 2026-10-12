package com.biblequiz.modules.room.service;

import com.biblequiz.api.websocket.RoomWebSocketController;
import com.biblequiz.modules.room.entity.Room;
import com.biblequiz.modules.room.entity.RoomPlayer;
import com.biblequiz.modules.room.repository.RoomPlayerRepository;
import com.biblequiz.modules.room.repository.RoomRepository;
import com.biblequiz.modules.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** PCV-18 — "Đổi cách chơi" ngay trong sảnh chờ (design §2.6). */
@ExtendWith(MockitoExtension.class)
class RoomServiceSettingsTest {

    @Mock private RoomRepository roomRepository;
    @Mock private RoomPlayerRepository roomPlayerRepository;
    @Mock private RoomWebSocketController webSocketController;
    @InjectMocks private RoomService roomService;

    private final Room room = new Room();
    private final List<RoomPlayer> players = new ArrayList<>();

    private void addPlayers(int n) {
        for (int i = 0; i < n; i++) {
            User u = new User();
            u.setId("u" + i);
            RoomPlayer p = new RoomPlayer("p" + i, room, u, "Người " + i);
            p.setIsReady(true);
            players.add(p);
        }
    }

    @BeforeEach
    void setUp() {
        User host = new User();
        host.setId("u0");
        room.setId("room-1");
        room.setHost(host);
        room.setStatus(Room.RoomStatus.LOBBY);
        room.setMode(Room.RoomMode.SPEED_RACE);
        room.setQuestionCount(10);
        room.setTimePerQuestion(30);
        room.setMaxPlayers(20);
        room.setDifficulty(Room.RoomDifficulty.MIXED);
        lenient().when(roomRepository.findById("room-1")).thenReturn(Optional.of(room));
        lenient().when(roomPlayerRepository.findByRoomId("room-1")).thenReturn(players);
    }

    @Test
    void host_changesModeCountTimeDifficulty_valuesClamped_everyoneMustReadyAgain() throws Exception {
        addPlayers(4);

        roomService.updateSettings("room-1", "u0", new RoomService.SettingsUpdate(
                Room.RoomMode.BATTLE_ROYALE, 45, 5, Room.RoomDifficulty.HARD));

        assertEquals(Room.RoomMode.BATTLE_ROYALE, room.getMode());
        assertEquals(30, room.getQuestionCount(), "tối đa 30 câu");
        assertEquals(10, room.getTimePerQuestion(), "tối thiểu 10 giây");
        assertEquals(Room.RoomDifficulty.HARD, room.getDifficulty());
        assertTrue(players.stream().noneMatch(RoomPlayer::getIsReady));
        verify(roomRepository).save(room);
        verify(webSocketController).broadcastRoomState("room-1");
        verify(webSocketController).broadcastSystemChat(eq("room-1"), contains("Sinh tồn"));
    }

    @Test
    void switchingToTeams_splitsEvenly_switchingAway_clearsTeams() throws Exception {
        addPlayers(5);

        roomService.updateSettings("room-1", "u0", new RoomService.SettingsUpdate(Room.RoomMode.TEAM_VS_TEAM, null, null, null));
        long a = players.stream().filter(p -> p.getTeam() == RoomPlayer.Team.A).count();
        long b = players.stream().filter(p -> p.getTeam() == RoomPlayer.Team.B).count();
        assertEquals(3, a);
        assertEquals(2, b);

        roomService.updateSettings("room-1", "u0", new RoomService.SettingsUpdate(Room.RoomMode.SPEED_RACE, null, null, null));
        assertTrue(players.stream().allMatch(p -> p.getTeam() == null));
    }

    @Test
    void suddenDeath_withMoreThanTwelvePlayers_isRejected() {
        addPlayers(13);
        Exception e = assertThrows(Exception.class, () -> roomService.updateSettings("room-1", "u0",
                new RoomService.SettingsUpdate(Room.RoomMode.SUDDEN_DEATH, null, null, null)));
        assertTrue(e.getMessage().contains("12"));
        assertEquals(Room.RoomMode.SPEED_RACE, room.getMode());
    }

    @Test
    void onlyHost_onlyInLobby_notForGroupLiveRooms() {
        addPlayers(3);
        assertThrows(Exception.class, () -> roomService.updateSettings("room-1", "u1",
                new RoomService.SettingsUpdate(Room.RoomMode.BATTLE_ROYALE, null, null, null)));

        room.setStatus(Room.RoomStatus.IN_PROGRESS);
        assertThrows(Exception.class, () -> roomService.updateSettings("room-1", "u0",
                new RoomService.SettingsUpdate(Room.RoomMode.BATTLE_ROYALE, null, null, null)));

        room.setStatus(Room.RoomStatus.LOBBY);
        room.setMode(Room.RoomMode.GROUP_LIVE_SEQUENTIAL);
        assertThrows(Exception.class, () -> roomService.updateSettings("room-1", "u0",
                new RoomService.SettingsUpdate(Room.RoomMode.BATTLE_ROYALE, null, null, null)));
    }

    @Test
    void quickMatchRooms_keepTheirSettings() {
        addPlayers(3);
        room.setQuickMatch(true);
        Exception e = assertThrows(Exception.class, () -> roomService.updateSettings("room-1", "u0",
                new RoomService.SettingsUpdate(Room.RoomMode.BATTLE_ROYALE, null, null, null)));
        assertTrue(e.getMessage().contains("Đấu nhanh"));
    }
}
