package com.biblequiz.modules.room.service;

import com.biblequiz.api.websocket.WebSocketMessage;
import com.biblequiz.modules.room.entity.Room;
import com.biblequiz.modules.room.entity.RoomPlayer;
import com.biblequiz.modules.room.repository.RoomPlayerRepository;
import com.biblequiz.modules.room.repository.RoomRepository;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * PCV-22 — kênh riêng của mỗi đội trong Đội đấu đội (design §3.2): phiếu của đồng đội (chế độ Hội ý) và
 * chat đội, gửi qua {@code /user/queue/room/{id}/team} tới từng đồng đội là người thật; đội kia không
 * nhận. Phiếu chỉ có ai chọn phương án nào — không có đúng/sai.
 */
@Service
public class TeamChannelService {

    static final int CHAT_MAX = 300;

    private final RoomRepository roomRepository;
    private final RoomPlayerRepository roomPlayerRepository;
    private final SimpMessagingTemplate messagingTemplate;

    public TeamChannelService(RoomRepository roomRepository, RoomPlayerRepository roomPlayerRepository,
                              SimpMessagingTemplate messagingTemplate) {
        this.roomRepository = roomRepository;
        this.roomPlayerRepository = roomPlayerRepository;
        this.messagingTemplate = messagingTemplate;
    }

    /** Hội ý: một thành viên vừa chọn — báo cho đồng đội. Phòng không bật Hội ý thì không gửi gì. */
    @Transactional(readOnly = true)
    public void sendVote(String roomId, String voterId, String voterName, int answerIndex) {
        Optional<Room> room = roomRepository.findById(roomId);
        if (room.isEmpty() || room.get().getMode() != Room.RoomMode.TEAM_VS_TEAM || !room.get().isTeamConsensus()) return;
        send(roomId, voterId, WebSocketMessage.MessageTypes.TEAM_VOTE,
                Map.of("playerId", voterId, "username", voterName, "answerIndex", answerIndex));
    }

    /** Chat đội: chỉ đồng đội nhận; bỏ tin rỗng, cắt còn {@value #CHAT_MAX} ký tự. */
    @Transactional(readOnly = true)
    public void sendChat(String roomId, String senderId, String senderName, String text) {
        String clean = text == null ? "" : text.trim();
        if (clean.isEmpty()) return;
        if (clean.length() > CHAT_MAX) clean = clean.substring(0, CHAT_MAX);
        send(roomId, senderId, WebSocketMessage.MessageTypes.TEAM_CHAT,
                Map.of("senderId", senderId, "sender", senderName, "text", clean));
    }

    private void send(String roomId, String fromUserId, String type, Map<String, Object> data) {
        List<RoomPlayer> roster = roomPlayerRepository.findByRoomId(roomId);
        RoomPlayer.Team team = roster.stream()
                .filter(p -> p.getUser().getId().equals(fromUserId))
                .map(RoomPlayer::getTeam)
                .findFirst().orElse(null);
        if (team == null) return;
        WebSocketMessage.Message message = new WebSocketMessage.Message(type, data);
        for (RoomPlayer p : roster) {
            if (p.getTeam() != team || p.getUser().getId().equals(fromUserId) || p.isBot()) continue;
            if (p.getPlayerStatus() == RoomPlayer.PlayerStatus.LEFT) continue;
            String email = p.getUser().getEmail();
            if (email == null) continue;
            messagingTemplate.convertAndSendToUser(email, "/queue/room/" + roomId + "/team", message);
        }
    }
}
