package com.biblequiz.modules.reading.repository;

import com.biblequiz.modules.reading.entity.ReadingProgress;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReadingProgressRepository extends JpaRepository<ReadingProgress, String> {}
