package com.biblequiz.modules.room.service;

import com.biblequiz.modules.room.entity.RoomPlayer;
import com.biblequiz.modules.room.repository.RoomAnswerRepository;
import com.biblequiz.modules.room.repository.RoomPlayerRepository;
import com.biblequiz.modules.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * PCV-16 — khán giả Đấu vương đoán người thắng mỗi trận (design §2.4): chỉ người đang xem, chỉ chọn một
 * trong hai người đang đấu, đổi được tới khi câu đầu của trận bắt đầu; đoán đúng +1 điểm đoán.
 */
@ExtendWith(MockitoExtension.class)
class SuddenDeathPredictionTest {

    private static final String ROOM = "room-1";

    @Mock private RoomPlayerRepository players;
    @Mock private RoomAnswerRepository answers;
    @Mock private RoomStateService state;
    @InjectMocks private SuddenDeathMatchService service;

    private final Map<String, RoomPlayer> byId = new HashMap<>();

    private RoomPlayer player(String id, RoomPlayer.PlayerStatus status) {
        User u = new User();
        u.setId(id);
        RoomPlayer p = new RoomPlayer();
        p.setUser(u);
        p.setUsername(id.toUpperCase());
        p.setPlayerStatus(status);
        byId.put(id, p);
        return p;
    }

    @BeforeEach
    void setUp() {
        lenient().when(players.findByRoomIdAndUserId(eq(ROOM), anyString()))
                .thenAnswer(i -> Optional.ofNullable(byId.get(i.<String>getArgument(1))));
        lenient().when(players.save(any())).thenAnswer(i -> i.getArgument(0));
        lenient().when(state.getSdChampion(ROOM)).thenReturn("king");
        lenient().when(state.getSdChallenger(ROOM)).thenReturn("chall");
        player("king", RoomPlayer.PlayerStatus.ACTIVE);
        player("chall", RoomPlayer.PlayerStatus.ACTIVE);
        player("fan", RoomPlayer.PlayerStatus.SPECTATOR);
        player("fan2", RoomPlayer.PlayerStatus.SPECTATOR);
    }

    @Test
    void spectator_canPickOneOfTheDuelists_whileTheWindowIsOpen() {
        when(state.getOpenSdPredictionMatch(ROOM)).thenReturn(3);

        assertTrue(service.recordPrediction(ROOM, "fan", 3, "chall"));
        verify(state).putSdPrediction(ROOM, 3, "fan", "chall");
    }

    @Test
    void closedWindow_orAnotherMatch_isRejected() {
        when(state.getOpenSdPredictionMatch(ROOM)).thenReturn(null);
        assertFalse(service.recordPrediction(ROOM, "fan", 3, "king"));

        when(state.getOpenSdPredictionMatch(ROOM)).thenReturn(4);
        assertFalse(service.recordPrediction(ROOM, "fan", 3, "king"));
        verify(state, never()).putSdPrediction(anyString(), anyInt(), anyString(), anyString());
    }

    @Test
    void duelists_cannotPredict_andPickMustBeADuelist() {
        when(state.getOpenSdPredictionMatch(ROOM)).thenReturn(3);

        assertFalse(service.recordPrediction(ROOM, "king", 3, "king"), "người đang đấu không đoán");
        assertFalse(service.recordPrediction(ROOM, "fan", 3, "fan2"), "chỉ đoán một trong hai người đang đấu");
        verify(state, never()).putSdPrediction(anyString(), anyInt(), anyString(), anyString());
    }

    @Test
    void settle_givesAPointToEveryCorrectGuess() {
        when(state.getSdPredictions(ROOM, 3)).thenReturn(Map.of("fan", "chall", "fan2", "king"));

        List<String> correct = service.settlePredictions(ROOM, 3, "chall");

        assertEquals(List.of("fan"), correct);
        assertEquals(1, byId.get("fan").getPredictionPoints());
        assertEquals(0, byId.get("fan2").getPredictionPoints());
    }

    @Test
    void startNextMatch_numbersTheMatch_andOpensPredictions() {
        when(state.getSdQueue(ROOM)).thenReturn(new ArrayList<>(List.of("fan")));
        when(state.getSdChallenger(ROOM)).thenReturn("fan");
        when(state.nextSdMatchNo(ROOM)).thenReturn(2);

        SuddenDeathMatchService.MatchInfo m = service.startNextMatch(ROOM);

        assertEquals(2, m.matchNo);
        verify(state).openSdPredictions(ROOM, 2);
    }
}
