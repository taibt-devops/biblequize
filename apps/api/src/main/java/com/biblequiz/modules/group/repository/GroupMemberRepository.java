package com.biblequiz.modules.group.repository;

import com.biblequiz.modules.group.entity.GroupMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface GroupMemberRepository extends JpaRepository<GroupMember, String> {

    List<GroupMember> findByGroupId(String groupId);

    Optional<GroupMember> findByGroupIdAndUserId(String groupId, String userId);

    List<GroupMember> findByUserId(String userId);

    int countByGroupId(String groupId);

    void deleteByGroupId(String groupId);

    /**
     * Bump lastActiveAt for every group this user belongs to. Called from
     * the answer-submit hot path so the inactive-filter on /api/groups/{id}/members
     * reflects real engagement. Bounded — most users join 0-1 groups.
     */
    @Modifying
    @Query("UPDATE GroupMember gm SET gm.lastActiveAt = :now WHERE gm.user.id = :userId")
    int touchLastActiveByUserId(@Param("userId") String userId, @Param("now") LocalDateTime now);
}
