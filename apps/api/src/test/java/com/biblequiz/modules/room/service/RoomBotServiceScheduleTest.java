package com.biblequiz.modules.room.service;

import com.biblequiz.api.websocket.RoomWebSocketController;
import com.biblequiz.modules.room.entity.Room;
import com.biblequiz.modules.room.entity.RoomPlayer;
import com.biblequiz.modules.room.repository.RoomPlayerRepository;
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
import java.util.Random;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** PCV-21 — hẹn giờ cho người máy trả lời sau mỗi câu, qua đúng đường chấm của người. */
@ExtendWith(MockitoExtension.class)
class RoomBotServiceScheduleTest {

    @Mock private RoomPlayerRepository roomPlayerRepository;
    @Mock private RoomStateService roomStateService;
    @Mock private RoomAnswerProcessor answerProcessor;
    @Mock private RoomWebSocketController webSocketController;
    @InjectMocks private RoomBotService service;

    private final Room room = new Room();
    private final List<RoomPlayer> players = new ArrayList<>();
    private final List<Runnable> scheduled = new ArrayList<>();

    private RoomPlayer bot(String id, RoomPlayer.PlayerStatus status) {
        User u = new User();
        u.setId(id);
        u.setName("Máy " + id);
        u.setIsBot(true);
        RoomPlayer p = new RoomPlayer("rp-" + id, room, u, u.getName());
        p.setBotLevel("HARD");
        p.setPlayerStatus(status);
        players.add(p);
        return p;
    }

    @BeforeEach
    void setUp() {
        room.setId("room-1");
        User human = new User();
        human.setId("h");
        players.add(new RoomPlayer("rp-h", room, human, "Người"));
        lenient().when(roomPlayerRepository.findByRoomId("room-1")).thenReturn(players);
        lenient().when(roomStateService.getAnswerKey("room-1"))
                .thenReturn(Optional.of(new RoomStateService.AnswerKey("q1", 2, "easy", "Genesis")));
        lenient().when(roomStateService.getCurrentRoundId("room-1")).thenReturn(Optional.of("round-1"));
        lenient().when(answerProcessor.process(anyString(), any(), anyInt(), anyInt()))
                .thenReturn(RoomAnswerProcessor.AnswerResult.accepted("Máy", false, 0, false, null));
        service.setScheduler((task, delayMs) -> scheduled.add(task));
        service.setRandom(new Random(1));
    }

    @Test
    void activeBotsAnswer_throughTheAnswerProcessor_andEveryoneSeesTheyAnswered() {
        bot("bot-01", RoomPlayer.PlayerStatus.ACTIVE);
        bot("bot-02", RoomPlayer.PlayerStatus.ACTIVE);

        service.onQuestionStart("room-1", "round-1", 0, 30, 4);
        scheduled.forEach(Runnable::run);

        verify(answerProcessor, times(2)).process(eq("room-1"), argThat(User::isBot), anyInt(), anyInt());
        verify(webSocketController, times(2)).broadcastAnswerSubmitted(eq("room-1"), anyString(), anyString(), eq(0));
    }

    @Test
    void spectatorsAndPlayersWhoLeftDoNotAnswer_ghostsDo() {
        bot("bot-01", RoomPlayer.PlayerStatus.SPECTATOR);
        bot("bot-02", RoomPlayer.PlayerStatus.LEFT);
        bot("bot-03", RoomPlayer.PlayerStatus.ELIMINATED);

        service.onQuestionStart("room-1", "round-1", 0, 30, 4);
        scheduled.forEach(Runnable::run);

        verify(answerProcessor, times(1)).process(eq("room-1"), argThat(u -> u.getId().equals("bot-03")), anyInt(), anyInt());
    }

    @Test
    void answerIsDropped_ifTheRoundMovedOnBeforeItFired() {
        bot("bot-01", RoomPlayer.PlayerStatus.ACTIVE);
        service.onQuestionStart("room-1", "round-1", 0, 30, 4);
        when(roomStateService.getCurrentRoundId("room-1")).thenReturn(Optional.of("round-2"));

        scheduled.forEach(Runnable::run);

        verifyNoInteractions(answerProcessor);
    }

    @Test
    void noBots_nothingScheduled() {
        service.onQuestionStart("room-1", "round-1", 0, 30, 4);
        org.junit.jupiter.api.Assertions.assertTrue(scheduled.isEmpty());
    }
}
