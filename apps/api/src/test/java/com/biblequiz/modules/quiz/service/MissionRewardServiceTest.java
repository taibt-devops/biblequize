package com.biblequiz.modules.quiz.service;

import com.biblequiz.infrastructure.service.CacheService;
import com.biblequiz.infrastructure.time.GameClock;
import com.biblequiz.modules.quiz.entity.UserDailyProgress;
import com.biblequiz.modules.quiz.repository.UserDailyProgressRepository;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** PCV-7 — 50 XP thưởng được ghi vào sổ XP hôm nay và xoá cache bảng xếp hạng. */
@ExtendWith(MockitoExtension.class)
class MissionRewardServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private UserDailyProgressRepository progressRepository;
    @Mock private CacheService cacheService;
    @InjectMocks private MissionRewardService service;

    @Test
    void addsXpToTodaysLedger_andInvalidatesLeaderboards() {
        User u = new User();
        u.setId("u1");
        when(userRepository.findById("u1")).thenReturn(Optional.of(u));
        UserDailyProgress udp = new UserDailyProgress("d1", u, GameClock.today());
        udp.setPointsCounted(30);
        when(progressRepository.findByUserIdAndDate("u1", GameClock.today())).thenReturn(Optional.of(udp));

        service.creditBonus("u1", 50);

        ArgumentCaptor<UserDailyProgress> saved = ArgumentCaptor.forClass(UserDailyProgress.class);
        verify(progressRepository).save(saved.capture());
        assertEquals(80, saved.getValue().getPointsCounted());
        verify(cacheService).invalidateLeaderboards();
    }

    @Test
    void unknownUser_isIgnored() {
        when(userRepository.findById("ghost")).thenReturn(Optional.empty());
        service.creditBonus("ghost", 50);
        verifyNoInteractions(progressRepository, cacheService);
    }
}
