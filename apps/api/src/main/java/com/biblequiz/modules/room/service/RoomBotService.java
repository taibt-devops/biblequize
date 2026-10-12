package com.biblequiz.modules.room.service;

import com.biblequiz.api.websocket.RoomWebSocketController;
import com.biblequiz.modules.room.entity.Room;
import com.biblequiz.modules.room.entity.RoomPlayer;
import com.biblequiz.modules.room.repository.RoomPlayerRepository;
import com.biblequiz.modules.room.repository.RoomRepository;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * PCV-20 — người máy trong Phòng chơi (design §3.1). Người máy là tài khoản thật đánh dấu
 * {@code users.is_bot} (không đăng nhập được) nên đi qua đúng đường chơi của người: một dòng
 * {@link RoomPlayer} luôn sẵn sàng, mời ra bằng nút kick như người thật.
 */
@Service
public class RoomBotService {

    public static final int MAX_BOTS = 5;

    public enum BotLevel { EASY, MEDIUM, HARD }

    @Autowired private RoomRepository roomRepository;
    @Autowired private RoomPlayerRepository roomPlayerRepository;
    @Autowired private UserRepository userRepository;
    @Autowired @Lazy private RoomWebSocketController webSocketController;

    /**
     * Thêm một người máy cấp {@code level}: chủ phòng (Đấu nhanh: người trong phòng), khi ở sảnh,
     * tối đa {@link #MAX_BOTS} người máy và phải còn chỗ. Đội đấu đội: vào đội ít người hơn.
     */
    @Transactional
    public RoomPlayer addBot(String roomId, String callerId, BotLevel level) throws Exception {
        Room room = roomRepository.findById(roomId).orElseThrow(() -> new Exception("Phòng không tồn tại"));
        if (room.getStatus() != Room.RoomStatus.LOBBY) throw new Exception("Chỉ thêm người máy khi đang ở sảnh chờ");
        if (room.getMode() == Room.RoomMode.GROUP_LIVE_SEQUENTIAL) {
            throw new Exception("Phòng Chơi cùng nhau của nhóm không có người máy");
        }
        boolean isHost = room.getHost() != null && room.getHost().getId().equals(callerId);
        if (!isHost && !(room.isQuickMatch() && roomPlayerRepository.findByRoomIdAndUserId(roomId, callerId).isPresent())) {
            throw new Exception("Chỉ chủ phòng mới thêm người máy được");
        }

        List<RoomPlayer> players = roomPlayerRepository.findByRoomId(roomId);
        long bots = players.stream().filter(p -> p.getUser() != null && p.getUser().isBot()).count();
        if (bots >= MAX_BOTS) throw new Exception("Tối đa " + MAX_BOTS + " người máy mỗi phòng");
        if (room.getMaxPlayers() != null && players.size() >= room.getMaxPlayers()) throw new Exception("Phòng đã đầy người");

        Set<String> present = players.stream().map(p -> p.getUser().getId()).collect(Collectors.toSet());
        User bot = userRepository.findByIsBotTrueOrderByIdAsc().stream()
                .filter(u -> !present.contains(u.getId()))
                .findFirst()
                .orElseThrow(() -> new Exception("Hết người máy để thêm"));

        RoomPlayer row = newBotRow(room, bot, level, players);
        roomPlayerRepository.save(row);
        room.setCurrentPlayers(players.size() + 1);
        roomRepository.save(room);
        webSocketController.broadcastRoomState(roomId);
        return row;
    }

    /** Dòng người máy cho phòng: luôn sẵn sàng; Đội đấu đội thì vào đội ít người hơn. */
    static RoomPlayer newBotRow(Room room, User bot, BotLevel level, List<RoomPlayer> existing) {
        RoomPlayer row = new RoomPlayer(UUID.randomUUID().toString(), room, bot, bot.getName());
        row.setIsReady(true);
        row.setBotLevel(level.name());
        if (room.getMode() == Room.RoomMode.TEAM_VS_TEAM) {
            long a = existing.stream().filter(p -> p.getTeam() == RoomPlayer.Team.A).count();
            long b = existing.stream().filter(p -> p.getTeam() == RoomPlayer.Team.B).count();
            row.setTeam(a <= b ? RoomPlayer.Team.A : RoomPlayer.Team.B);
        }
        return row;
    }
}
