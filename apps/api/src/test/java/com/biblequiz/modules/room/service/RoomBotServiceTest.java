package com.biblequiz.modules.room.service;

import com.biblequiz.api.websocket.RoomWebSocketController;
import com.biblequiz.modules.room.entity.Room;
import com.biblequiz.modules.room.entity.RoomPlayer;
import com.biblequiz.modules.room.repository.RoomPlayerRepository;
import com.biblequiz.modules.room.repository.RoomRepository;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** PCV-20 — thêm người máy vào phòng (design §3.1). */
@ExtendWith(MockitoExtension.class)
class RoomBotServiceTest {

    @Mock private RoomRepository roomRepository;
    @Mock private RoomPlayerRepository roomPlayerRepository;
    @Mock private UserRepository userRepository;
    @Mock private RoomWebSocketController webSocketController;
    @InjectMocks private RoomBotService service;

    private final Room room = new Room();
    private final List<RoomPlayer> players = new ArrayList<>();
    private final List<User> bots = new ArrayList<>();

    private User user(String id, boolean bot) {
        User u = new User();
        u.setId(id);
        u.setName(bot ? "Máy " + id : id);
        u.setIsBot(bot);
        return u;
    }

    private RoomPlayer join(User u) {
        RoomPlayer p = new RoomPlayer("rp-" + u.getId(), room, u, u.getName());
        players.add(p);
        return p;
    }

    @BeforeEach
    void setUp() {
        room.setId("room-1");
        room.setHost(user("host", false));
        room.setStatus(Room.RoomStatus.LOBBY);
        room.setMode(Room.RoomMode.SPEED_RACE);
        room.setMaxPlayers(10);
        join(room.getHost());
        for (int i = 1; i <= 6; i++) bots.add(user("bot-0" + i, true));
        lenient().when(roomRepository.findById("room-1")).thenReturn(Optional.of(room));
        lenient().when(roomPlayerRepository.findByRoomId("room-1")).thenReturn(players);
        lenient().when(userRepository.findByIsBotTrueOrderByIdAsc()).thenReturn(bots);
        lenient().when(roomPlayerRepository.save(any(RoomPlayer.class))).thenAnswer(i -> { players.add(i.getArgument(0)); return i.getArgument(0); });
    }

    @Test
    void host_addsABot_thatIsAlwaysReady_withItsLevel() throws Exception {
        RoomPlayer bot = service.addBot("room-1", "host", RoomBotService.BotLevel.MEDIUM);

        assertEquals("bot-01", bot.getUser().getId());
        assertTrue(bot.getIsReady());
        assertEquals("MEDIUM", bot.getBotLevel());
        verify(webSocketController).broadcastRoomState("room-1");
    }

    @Test
    void picksABotNotAlreadyInTheRoom() throws Exception {
        join(bots.get(0));

        assertEquals("bot-02", service.addBot("room-1", "host", RoomBotService.BotLevel.EASY).getUser().getId());
    }

    @Test
    void atMostFiveBots_andOnlyWhileThereIsRoom() {
        for (int i = 0; i < 5; i++) join(bots.get(i));
        Exception e = assertThrows(Exception.class, () -> service.addBot("room-1", "host", RoomBotService.BotLevel.EASY));
        assertTrue(e.getMessage().contains("5"));

        players.removeIf(p -> p.getUser().isBot());
        room.setMaxPlayers(1);
        assertThrows(Exception.class, () -> service.addBot("room-1", "host", RoomBotService.BotLevel.EASY));
    }

    @Test
    void onlyHost_inANormalRoom_quickMatchAnyPlayer() throws Exception {
        User guest = user("guest", false);
        join(guest);
        assertThrows(Exception.class, () -> service.addBot("room-1", "guest", RoomBotService.BotLevel.EASY));

        room.setQuickMatch(true);
        when(roomPlayerRepository.findByRoomIdAndUserId("room-1", "guest")).thenReturn(Optional.of(players.get(1)));
        assertNotNull(service.addBot("room-1", "guest", RoomBotService.BotLevel.EASY));
    }

    @Test
    void onlyInLobby() {
        room.setStatus(Room.RoomStatus.IN_PROGRESS);
        assertThrows(Exception.class, () -> service.addBot("room-1", "host", RoomBotService.BotLevel.EASY));
    }

    @Test
    void teamMode_botJoinsTheSmallerTeam() throws Exception {
        room.setMode(Room.RoomMode.TEAM_VS_TEAM);
        players.get(0).setTeam(RoomPlayer.Team.A);

        RoomPlayer bot = service.addBot("room-1", "host", RoomBotService.BotLevel.HARD);

        assertEquals(RoomPlayer.Team.B, bot.getTeam());
    }

    @Test
    void savedRowCarriesTheBotUser() throws Exception {
        service.addBot("room-1", "host", RoomBotService.BotLevel.EASY);
        ArgumentCaptor<RoomPlayer> saved = ArgumentCaptor.forClass(RoomPlayer.class);
        verify(roomPlayerRepository).save(saved.capture());
        assertTrue(saved.getValue().getUser().isBot());
    }
}
