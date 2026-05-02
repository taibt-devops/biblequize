package com.biblequiz.modules.group.repository;

import com.biblequiz.modules.group.entity.ChurchGroup;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ChurchGroupRepository extends JpaRepository<ChurchGroup, String> {

    Optional<ChurchGroup> findByGroupCode(String code);

    List<ChurchGroup> findByLeaderId(String userId);

    /**
     * Public, non-deleted, non-locked groups for the discovery widget on the
     * empty-state Groups page. Sorted by memberCount DESC so high-engagement
     * communities surface first; ties broken by createdAt DESC (newest wins).
     */
    @Query("SELECT g FROM ChurchGroup g WHERE g.isPublic = true AND g.deletedAt IS NULL AND g.isLocked = false " +
           "ORDER BY g.memberCount DESC, g.createdAt DESC")
    List<ChurchGroup> findPublicGroupsByMemberCountDesc(Pageable pageable);

    /**
     * Same filter as above but ordered by createdAt DESC — used when the FE
     * passes featured=false (browse all public groups, newest first).
     */
    @Query("SELECT g FROM ChurchGroup g WHERE g.isPublic = true AND g.deletedAt IS NULL AND g.isLocked = false " +
           "ORDER BY g.createdAt DESC")
    List<ChurchGroup> findPublicGroupsByCreatedAtDesc(Pageable pageable);
}
