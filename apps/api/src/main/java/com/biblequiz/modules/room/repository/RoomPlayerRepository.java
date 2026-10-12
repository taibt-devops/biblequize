package com.biblequiz.modules.room.repository;

import com.biblequiz.modules.room.entity.RoomPlayer;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RoomPlayerRepository extends JpaRepository<RoomPlayer, String> {
    
    // Find players by room
    List<RoomPlayer> findByRoomId(String roomId);
    
    // Find player by room and user
    Optional<RoomPlayer> findByRoomIdAndUserId(String roomId, String userId);
    
    // Find players by room, ordered by score desc
    @Query("SELECT rp FROM RoomPlayer rp WHERE rp.room.id = :roomId ORDER BY rp.score DESC")
    List<RoomPlayer> findByRoomIdOrderByScoreDesc(@Param("roomId") String roomId);
    
    // Find players ready for quiz
    List<RoomPlayer> findByRoomIdAndIsReady(String roomId, Boolean isReady);
    
    // Count players in room
    @Query("SELECT COUNT(rp) FROM RoomPlayer rp WHERE rp.room.id = :roomId")
    long countByRoomId(@Param("roomId") String roomId);

    // Count players still occupying a slot — excludes LEFT (mid-game leavers
    // whose row is preserved so they can rejoin while IN_PROGRESS).
    // PCV-20: chỉ đếm người thật — phòng chỉ còn người máy coi như không còn ai.
    @Query("SELECT COUNT(rp) FROM RoomPlayer rp WHERE rp.room.id = :roomId AND rp.playerStatus <> com.biblequiz.modules.room.entity.RoomPlayer$PlayerStatus.LEFT AND rp.user.isBot = false")
    long countOccupiedByRoomId(@Param("roomId") String roomId);
    
    // Find top players by score
    @Query("SELECT rp FROM RoomPlayer rp WHERE rp.room.id = :roomId ORDER BY rp.score DESC LIMIT :limit")
    List<RoomPlayer> findTopByRoomId(@Param("roomId") String roomId, @Param("limit") int limit);

    // Find players by status (Battle Royale)
    List<RoomPlayer> findByRoomIdAndPlayerStatus(String roomId, RoomPlayer.PlayerStatus playerStatus);

    /** SPEC §5.4.0 R4: pick the longest-tenured ACTIVE non-host player so
     *  a host disconnect promotes the most committed remaining member. */
    @Query("SELECT rp FROM RoomPlayer rp WHERE rp.room.id = :roomId " +
           "AND rp.user.id <> :excludeUserId " +
           "AND rp.playerStatus = com.biblequiz.modules.room.entity.RoomPlayer$PlayerStatus.ACTIVE " +
           "AND rp.user.isBot = false " + // PCV-20: người máy không bao giờ làm chủ phòng
           "ORDER BY rp.joinedAt ASC")
    List<RoomPlayer> findActiveNonHostsByJoinedAtAsc(@Param("roomId") String roomId,
                                                     @Param("excludeUserId") String excludeUserId);

    // Count players by status (Battle Royale)
    long countByRoomIdAndPlayerStatus(String roomId, RoomPlayer.PlayerStatus playerStatus);

    // Find players by team (Team vs Team)
    List<RoomPlayer> findByRoomIdAndTeam(String roomId, RoomPlayer.Team team);

    /**
     * Returns room IDs (LOBBY or IN_PROGRESS) the user is already in. Backs
     * the "1 active room per user" constraint (SPEC v1.1 §8.7) — joining
     * another room while still in one would split WS subscriptions.
     */
    @Query("SELECT rp.room.id FROM RoomPlayer rp " +
           "WHERE rp.user.id = :userId " +
           "AND rp.room.status IN ('LOBBY', 'IN_PROGRESS')")
    List<String> findActiveRoomIdsByUserId(@Param("userId") String userId);

    /**
     * MPP-2 — Find all RoomPlayer rows for a user whose room ENDED within the
     * given window. Backs the weekly multiplayer-stats widget. Only counts
     * rows where the room actually reached the ended state, so still-running
     * matches don't pollute win-rate.
     */
    @Query("SELECT rp FROM RoomPlayer rp " +
           "WHERE rp.user.id = :userId " +
           "AND rp.room.status = 'ENDED' " +
           "AND rp.room.endedAt >= :from " +
           "AND rp.room.endedAt < :to")
    List<RoomPlayer> findEndedMatchesInWindow(@Param("userId") String userId,
                                               @Param("from") java.time.LocalDateTime from,
                                               @Param("to")   java.time.LocalDateTime to);
}
