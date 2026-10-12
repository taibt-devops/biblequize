package com.biblequiz.modules.quiz.service;

import com.biblequiz.infrastructure.service.CacheService;
import com.biblequiz.infrastructure.time.GameClock;
import com.biblequiz.modules.quiz.entity.UserDailyProgress;
import com.biblequiz.modules.quiz.repository.UserDailyProgressRepository;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

/**
 * PCV-7 — cộng XP thưởng nhiệm vụ ngày (xong cả 3 nhiệm vụ → 50 XP, một lần mỗi ngày).
 * Cùng đường ghi XP với Thử thách ngày ({@code DailyChallengeService.creditCompletionXp}):
 * cộng vào {@code UserDailyProgress.pointsCounted} của hôm nay rồi xoá cache bảng xếp hạng.
 */
@Service
public class MissionRewardService {

    private static final Logger log = LoggerFactory.getLogger(MissionRewardService.class);

    private final UserRepository userRepository;
    private final UserDailyProgressRepository progressRepository;
    private final CacheService cacheService;

    public MissionRewardService(UserRepository userRepository,
                                UserDailyProgressRepository progressRepository,
                                CacheService cacheService) {
        this.userRepository = userRepository;
        this.progressRepository = progressRepository;
        this.cacheService = cacheService;
    }

    @Transactional
    public void creditBonus(String userId, int xp) {
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) return;
        LocalDate today = GameClock.today();
        UserDailyProgress udp = progressRepository.findByUserIdAndDate(userId, today).orElseGet(() -> {
            UserDailyProgress fresh = new UserDailyProgress(UUID.randomUUID().toString(), user, today);
            fresh.setLivesRemaining(100);
            fresh.setPointsCounted(0);
            fresh.setQuestionsCounted(0);
            return fresh;
        });
        int before = Optional.ofNullable(udp.getPointsCounted()).orElse(0);
        udp.setPointsCounted(before + xp);
        progressRepository.save(udp);
        cacheService.invalidateLeaderboards();
        log.info("[DAILY_MISSION] Bonus XP user={} +{} (pointsCounted {}→{})", userId, xp, before, before + xp);
    }
}
