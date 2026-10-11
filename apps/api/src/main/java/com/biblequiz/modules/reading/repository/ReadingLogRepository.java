package com.biblequiz.modules.reading.repository;

import com.biblequiz.modules.reading.entity.ReadingLog;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReadingLogRepository extends JpaRepository<ReadingLog, Long> {}
