package com.biblequiz.modules.user.service;

import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

@Service
public class ComebackService {

    private static final Logger log = LoggerFactory.getLogger(ComebackService.class);

    private final UserRepository userRepository;

    public ComebackService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public record ComebackStatus(
            long daysSinceLastPlay,
            String rewardTier,     // "NONE", "XP_BOOST", "2X_XP_DAY", "RECOVERY_PACK", "STARTER_PACK"
            boolean claimed,
            Map<String, Object> reward
    ) {}

    /**
     * Check comeback status for a user.
     */
    public ComebackStatus getStatus(String userId) {
        Optional<User> opt = userRepository.findById(userId);
        if (opt.isEmpty()) return new ComebackStatus(0, "NONE", false, null);

        User user = opt.get();
        LocalDate lastActive = user.getLastActiveDate();
        if (lastActive == null) {
            return new ComebackStatus(0, "NONE", false, null);
        }

        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        long daysSince = ChronoUnit.DAYS.between(lastActive, today);

        if (daysSince < 3) {
            return new ComebackStatus(daysSince, "NONE", false, null);
        }

        // Check if already claimed today
        boolean claimed = user.getComebackClaimedAt() != null &&
                user.getComebackClaimedAt().toLocalDate().equals(today);

        String rewardTier = getRewardTier(daysSince);
        Map<String, Object> reward = buildRewardInfo(rewardTier, daysSince);

        return new ComebackStatus(daysSince, rewardTier, claimed, reward);
    }

    /**
     * Claim comeback reward.
     */
    @Transactional
    public Map<String, Object> claim(String userId) {
        ComebackStatus status = getStatus(userId);

        if ("NONE".equals(status.rewardTier())) {
            return Map.of("error", "Không có phần thưởng comeback");
        }
        if (status.claimed()) {
            return Map.of("error", "Bạn đã nhận thưởng hôm nay rồi");
        }

        User user = userRepository.findById(userId).orElseThrow();
        user.setComebackClaimedAt(LocalDateTime.now(ZoneOffset.UTC));
        userRepository.save(user);

        log.info("[COMEBACK] User {} claimed comeback reward: {} (days away: {})",
                userId, status.rewardTier(), status.daysSinceLastPlay());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("bonusType", status.rewardTier());
        result.put("daysSince", status.daysSinceLastPlay());
        result.put("message", getRewardMessage(status.rewardTier()));
        if (status.reward() != null) {
            result.putAll(status.reward());
        }
        return result;
    }

    /**
     * Update last active date. Call after any meaningful action.
     */
    @Transactional
    public void updateLastActive(String userId) {
        userRepository.findById(userId).ifPresent(user -> {
            user.setLastActiveDate(LocalDate.now(ZoneOffset.UTC));
            userRepository.save(user);
        });
    }

    private String getRewardTier(long daysSince) {
        if (daysSince >= 30) return "STARTER_PACK";
        if (daysSince >= 14) return "RECOVERY_PACK";
        if (daysSince >= 7) return "2X_XP_DAY";
        if (daysSince >= 3) return "XP_BOOST";
        return "NONE";
    }

    /**
     * TODO: Wire the xpMultiplier rewards (2X_XP_DAY / RECOVERY_PACK / STARTER_PACK).
     * The reward type is persisted to the user when claimed, but no scoring path checks
     * for an active comeback reward and applies the 2.0x multiplier to ranked points.
     * To wire: ScoringService should accept a "comeback boost" flag (similar to
     * xpSurgeActive — see User.xpSurgeUntil) and RankedController.submitRankedAnswer
     * should compute the flag from the user's active reward + duration.
     * XP_BOOST (one-shot +50) is also dead code — no caller adds it to pointsCounted.
     * Audit 2026-05-01 confirmed all xpMultiplier values here are JSON-only (FE may
     * display the description, but the multiplier itself never reaches scoring).
     */
    private Map<String, Object> buildRewardInfo(String tier, long daysSince) {
        return switch (tier) {
            case "XP_BOOST" -> Map.of("xpBonus", 50, "description", "+50 XP ngay lập tức");
            case "2X_XP_DAY" -> Map.of("xpMultiplier", 2.0, "duration", "endOfDay",
                    "description", "XP x2 cả ngày hôm nay!");
            case "RECOVERY_PACK" -> Map.of("xpMultiplier", 2.0, "duration", "endOfDay",
                    "freezeToken", 1, "description", "XP x2 + 1 Streak Freeze miễn phí");
            case "STARTER_PACK" -> Map.of("xpMultiplier", 2.0, "duration", "3days",
                    "energy", 50, "freezeToken", 1,
                    "description", "Gói Tái Khởi: XP x2 (3 ngày) + 50 Energy + 1 Freeze");
            default -> Map.of();
        };
    }

    private String getRewardMessage(String tier) {
        return switch (tier) {
            case "XP_BOOST" -> "Chào mừng trở lại! Nhận ngay 50 XP thưởng 🎁";
            case "2X_XP_DAY" -> "Lâu quá không gặp! XP nhân đôi cả ngày hôm nay! 🔥";
            case "RECOVERY_PACK" -> "Rất vui khi gặp lại bạn! Nhận gói Phục Hồi 💪";
            case "STARTER_PACK" -> "Chào mừng huyền thoại trở lại! Nhận Gói Tái Khởi đặc biệt 🏆";
            default -> "";
        };
    }
}
