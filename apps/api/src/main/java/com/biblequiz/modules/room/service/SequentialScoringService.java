package com.biblequiz.modules.room.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/**
 * Coordination cho GROUP_LIVE_SEQUENTIAL mode (Feature A — Chơi cùng nhau).
 *
 * <p>Khác với Speed Race (timer cố định, race for points), sequential mode chờ
 * tất cả player trả lời mới chuyển câu. Sau khi reveal đáp án, leader (host)
 * bấm "Sang câu tiếp" thủ công để advance — phù hợp nhóm tế bào có thảo luận
 * dài/ngắn tự nhiên.
 *
 * <p>Score đơn giản: đúng = 100, sai/không trả lời = 0 (no time bonus).
 */
@Service
public class SequentialScoringService {

    private static final Logger log = LoggerFactory.getLogger(SequentialScoringService.class);

    /** Safety upper bound — leader có 10 phút để bấm advance trước khi auto-skip. */
    private static final long LEADER_ADVANCE_MAX_WAIT_SECONDS = 600;

    private final ConcurrentHashMap<String, RoundState> roundStates = new ConcurrentHashMap<>();

    public int calculateScore(boolean isCorrect) {
        return isCorrect ? 100 : 0;
    }

    /**
     * Bắt đầu round mới — tạo latches cho all-answered và leader-advance signals.
     * Total players = số player ACTIVE tại thời điểm round bắt đầu.
     */
    public RoundState beginRound(String roomId, int totalPlayers) {
        RoundState state = new RoundState(totalPlayers);
        roundStates.put(roomId, state);
        log.debug("[Sequential] beginRound room={} totalPlayers={}", roomId, totalPlayers);
        return state;
    }

    /**
     * Player đã submit answer — count down latch. Idempotent: gọi nhiều lần chỉ
     * count down 1 lần per user (caller phải check trùng).
     */
    public void recordAnswer(String roomId) {
        RoundState state = roundStates.get(roomId);
        if (state != null) {
            state.allAnsweredLatch.countDown();
            log.debug("[Sequential] recordAnswer room={} remaining={}", roomId, state.allAnsweredLatch.getCount());
        }
    }

    /**
     * Đếm số player đã trả lời (used cho broadcast progress dots).
     */
    public int answeredCount(String roomId) {
        RoundState state = roundStates.get(roomId);
        if (state == null) return 0;
        return state.totalPlayers - (int) state.allAnsweredLatch.getCount();
    }

    public int totalPlayers(String roomId) {
        RoundState state = roundStates.get(roomId);
        return state != null ? state.totalPlayers : 0;
    }

    /**
     * Block đến khi all-answered hoặc timeout (timer câu hỏi hết hạn).
     * @return true nếu all-answered, false nếu timeout
     */
    public boolean awaitAllAnsweredOrTimeout(String roomId, long timeoutSeconds) throws InterruptedException {
        return awaitAllAnsweredOrTimeoutMs(roomId, timeoutSeconds * 1000L);
    }

    /** Như trên nhưng tính bằng mili giây — vòng lặp truyền thời gian câu + ân hạn. */
    public boolean awaitAllAnsweredOrTimeoutMs(String roomId, long timeoutMs) throws InterruptedException {
        RoundState state = roundStates.get(roomId);
        if (state == null) return false;
        return state.allAnsweredLatch.await(timeoutMs, TimeUnit.MILLISECONDS);
    }

    /**
     * Leader bấm "Sang câu tiếp" — release advance latch.
     */
    public void leaderAdvance(String roomId) {
        RoundState state = roundStates.get(roomId);
        if (state != null) {
            state.advanceLatch.countDown();
            log.debug("[Sequential] leaderAdvance room={}", roomId);
        }
    }

    /**
     * Block sau khi reveal đến khi leader bấm advance hoặc safety timeout (10 phút).
     * @return true nếu leader đã bấm, false nếu safety timeout
     */
    public boolean awaitLeaderAdvance(String roomId) throws InterruptedException {
        RoundState state = roundStates.get(roomId);
        if (state == null) return false;
        return state.advanceLatch.await(LEADER_ADVANCE_MAX_WAIT_SECONDS, TimeUnit.SECONDS);
    }

    public void clearRound(String roomId) {
        roundStates.remove(roomId);
    }

    public static class RoundState {
        public final int totalPlayers;
        public final CountDownLatch allAnsweredLatch;
        public final CountDownLatch advanceLatch = new CountDownLatch(1);

        RoundState(int totalPlayers) {
            this.totalPlayers = totalPlayers;
            this.allAnsweredLatch = new CountDownLatch(Math.max(0, totalPlayers));
        }
    }
}
