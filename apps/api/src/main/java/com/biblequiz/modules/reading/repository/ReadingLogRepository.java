package com.biblequiz.modules.reading.repository;

import com.biblequiz.modules.reading.entity.ReadingLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;

public interface ReadingLogRepository extends JpaRepository<ReadingLog, Long> {

    /** Đã có lần tiến độ đổi từ mốc này (mốc lưu dạng LocalDateTime UTC). */
    boolean existsByUserIdAndLoggedAtGreaterThanEqual(String userId, LocalDateTime from);
}
