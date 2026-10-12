package com.biblequiz.modules.room.repository;

import com.biblequiz.modules.room.entity.Challenge;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface ChallengeRepository extends JpaRepository<Challenge, String> {

    List<Challenge> findByChallengedIdAndStatus(String challengedId, Challenge.Status status);

    @Query("SELECT c FROM Challenge c WHERE c.status = 'PENDING' AND c.expiresAt < :now")
    List<Challenge> findExpiredPending(@Param("now") LocalDateTime now);

    /**
     * Chuyển trạng thái chỉ khi lời thách còn PENDING (khóa hàng) — nhận lời và hủy chạy đua nhau thì
     * đúng một bên thắng. Trả số hàng đã đổi (0 = lời thách không còn chờ).
     */
    @org.springframework.data.jpa.repository.Modifying
    @Query("UPDATE Challenge c SET c.status = :to WHERE c.id = :id AND c.status = com.biblequiz.modules.room.entity.Challenge$Status.PENDING")
    int transitionFromPending(@Param("id") String id, @Param("to") Challenge.Status to);
}
