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

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** PCV-17 — "Chơi lại với nhóm này" (design §2.5). */
@ExtendWith(MockitoExtension.class)
class RoomServiceRematchTest {

    @Mock private RoomRepository roomRepository;
    @Mock private RoomPlayerRepository roomPlayerRepository;
    @Mock private RoomWebSocketController webSocketController;
    @Mock private RoomStateService roomStateService;
    @InjectMocks private RoomService roomService;

    private final Map<String, Room> rooms = new HashMap<>();
    private final User host = new User();
    private Room old;

    @BeforeEach
    void setUp() {
        host.setId("host");
        host.setName("Chủ phòng");
        old = new Room();
        old.setId("old");
        old.setRoomCode("OLD111");
        old.setRoomName("Nhóm thứ Tư");
        old.setHost(host);
        old.setStatus(Room.RoomStatus.ENDED);
        old.setMode(Room.RoomMode.BATTLE_ROYALE);
        old.setQuestionCount(15);
        old.setTimePerQuestion(20);
        old.setDifficulty(Room.RoomDifficulty.HARD);
        old.setBookScope("Genesis");
        old.setLanguage("en");
        old.setIsPublic(false);
        old.setMaxPlayers(12);
        old.setHostPlaysGame(true);
        rooms.put("old", old);
        lenient().when(roomRepository.findById(anyString())).thenAnswer(i -> Optional.ofNullable(rooms.get(i.<String>getArgument(0))));
        lenient().when(roomRepository.save(any(Room.class))).thenAnswer(i -> { Room r = i.getArgument(0); rooms.put(r.getId(), r); return r; });
        lenient().when(roomRepository.findByRoomCode(anyString())).thenReturn(Optional.empty());
        lenient().when(roomPlayerRepository.findByRoomIdAndUserId(anyString(), anyString())).thenReturn(Optional.empty());
        lenient().when(roomPlayerRepository.findByRoomId(anyString())).thenReturn(List.of());
    }

    @Test
    void host_getsANewLobbyWithTheSameSettings_andJoinsIt() throws Exception {
        when(roomStateService.claimRematch(eq("old"), anyString())).thenReturn(null);

        RoomService.RematchResult r = roomService.rematch("old", host);

        assertTrue(r.created);
        Room room = r.room;
        assertNotEquals("old", room.getId());
        assertEquals(Room.RoomStatus.LOBBY, room.getStatus());
        assertEquals(Room.RoomMode.BATTLE_ROYALE, room.getMode());
        assertEquals(15, room.getQuestionCount());
        assertEquals(20, room.getTimePerQuestion());
        assertEquals(Room.RoomDifficulty.HARD, room.getDifficulty());
        assertEquals("Genesis", room.getBookScope());
        assertEquals("en", room.getLanguage());
        assertFalse(room.getIsPublic());
        assertEquals(12, room.getMaxPlayers());
        assertTrue(room.isHostPlaysGame());
        assertEquals("host", room.getHost().getId());
        verify(roomPlayerRepository).save(argThat((RoomPlayer p) -> p.getUser().getId().equals("host")));
        verify(webSocketController).broadcastRematchReady(eq("old"), eq(room.getId()), eq(room.getRoomCode()));
    }

    @Test
    void secondRequest_returnsTheRoomAlreadyCreated() throws Exception {
        Room existing = new Room();
        existing.setId("new-1");
        existing.setRoomCode("NEW111");
        rooms.put("new-1", existing);
        when(roomStateService.claimRematch(eq("old"), anyString())).thenReturn("new-1");

        RoomService.RematchResult r = roomService.rematch("old", host);

        assertFalse(r.created);
        assertEquals("new-1", r.room.getId());
        verify(webSocketController, never()).broadcastRematchReady(anyString(), anyString(), anyString());
    }

    @Test
    void onlyAfterTheGameEnded() {
        old.setStatus(Room.RoomStatus.IN_PROGRESS);
        assertThrows(Exception.class, () -> roomService.rematch("old", host));
    }

    @Test
    void normalRoom_onlyTheHostCanOpenARematch_quickMatch_anyPlayer() throws Exception {
        User player = new User();
        player.setId("p1");
        player.setName("An");
        assertThrows(Exception.class, () -> roomService.rematch("old", player));

        old.setQuickMatch(true);
        when(roomPlayerRepository.findByRoomIdAndUserId("old", "p1")).thenReturn(Optional.of(new RoomPlayer("rp", old, player, "An")));
        when(roomStateService.claimRematch(eq("old"), anyString())).thenReturn(null);

        RoomService.RematchResult r = roomService.rematch("old", player);

        assertTrue(r.room.isQuickMatch());
        assertEquals("p1", r.room.getHost().getId());
    }

    /** Review: Đấu nhanh chọn sẵn câu ngẫu nhiên vào customQuestionIds — chơi lại phải ra câu mới. */
    @Test
    void quickMatchRematch_picksFreshQuestions_groupSetRematch_keepsTheSet() throws Exception {
        old.setQuickMatch(true);
        old.setQuestionSource(Room.QuestionSource.DATABASE);
        old.setCustomQuestionIds(new java.util.ArrayList<>(List.of("q1", "q2", "q3")));
        when(roomStateService.claimRematch(eq("old"), anyString())).thenReturn(null);

        Room quick = roomService.rematch("old", host).room;
        assertTrue(quick.getCustomQuestionIds() == null || quick.getCustomQuestionIds().isEmpty(),
                "câu mới theo phạm vi sách, không lặp lại đúng các câu vừa chơi");

        Room group = new Room();
        group.setId("old2");
        group.setRoomCode("OLD222");
        group.setRoomName("Bộ câu nhóm");
        group.setHost(host);
        group.setStatus(Room.RoomStatus.ENDED);
        group.setMode(Room.RoomMode.SPEED_RACE);
        group.setQuestionSource(Room.QuestionSource.DATABASE);
        group.setGroupQuizSetId("set-1");
        group.setCustomQuestionIds(new java.util.ArrayList<>(List.of("g1", "g2")));
        rooms.put("old2", group);
        when(roomStateService.claimRematch(eq("old2"), anyString())).thenReturn(null);

        Room again = roomService.rematch("old2", host).room;
        assertEquals(List.of("g1", "g2"), again.getCustomQuestionIds(), "bộ câu của nhóm giữ nguyên");
    }

    @Test
    void aiQuestionSource_becomesTheQuestionBank() throws Exception {
        old.setQuestionSource(Room.QuestionSource.AI_GENERATED);
        old.setAiQuestionsPayload("[{...}]");
        when(roomStateService.claimRematch(eq("old"), anyString())).thenReturn(null);

        Room room = roomService.rematch("old", host).room;

        assertEquals(Room.QuestionSource.DATABASE, room.getQuestionSource());
        assertNull(room.getAiQuestionsPayload());
    }
}
