package com.biblequiz.infrastructure;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * PCV-4 — executor riêng cho vòng chơi Phòng chơi ({@code RoomQuizService.runQuiz}).
 *
 * <p>Trước đây {@code @Async} không chỉ định executor; vì {@code @EnableWebSocketMessageBroker}
 * đã tạo sẵn các executor của STOMP nên Spring Boot không tạo executor mặc định, và vòng chơi
 * chạy trên {@code SimpleAsyncTaskExecutor} (mỗi trận một luồng mới, không giới hạn, tên luồng
 * không rõ). Bean này làm điều đó tường minh: tên luồng {@code room-game-*} dễ đọc log, tối đa
 * {@value #MAX_GAMES} trận cùng lúc; vượt quá thì {@code TaskRejectedException} và phòng được
 * đưa về sảnh chờ (RoomController.startRoom).
 */
@Configuration
public class RoomGameExecutorConfig {

    public static final String BEAN = "roomGameExecutor";
    static final int MAX_GAMES = 256;

    @Bean(name = BEAN)
    public ThreadPoolTaskExecutor roomGameExecutor() {
        ThreadPoolTaskExecutor ex = new ThreadPoolTaskExecutor();
        ex.setCorePoolSize(8);
        ex.setMaxPoolSize(MAX_GAMES);
        ex.setQueueCapacity(0); // không xếp hàng: trận phải bắt đầu ngay hoặc báo bận
        ex.setKeepAliveSeconds(120);
        ex.setThreadNamePrefix("room-game-");
        ex.setWaitForTasksToCompleteOnShutdown(false);
        ex.initialize();
        return ex;
    }
}
