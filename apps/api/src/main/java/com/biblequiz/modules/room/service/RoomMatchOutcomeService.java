package com.biblequiz.modules.room.service;

import com.biblequiz.modules.quiz.service.DailyMissionService;
import com.biblequiz.modules.room.entity.RoomPlayer;
import com.biblequiz.modules.room.repository.RoomPlayerRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * PCV-6 — việc làm sau khi một trận kết thúc bình thường (không tính Quản trò kết thúc sớm):
 * nhiệm vụ ngày "Chơi 1 trận Phòng chơi" cho mọi người thật còn trong trận đã trả lời ít nhất một câu,
 * và "Thắng 1 phòng" cho người hạng 1 có ít nhất một câu đúng. Không cộng XP — XP là điểm bảng xếp hạng (DECISIONS 2026-10-12).
 * Lỗi ở đây chỉ ghi log, không làm hỏng màn kết quả.
 */
@Service
public class RoomMatchOutcomeService {

    private static final Logger log = LoggerFactory.getLogger(RoomMatchOutcomeService.class);

    private final RoomPlayerRepository playerRepository;
    private final DailyMissionService missionService;

    public RoomMatchOutcomeService(RoomPlayerRepository playerRepository, DailyMissionService missionService) {
        this.playerRepository = playerRepository;
        this.missionService = missionService;
    }

    public void recordOutcome(String roomId) {
        for (RoomPlayer p : playerRepository.findByRoomId(roomId)) {
            if (p.getPlayerStatus() == RoomPlayer.PlayerStatus.LEFT) continue;
            // Ngồi im cả trận thì không tính là đã chơi — chặn "mở phòng với bạn, cùng không trả lời,
            // cùng đồng hạng 1" để lấy nhiệm vụ thắng.
            if (p.getTotalAnswered() == null || p.getTotalAnswered() == 0) continue;
            String userId = p.getUser().getId();
            try {
                missionService.trackProgress(userId, "play_multiplayer_room", 1);
                missionService.trackProgress(userId, "play_any_mode", 1);
                boolean answeredSomethingRight = p.getCorrectAnswers() != null && p.getCorrectAnswers() > 0;
                if (p.getFinalRank() != null && p.getFinalRank() == 1 && answeredSomethingRight) {
                    missionService.trackProgress(userId, "win_multiplayer_room", 1);
                }
            } catch (Exception e) {
                log.warn("[ROOM-OUTCOME] mission update failed user={} room={}: {}", userId, roomId, e.getMessage());
            }
        }
    }
}
