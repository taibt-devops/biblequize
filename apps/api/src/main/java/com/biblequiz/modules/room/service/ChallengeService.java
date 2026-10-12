package com.biblequiz.modules.room.service;

import com.biblequiz.modules.room.entity.Challenge;
import com.biblequiz.modules.room.entity.Room;
import com.biblequiz.modules.room.repository.ChallengeRepository;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;
import com.biblequiz.api.websocket.WebSocketMessage;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Map;
import java.util.UUID;

@Service
public class ChallengeService {

    private final ChallengeRepository challengeRepository;
    private final UserRepository userRepository;
    private final SimpMessagingTemplate messagingTemplate;

    /** PCV-23: nhận lời thì mở phòng Đua tốc độ riêng cho hai người. */
    @org.springframework.beans.factory.annotation.Autowired
    private RoomService roomService;

    static final int QUESTIONS = 10;
    static final int SECONDS = 20;

    public ChallengeService(ChallengeRepository challengeRepository,
                            UserRepository userRepository,
                            SimpMessagingTemplate messagingTemplate) {
        this.challengeRepository = challengeRepository;
        this.userRepository = userRepository;
        this.messagingTemplate = messagingTemplate;
    }

    @Transactional
    public Challenge createChallenge(String challengerId, String challengedId) {
        if (challengerId.equals(challengedId)) {
            throw new IllegalArgumentException("Cannot challenge yourself");
        }

        User challenger = userRepository.findById(challengerId).orElseThrow();
        User challenged = userRepository.findById(challengedId)
                .orElseThrow(() -> new IllegalArgumentException("Không tìm thấy người được thách"));
        if (challenged.isBot()) throw new IllegalArgumentException("Không thể thách người máy");

        // PCV-23: đang có lời thách chờ người này nhận thì dùng lại, không gửi thêm.
        Optional<Challenge> waiting = challengeRepository.findByChallengedIdAndStatus(challengedId, Challenge.Status.PENDING)
                .stream()
                .filter(c -> !c.isExpired() && c.getChallenger().getId().equals(challengerId))
                .findFirst();
        if (waiting.isPresent()) return waiting.get();

        Challenge challenge = new Challenge(
                UUID.randomUUID().toString(),
                challenger,
                challenged,
                LocalDateTime.now().plusMinutes(5)
        );
        challengeRepository.save(challenge);

        // Send WebSocket notification to challenged user
        messagingTemplate.convertAndSendToUser(
                challenged.getEmail(),
                "/queue/challenges",
                new WebSocketMessage.Message(
                        WebSocketMessage.MessageTypes.CHALLENGE_RECEIVED,
                        Map.of(
                                "challengeId", challenge.getId(),
                                "challengerName", challenger.getName(),
                                "challengerId", challenger.getId(),
                                "expiresAt", challenge.getExpiresAt().toString(),
                                "secondsLeft", challenge.secondsLeft()
                        )
                )
        );

        return challenge;
    }

    @Transactional
    public Map<String, String> acceptChallenge(String challengeId, String userId) {
        Challenge challenge = challengeRepository.findById(challengeId)
                .orElseThrow(() -> new IllegalArgumentException("Challenge not found"));

        if (!challenge.getChallenged().getId().equals(userId)) {
            throw new IllegalArgumentException("Not your challenge to accept");
        }
        if (challenge.getStatus() != Challenge.Status.PENDING) {
            throw new IllegalArgumentException("Lời thách không còn hiệu lực");
        }
        if (challenge.isExpired()) {
            challenge.setStatus(Challenge.Status.EXPIRED);
            challengeRepository.save(challenge);
            throw new IllegalArgumentException("Challenge has expired");
        }

        // PCV-23: phòng Đua tốc độ riêng tư 10 câu × 20 giây; người thách làm chủ phòng và chơi cùng.
        Room room;
        try {
            User challenger = challenge.getChallenger();
            User challenged = challenge.getChallenged();
            room = roomService.createRoom("Thách đấu: " + challenger.getName() + " – " + challenged.getName(),
                    challenger, 2, QUESTIONS, SECONDS, Room.RoomMode.SPEED_RACE, false, Room.RoomDifficulty.MIXED,
                    "ALL", Room.QuestionSource.DATABASE, null, true, "vi");
            roomService.joinRoom(room.getRoomCode(), challenged);
        } catch (Exception e) {
            throw new IllegalArgumentException("ALREADY_IN_ANOTHER_ROOM".equals(e.getMessage())
                    ? "Bạn đang ở một phòng khác — rời phòng đó rồi nhận lời" : String.valueOf(e.getMessage()));
        }
        challenge.setStatus(Challenge.Status.ACCEPTED);
        challenge.setRoomId(room.getId());
        challengeRepository.save(challenge);

        return Map.of(
                "challengeId", challenge.getId(),
                "challengerId", challenge.getChallenger().getId(),
                "challengedId", challenge.getChallenged().getId(),
                "status", "ACCEPTED",
                "roomId", room.getId(),
                "roomCode", room.getRoomCode()
        );
    }

    @Transactional
    public void declineChallenge(String challengeId, String userId) {
        Challenge challenge = challengeRepository.findById(challengeId)
                .orElseThrow(() -> new IllegalArgumentException("Challenge not found"));

        if (!challenge.getChallenged().getId().equals(userId)) {
            throw new IllegalArgumentException("Not your challenge to decline");
        }

        challenge.setStatus(Challenge.Status.DECLINED);
        challengeRepository.save(challenge);
    }

    /** PCV-23: người thách hủy khi người kia chưa nhận. */
    @Transactional
    public void cancelChallenge(String challengeId, String userId) {
        Challenge challenge = challengeRepository.findById(challengeId)
                .orElseThrow(() -> new IllegalArgumentException("Challenge not found"));
        if (!challenge.getChallenger().getId().equals(userId)) {
            throw new IllegalArgumentException("Chỉ người thách mới hủy được");
        }
        if (challenge.getStatus() != Challenge.Status.PENDING) {
            throw new IllegalArgumentException("Lời thách không còn chờ");
        }
        challenge.setStatus(Challenge.Status.CANCELLED);
        challengeRepository.save(challenge);
    }

    /** PCV-23: trạng thái lời thách cho hai người trong cuộc (người thách hỏi mỗi 3 giây khi chờ). */
    @Transactional(readOnly = true)
    public Map<String, Object> getChallenge(String challengeId, String userId) {
        Challenge c = challengeRepository.findById(challengeId)
                .orElseThrow(() -> new IllegalArgumentException("Challenge not found"));
        boolean participant = c.getChallenger().getId().equals(userId) || c.getChallenged().getId().equals(userId);
        if (!participant) throw new IllegalArgumentException("Challenge not found");
        String status = c.getStatus() == Challenge.Status.PENDING && c.isExpired() ? "EXPIRED" : c.getStatus().name();
        Map<String, Object> view = new java.util.HashMap<>();
        view.put("challengeId", c.getId());
        view.put("status", status);
        view.put("roomId", c.getRoomId());
        view.put("challengerName", c.getChallenger().getName());
        view.put("challengedName", c.getChallenged().getName());
        view.put("expiresAt", c.getExpiresAt().toString());
        view.put("secondsLeft", c.secondsLeft());
        return view;
    }

    public List<Challenge> getPendingChallenges(String userId) {
        return challengeRepository.findByChallengedIdAndStatus(userId, Challenge.Status.PENDING)
                .stream()
                .filter(c -> !c.isExpired())
                .toList();
    }

    @Scheduled(fixedRate = 60_000)
    @Transactional
    public void expirePendingChallenges() {
        List<Challenge> expired = challengeRepository.findExpiredPending(LocalDateTime.now());
        for (Challenge c : expired) {
            c.setStatus(Challenge.Status.EXPIRED);
        }
        if (!expired.isEmpty()) {
            challengeRepository.saveAll(expired);
        }
    }
}
