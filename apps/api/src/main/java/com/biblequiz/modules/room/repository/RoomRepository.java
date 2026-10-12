package com.biblequiz.modules.room.repository;

import com.biblequiz.modules.room.entity.Room;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface RoomRepository extends JpaRepository<Room, String> {
    
    // Find room by room code
    Optional<Room> findByRoomCode(String roomCode);
    
    // Find rooms by status
    List<Room> findByStatus(Room.RoomStatus status);
    
    // Find rooms by host
    List<Room> findByHostId(String hostId);
    
    // Find rooms created after specific time
    List<Room> findByCreatedAtAfter(LocalDateTime after);
    
    // Find active rooms (lobby or in progress)
    @Query("SELECT r FROM Room r WHERE r.status IN ('LOBBY', 'IN_PROGRESS')")
    List<Room> findActiveRooms();
    
    // Find rooms that can start (lobby status with more than 1 player)
    @Query("SELECT r FROM Room r WHERE r.status = 'LOBBY' AND r.currentPlayers > 1")
    List<Room> findStartableRooms();
    
    // Count rooms by status
    @Query("SELECT COUNT(r) FROM Room r WHERE r.status = :status")
    long countByStatus(@Param("status") Room.RoomStatus status);
    
    // Delete expired rooms (bulk JPQL DML — needs @Modifying + @Transactional)
    @Modifying
    @Transactional
    @Query("DELETE FROM Room r WHERE r.status = 'ENDED' AND r.updatedAt < :expireTime")
    int deleteExpiredRooms(@Param("expireTime") LocalDateTime expireTime);

    // Tìm phòng công khai đang lobby hoặc đang chơi (tất cả modes)
    @Query("SELECT r FROM Room r WHERE r.isPublic = true AND r.status IN ('LOBBY', 'IN_PROGRESS') ORDER BY r.createdAt DESC")
    List<Room> findPublicLobbyRooms();

    // Tìm các phòng co-play còn active của 1 group:
    //   - mode GROUP_LIVE_SEQUENTIAL (legacy "Chơi cùng nhau" Quản trò) — VÀ
    //   - mode SPEED_RACE có is_co_play=true (V55, "Chơi cùng nhau" từ QuizSetListCard).
    // KHÔNG bao gồm SPEED_RACE rooms cũ (is_co_play=false) — đó là historical
    // "Tự ôn solo" rooms, không nên surface cho cả group.
    @Query("SELECT r FROM Room r WHERE r.groupQuizSetId IN " +
           "(SELECT gqs.id FROM GroupQuizSet gqs WHERE gqs.group.id = :groupId) " +
           "AND r.status IN ('LOBBY', 'IN_PROGRESS') " +
           "AND (r.mode = 'GROUP_LIVE_SEQUENTIAL' OR r.isCoPlay = true) " +
           "ORDER BY r.createdAt DESC")
    List<Room> findActiveRoomsForGroup(@Param("groupId") String groupId);

    /** Lobby rooms older than the cutoff that have never started — candidates
     *  for auto-cleanup so disconnected hosts don't lock players (incl. self)
     *  out of the "max 1 active room" rule. */
    @Query("SELECT r FROM Room r WHERE r.status = 'LOBBY' AND r.createdAt < :cutoff")
    List<Room> findStaleLobbyRooms(@Param("cutoff") LocalDateTime cutoff);

    /** SPEC §5.4.0 R5: IN_PROGRESS rooms whose host quiz loop never finished
     *  (JVM crash mid-game, network split). Scheduler recovers them so the
     *  "1 active room per user" lock-out doesn't survive a restart. Cutoff
     *  is "started long enough ago that even a maxed-out quiz should be
     *  done by now". */
    @Query("SELECT r FROM Room r WHERE r.status = 'IN_PROGRESS' AND r.startedAt < :cutoff")
    List<Room> findStuckInProgressRooms(@Param("cutoff") LocalDateTime cutoff);

    /**
     * PCV-4 — chuyển LOBBY → IN_PROGRESS nguyên tử. Trả 0 nếu phòng không còn ở LOBBY
     * (ví dụ đã có người bấm bắt đầu trước) — người gọi phải báo lỗi, không chạy vòng thứ hai.
     */
    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true, flushAutomatically = true)
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Query("UPDATE Room r SET r.status = com.biblequiz.modules.room.entity.Room.RoomStatus.IN_PROGRESS, "
            + "r.startedAt = :now WHERE r.id = :id AND r.status = com.biblequiz.modules.room.entity.Room.RoomStatus.LOBBY")
    int markInProgressIfLobby(@org.springframework.data.repository.query.Param("id") String id,
                              @org.springframework.data.repository.query.Param("now") java.time.LocalDateTime now);
}
