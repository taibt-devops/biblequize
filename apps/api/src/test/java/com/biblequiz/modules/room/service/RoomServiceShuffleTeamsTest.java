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
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;

/** PCV-14 — nút "Xáo đội" (design §2.3): chủ phòng (Đấu nhanh: người trong phòng), khi ở sảnh, chia lại cân. */
@ExtendWith(MockitoExtension.class)
class RoomServiceShuffleTeamsTest {

    @Mock private RoomRepository roomRepository;
    @Mock private RoomPlayerRepository roomPlayerRepository;
    @Mock private RoomWebSocketController webSocketController;
    @InjectMocks private RoomService roomService;

    private final Room room = new Room();
    private final List<RoomPlayer> players = new ArrayList<>();

    private RoomPlayer player(String id, RoomPlayer.Team team, boolean ready) {
        User u = new User();
        u.setId(id);
        RoomPlayer p = new RoomPlayer("p-" + id, room, u, id);
        p.setTeam(team);
        p.setIsReady(ready);
        return p;
    }

    @BeforeEach
    void setUp() {
        User host = new User();
        host.setId("host");
        room.setId("room-1");
        room.setHost(host);
        room.setMode(Room.RoomMode.TEAM_VS_TEAM);
        room.setStatus(Room.RoomStatus.LOBBY);
        for (int i = 0; i < 5; i++) players.add(player("a" + i, RoomPlayer.Team.A, true));
        players.add(player("b0", RoomPlayer.Team.B, true));
        lenient().when(roomRepository.findById("room-1")).thenReturn(Optional.of(room));
        lenient().when(roomPlayerRepository.findByRoomId("room-1")).thenReturn(players);
    }

    @Test
    void host_shufflesIntoBalancedTeams_andEveryoneMustReadyAgain() throws Exception {
        roomService.shuffleTeams("room-1", "host");

        long a = players.stream().filter(p -> p.getTeam() == RoomPlayer.Team.A).count();
        long b = players.stream().filter(p -> p.getTeam() == RoomPlayer.Team.B).count();
        assertEquals(3, a);
        assertEquals(3, b);
        assertTrue(players.stream().noneMatch(RoomPlayer::getIsReady));
        verify(roomPlayerRepository).saveAll(anyList());
        verify(webSocketController).broadcastRoomState("room-1");
    }

    @Test
    void nonHost_cannotShuffle_inANormalRoom() {
        Exception e = assertThrows(Exception.class, () -> roomService.shuffleTeams("room-1", "a1"));
        assertTrue(e.getMessage().contains("chủ phòng"));
    }

    @Test
    void quickMatch_anyPlayerInTheRoomCanShuffle() throws Exception {
        room.setQuickMatch(true);
        when(roomPlayerRepository.findByRoomIdAndUserId("room-1", "a1")).thenReturn(Optional.of(players.get(1)));

        roomService.shuffleTeams("room-1", "a1");

        verify(webSocketController).broadcastRoomState("room-1");
    }

    @Test
    void onlyInLobby_andOnlyForTeamMode() {
        room.setStatus(Room.RoomStatus.IN_PROGRESS);
        assertThrows(Exception.class, () -> roomService.shuffleTeams("room-1", "host"));
        room.setStatus(Room.RoomStatus.LOBBY);
        room.setMode(Room.RoomMode.SPEED_RACE);
        assertThrows(Exception.class, () -> roomService.shuffleTeams("room-1", "host"));
    }
}
