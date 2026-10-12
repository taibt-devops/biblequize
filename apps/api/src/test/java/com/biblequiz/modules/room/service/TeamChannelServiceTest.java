package com.biblequiz.modules.room.service;

import com.biblequiz.api.websocket.WebSocketMessage;
import com.biblequiz.modules.room.entity.Room;
import com.biblequiz.modules.room.entity.RoomPlayer;
import com.biblequiz.modules.room.repository.RoomPlayerRepository;
import com.biblequiz.modules.room.repository.RoomRepository;
import com.biblequiz.modules.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** PCV-22 — phiếu và chat của đội chỉ tới đồng đội (người thật), đội kia không nhận. */
@ExtendWith(MockitoExtension.class)
class TeamChannelServiceTest {

    @Mock private RoomRepository roomRepository;
    @Mock private RoomPlayerRepository roomPlayerRepository;
    @Mock private SimpMessagingTemplate messagingTemplate;
    @InjectMocks private TeamChannelService service;

    private final Room room = new Room();
    private final List<RoomPlayer> roster = new ArrayList<>();

    private void member(String id, RoomPlayer.Team team, boolean bot) {
        User u = new User();
        u.setId(id);
        u.setEmail(id + "@mail");
        u.setIsBot(bot);
        RoomPlayer p = new RoomPlayer("rp-" + id, room, u, id);
        p.setTeam(team);
        roster.add(p);
    }

    @BeforeEach
    void setUp() {
        room.setId("room-1");
        room.setMode(Room.RoomMode.TEAM_VS_TEAM);
        room.setTeamConsensus(true);
        member("a1", RoomPlayer.Team.A, false);
        member("a2", RoomPlayer.Team.A, false);
        member("a3", RoomPlayer.Team.A, true);
        member("b1", RoomPlayer.Team.B, false);
        lenient().when(roomRepository.findById("room-1")).thenReturn(Optional.of(room));
        lenient().when(roomPlayerRepository.findByRoomId("room-1")).thenReturn(roster);
    }

    @Test
    void vote_goesToHumanTeammatesOnly() {
        service.sendVote("room-1", "a1", "An", 2);

        verify(messagingTemplate).convertAndSendToUser(eq("a2@mail"), eq("/queue/room/room-1/team"), any(WebSocketMessage.Message.class));
        verify(messagingTemplate, never()).convertAndSendToUser(eq("a1@mail"), anyString(), any());
        verify(messagingTemplate, never()).convertAndSendToUser(eq("a3@mail"), anyString(), any());
        verify(messagingTemplate, never()).convertAndSendToUser(eq("b1@mail"), anyString(), any());
    }

    @Test
    void votePayload_carriesWhoAndWhichOption_notCorrectness() {
        service.sendVote("room-1", "a1", "An", 2);

        ArgumentCaptor<WebSocketMessage.Message> msg = ArgumentCaptor.forClass(WebSocketMessage.Message.class);
        verify(messagingTemplate).convertAndSendToUser(eq("a2@mail"), anyString(), msg.capture());
        assertEquals("TEAM_VOTE", msg.getValue().getType());
        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) msg.getValue().getData();
        assertEquals(Map.of("playerId", "a1", "username", "An", "answerIndex", 2), data);
    }

    @Test
    void normalTeamRoom_noVotesShared() {
        room.setTeamConsensus(false);
        service.sendVote("room-1", "a1", "An", 2);
        verifyNoInteractions(messagingTemplate);
    }

    @Test
    void teamChat_neverReachesTheOtherTeam() {
        service.sendChat("room-1", "b1", "Bình", "chọn C");

        verify(messagingTemplate, never()).convertAndSendToUser(startsWith("a"), anyString(), any());
    }

    @Test
    void teamChat_toTeammates_trimmedTo300() {
        service.sendChat("room-1", "a1", "An", "  " + "x".repeat(400) + "  ");

        ArgumentCaptor<WebSocketMessage.Message> msg = ArgumentCaptor.forClass(WebSocketMessage.Message.class);
        verify(messagingTemplate).convertAndSendToUser(eq("a2@mail"), eq("/queue/room/room-1/team"), msg.capture());
        assertEquals("TEAM_CHAT", msg.getValue().getType());
        @SuppressWarnings("unchecked")
        Map<String, Object> data = (Map<String, Object>) msg.getValue().getData();
        assertEquals(300, data.get("text").toString().length());
    }

    @Test
    void emptyChat_isDropped() {
        service.sendChat("room-1", "a1", "An", "   ");
        verifyNoInteractions(messagingTemplate);
    }
}
