package com.biblequiz.modules.room.repository;

import com.biblequiz.modules.room.entity.Room;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

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
    
    // Find rooms by player
    @Query("SELECT r FROM Room r WHERE :playerId MEMBER OF r.players")
    List<Room> findByPlayerId(@Param("playerId") String playerId);
    
    // Count rooms by status
    @Query("SELECT COUNT(r) FROM Room r WHERE r.status = :status")
    long countByStatus(@Param("status") Room.RoomStatus status);
    
    // Delete expired rooms
    @Query("DELETE FROM Room r WHERE r.status = 'ENDED' AND r.updatedAt < :expireTime")
    int deleteExpiredRooms(@Param("expireTime") LocalDateTime expireTime);

    // Tìm phòng công khai đang lobby hoặc đang chơi (tất cả modes)
    @Query("SELECT r FROM Room r WHERE r.isPublic = true AND r.status IN ('LOBBY', 'IN_PROGRESS') ORDER BY r.createdAt DESC")
    List<Room> findPublicLobbyRooms();
}
