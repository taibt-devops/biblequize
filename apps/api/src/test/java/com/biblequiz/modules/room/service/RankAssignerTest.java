package com.biblequiz.modules.room.service;

import com.biblequiz.modules.room.entity.Room;
import com.biblequiz.modules.room.entity.RoomPlayer;
import com.biblequiz.modules.user.entity.User;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** PCV-6 — xếp hạng cuối kiểu thi đấu (1, 1, 3). */
class RankAssignerTest {

    static RoomPlayer p(String id, int score, int correct, int answered, double avgMs) {
        User u = new User();
        u.setId(id);
        RoomPlayer rp = new RoomPlayer("rp-" + id, new Room(), u, id);
        rp.setScore(score);
        rp.setCorrectAnswers(correct);
        rp.setTotalAnswered(answered);
        rp.setAverageReactionTime(avgMs);
        return rp;
    }

    @Test
    void scoreThenCorrectThenSpeed_withSharedRanks() {
        RoomPlayer a = p("a", 500, 4, 5, 3000);
        RoomPlayer b = p("b", 500, 5, 5, 6000); // cùng điểm, nhiều câu đúng hơn → trên a
        RoomPlayer c = p("c", 300, 3, 5, 2000);
        RoomPlayer d = p("d", 300, 3, 5, 2000); // giống hệt c → đồng hạng
        RoomPlayer e = p("e", 100, 1, 5, 1000);

        RankAssigner.assign(List.of(a, b, c, d, e), RankAssigner.BY_SCORE_ACCURACY_SPEED);

        assertEquals(1, b.getFinalRank());
        assertEquals(2, a.getFinalRank());
        assertEquals(3, c.getFinalRank());
        assertEquals(3, d.getFinalRank());
        assertEquals(5, e.getFinalRank());
    }

    @Test
    void playerWhoNeverAnswered_isNotTreatedAsFastest() {
        RoomPlayer quiet = p("q", 0, 0, 0, 0.0);
        RoomPlayer slow = p("s", 0, 0, 3, 9000);

        RankAssigner.assign(List.of(quiet, slow), RankAssigner.BY_SCORE_ACCURACY_SPEED);

        assertEquals(1, slow.getFinalRank());
        assertEquals(2, quiet.getFinalRank());
    }
}
