package com.biblequiz.infrastructure.seed;

import com.biblequiz.modules.feedback.entity.Feedback;
import com.biblequiz.modules.feedback.repository.FeedbackRepository;
import com.biblequiz.modules.user.entity.User;
import com.biblequiz.modules.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.*;

@Component
@Profile("!prod")
public class FeedbackSeeder {

    private static final Logger log = LoggerFactory.getLogger(FeedbackSeeder.class);
    @Autowired private UserRepository userRepository;
    @Autowired private FeedbackRepository feedbackRepository;

    public int seed() {
        if (feedbackRepository.count() > 0) {
            log.info("FeedbackSeeder: feedback exists, skipping");
            return 0;
        }

        List<User> users = userRepository.findAll().stream()
                .filter(u -> u.getEmail() != null && u.getEmail().endsWith("@biblequiz.test"))
                .filter(u -> "USER".equalsIgnoreCase(u.getRole()))
                .limit(6)
                .toList();
        if (users.isEmpty()) return 0;

        String[][] items = {
                {"report", "pending", "Câu hỏi về Sáng Thế Ký 1:1 có đáp án sai"},
                {"report", "pending", "Phần giải thích thiếu trích dẫn Kinh Thánh"},
                {"report", "pending", "Typo trong câu hỏi về sách Xuất Ai Cập Ký"},
                {"question", "in_progress", "Tại sao không có sách Khải Huyền trong quiz?"},
                {"question", "in_progress", "Cách tính điểm ranked mode như thế nào?"},
                {"general", "resolved", "App rất hay! Mong có thêm câu hỏi về Tân Ước"},
                {"general", "resolved", "Giao diện mới rất đẹp, dễ sử dụng"},
                {"general", "resolved", "Mong có chế độ multiplayer cho nhóm nhỏ"},
                {"report", "rejected", "Câu hỏi quá khó"},
                {"report", "rejected", "Không thích giao diện mới"},
        };

        int count = 0;
        for (int i = 0; i < items.length; i++) {
            String[] item = items[i];
            User user = users.get(i % users.size());

            Feedback f = new Feedback();
            f.setId(UUID.randomUUID().toString());
            f.setUser(user);
            f.setType(Feedback.Type.valueOf(item[0]));
            f.setContent(item[2]);
            f.setStatus(Feedback.Status.valueOf(item[1]));
            f.setCreatedAt(UserSeeder.randomRecent(21));
            feedbackRepository.save(f);
            count++;
        }

        log.info("FeedbackSeeder: created {} feedback items", count);
        return count;
    }

    public void clear() {
        feedbackRepository.deleteAll();
        log.info("FeedbackSeeder: cleared");
    }
}
