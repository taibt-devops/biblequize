# Bài Giáo Lý Căn Bản — Mở Khóa Ranked Mode

**Decision**: Thay vì "Practice 70% với 10 câu bất kỳ", đổi sang **bài giáo lý cố định 10 câu**. User phải pass 8/10 để mở khóa Ranked. Pass = vĩnh viễn (1 lần là xong).

**Lý do**:
- Match văn hóa hội thánh (lớp giáo lý cho người mới)
- Dạy doctrine foundation (Ba Ngôi, Christology, Soteriology, etc.) thay vì random Bible knowledge
- Achievement rõ ràng — share được, viral potential cao
- Code đơn giản hơn (1 boolean field thay vì tính dynamic)

**Cost ước tính**: 5-7 giờ. Mỗi step = 1 commit riêng.

---

## Constants & Decisions (KHÔNG đổi giữa chừng)

| Item | Value |
|---|---|
| Số câu | 10 cố định |
| Threshold pass | 8/10 (80%) |
| Cooldown sau fail | 60 giây |
| Pass once = unlock vĩnh viễn | YES |
| Languages | VN (Bản TTHD 2011) + EN (NIV) |
| Question type | Multiple Choice (4 options) |
| Category tag trong DB | `bible_basics` |
| Admin có thể edit câu hỏi | YES (qua existing Questions page) |
| Existing users migration | NONE (chưa có user nào) |

---

## Step 0 — Verify trước khi code

Đọc và trả lời trong reply đầu tiên:

1. **DB schema check**:
   - `Question` entity có field `category` chưa? Nếu không, có field nào tương đương (vd: `tags`, `topic`)?
   - Có thể thêm field mới mà không break gì không?

2. **User entity**:
   - Có field nào lưu "đã pass bài gì" chưa? (vd: `passedQuizzes`, `achievements`)
   - Cần thêm field `basicQuizPassed: boolean` + `basicQuizPassedAt: timestamp` mới?

3. **Existing exception handling**:
   - Có pattern global exception handler không? File nào?
   - Format error response hiện tại như thế nào?

4. **Admin Questions page**:
   - File: `apps/web/src/admin/pages/Questions.tsx` (hoặc tương đương)
   - Có filter theo `category` hay tag chưa? Hay phải thêm mới?

KHÔNG bắt đầu Step 1 cho đến khi có findings.

---

## Step 1 — Backend: Schema + Seed 10 câu

### 1.1 Migration mới — V29 (hoặc số tiếp theo)

File: `apps/api/src/main/resources/db/migration/V29__bible_basics_quiz.sql`

```sql
-- Add basicQuizPassed tracking to users
ALTER TABLE users 
  ADD COLUMN basic_quiz_passed BOOLEAN DEFAULT FALSE,
  ADD COLUMN basic_quiz_passed_at TIMESTAMP NULL,
  ADD COLUMN basic_quiz_attempts INT DEFAULT 0,
  ADD COLUMN basic_quiz_last_attempt_at TIMESTAMP NULL;

-- Add category field to question if not exists
-- (Step 0 should confirm if needed)
ALTER TABLE question 
  ADD COLUMN category VARCHAR(50) DEFAULT NULL;

CREATE INDEX idx_question_category ON question(category);

-- Seed 10 bible basics questions (VN + EN)
-- Use display_order to maintain consistent question order
INSERT INTO question (
  id, content, options, correct_answer, explanation, scripture_ref,
  book, chapter, verse, difficulty, type, language, category, 
  is_active, display_order, created_at, updated_at, created_by
) VALUES
-- ============ VN VERSIONS ============
-- Câu 1: Ba Ngôi
(UUID(), 'Đức Chúa Trời tồn tại như thế nào?',
 '["Một Ngôi duy nhất", "Ba Ngôi: Cha, Con, và Thánh Linh", "Hai Ngôi: Cha và Con", "Nhiều thần linh khác nhau"]',
 '[1]',
 'Đức Chúa Trời là Ba Ngôi: Đức Cha, Đức Con, và Đức Thánh Linh — ba thân vị nhưng cùng một bản thể. Đây là nền tảng đức tin Cơ-đốc giáo.',
 'Ma-thi-ơ 28:19',
 'Matthew', 28, '19', 'medium', 'multiple_choice', 'vi', 'bible_basics',
 TRUE, 1, NOW(), NOW(), 'system'),

-- Câu 2: Đặc tính Đức Chúa Trời
(UUID(), 'Đức Chúa Trời có những đặc tính nào?',
 '["Toàn năng nhưng có giới hạn", "Yêu thương nhưng không công bằng", "Toàn năng, toàn tri, toàn tại, yêu thương và thánh khiết", "Chỉ là một khái niệm tinh thần"]',
 '[2]',
 'Kinh Thánh dạy Đức Chúa Trời là toàn năng (làm được mọi sự), toàn tri (biết mọi sự), toàn tại (có mặt khắp nơi), yêu thương và thánh khiết.',
 'Thi Thiên 139:7-12',
 'Psalms', 139, '7-12', 'medium', 'multiple_choice', 'vi', 'bible_basics',
 TRUE, 2, NOW(), NOW(), 'system'),

-- Câu 3: Câu Kinh Thánh về Ba Ngôi
(UUID(), 'Câu Kinh Thánh nào dạy rõ về Ba Ngôi?',
 '["Sáng Thế Ký 1:1", "Ma-thi-ơ 28:19 — nhân danh Đức Cha, Đức Con, và Đức Thánh Linh", "Thi Thiên 23:1", "Giăng 1:1"]',
 '[1]',
 'Ma-thi-ơ 28:19 là Đại Mạng Lệnh, nơi Chúa Jesus dạy phép báp-tem nhân danh ba thân vị: Đức Cha, Đức Con, và Đức Thánh Linh.',
 'Ma-thi-ơ 28:19',
 'Matthew', 28, '19', 'medium', 'multiple_choice', 'vi', 'bible_basics',
 TRUE, 3, NOW(), NOW(), 'system'),

-- Câu 4: Chúa Jesus là ai
(UUID(), 'Chúa Jesus là ai?',
 '["Một nhà tiên tri vĩ đại", "Một người thầy về đạo đức", "Đức Chúa Trời nhập thể, Con Đức Chúa Trời, Đấng Cứu Thế", "Một thiên sứ đặc biệt"]',
 '[2]',
 'Chúa Jesus vừa là Đức Chúa Trời thật vừa là Người thật. Ngài là Con Đức Chúa Trời, đã nhập thể làm người để cứu chuộc nhân loại.',
 'Giăng 1:1, 14',
 'John', 1, '1,14', 'medium', 'multiple_choice', 'vi', 'bible_basics',
 TRUE, 4, NOW(), NOW(), 'system'),

-- Câu 5: Tại sao Chúa Jesus đến
(UUID(), 'Tại sao Chúa Jesus đến thế gian?',
 '["Để dạy con người sống tốt hơn", "Để chết trên thập tự giá đền tội cho nhân loại", "Để thiết lập một vương quốc trần gian", "Để giải phóng dân Y-sơ-ra-ên khỏi La Mã"]',
 '[1]',
 'Mục đích chính của Chúa Jesus đến thế gian là chết thay cho tội nhân, để qua sự hy sinh của Ngài, ai tin nhận Ngài đều được cứu rỗi.',
 'Mác 10:45',
 'Mark', 10, '45', 'easy', 'multiple_choice', 'vi', 'bible_basics',
 TRUE, 5, NOW(), NOW(), 'system'),

-- Câu 6: Phục sinh
(UUID(), 'Điều gì đã xảy ra sau khi Chúa Jesus chịu chết?',
 '["Các môn đồ chôn cất Ngài và Ngài ở trong mộ mãi mãi", "Ngài đã sống lại từ kẻ chết vào ngày thứ ba", "Linh hồn Ngài bay về trời, thân xác ở lại", "Ngài hóa thành thiên sứ"]',
 '[1]',
 'Sự phục sinh của Chúa Jesus vào ngày thứ ba là sự kiện trung tâm của đức tin Cơ-đốc, chứng tỏ Ngài là Đức Chúa Trời và đắc thắng sự chết.',
 '1 Cô-rinh-tô 15:3-4',
 '1 Corinthians', 15, '3-4', 'easy', 'multiple_choice', 'vi', 'bible_basics',
 TRUE, 6, NOW(), NOW(), 'system'),

-- Câu 7: Tạo dựng (strict creation)
(UUID(), 'Con người được tạo dựng như thế nào?',
 '["Tiến hóa từ loài vượn", "Ngẫu nhiên xuất hiện", "Đức Chúa Trời tạo dựng theo hình ảnh của Ngài", "Do thiên sứ tạo ra"]',
 '[2]',
 'Sáng Thế Ký dạy rằng Đức Chúa Trời đã trực tiếp tạo dựng con người theo hình ảnh của Ngài (imago Dei), khác biệt hoàn toàn với muôn loài khác.',
 'Sáng Thế Ký 1:27',
 'Genesis', 1, '27', 'easy', 'multiple_choice', 'vi', 'bible_basics',
 TRUE, 7, NOW(), NOW(), 'system'),

-- Câu 8: Tội lỗi và cứu rỗi
(UUID(), 'Tại sao mọi người đều cần được cứu rỗi?',
 '["Vì con người yếu đuối", "Vì mọi người đều đã phạm tội và xa cách Đức Chúa Trời", "Vì con người không biết đủ Kinh Thánh", "Vì cuộc sống có quá nhiều khó khăn"]',
 '[1]',
 'Rô-ma 3:23 dạy rõ: "Vì mọi người đều đã phạm tội, thiếu mất sự vinh hiển của Đức Chúa Trời." Tội lỗi ngăn cách con người với Đức Chúa Trời, và mọi người đều cần được cứu rỗi.',
 'Rô-ma 3:23',
 'Romans', 3, '23', 'easy', 'multiple_choice', 'vi', 'bible_basics',
 TRUE, 8, NOW(), NOW(), 'system'),

-- Câu 9: Cách được cứu rỗi
(UUID(), 'Làm thế nào để được cứu rỗi?',
 '["Làm nhiều việc thiện", "Giữ luật pháp và đi nhà thờ đều đặn", "Bởi đức tin nơi Chúa Jesus, không phải bởi việc làm", "Phải hoàn hảo về đạo đức"]',
 '[2]',
 'Ê-phê-sô 2:8-9 dạy: "Vì nhờ ân điển, bởi đức tin mà anh em được cứu, điều đó không phải đến từ anh em, bèn là sự ban cho của Đức Chúa Trời. Ấy chẳng phải bởi việc làm đâu, hầu cho không ai khoe mình."',
 'Ê-phê-sô 2:8-9',
 'Ephesians', 2, '8-9', 'medium', 'multiple_choice', 'vi', 'bible_basics',
 TRUE, 9, NOW(), NOW(), 'system'),

-- Câu 10: Kinh Thánh là gì
(UUID(), 'Kinh Thánh là gì?',
 '["Một tập hợp các câu chuyện cổ", "Một cuốn sách tốt về đạo đức", "Lời được Đức Chúa Trời linh cảm, là chân lý và thẩm quyền tuyệt đối cho đời sống đức tin", "Sách lịch sử của dân Do Thái"]',
 '[2]',
 '2 Ti-mô-thê 3:16 dạy: "Cả Kinh Thánh đều là bởi Đức Chúa Trời linh cảm, có ích cho sự dạy dỗ, bẻ trách, sửa trị, dạy người trong sự công bình." Kinh Thánh là Lời Đức Chúa Trời, thẩm quyền tuyệt đối cho đức tin và đời sống.',
 '2 Ti-mô-thê 3:16',
 '2 Timothy', 3, '16', 'medium', 'multiple_choice', 'vi', 'bible_basics',
 TRUE, 10, NOW(), NOW(), 'system'),

-- ============ EN VERSIONS (NIV) ============
-- Q1: Trinity
(UUID(), 'How does God exist?',
 '["As one single Person", "As the Trinity: Father, Son, and Holy Spirit", "As two Persons: Father and Son", "As many different deities"]',
 '[1]',
 'God exists as the Trinity: the Father, the Son, and the Holy Spirit — three Persons in one divine essence. This is the foundation of Christian faith.',
 'Matthew 28:19',
 'Matthew', 28, '19', 'medium', 'multiple_choice', 'en', 'bible_basics',
 TRUE, 1, NOW(), NOW(), 'system'),

-- Q2: God's attributes
(UUID(), 'What are God''s attributes?',
 '["Almighty but limited", "Loving but not just", "Omnipotent, omniscient, omnipresent, loving and holy", "Just a spiritual concept"]',
 '[2]',
 'Scripture teaches that God is omnipotent (all-powerful), omniscient (all-knowing), omnipresent (everywhere), loving and holy.',
 'Psalm 139:7-12',
 'Psalms', 139, '7-12', 'medium', 'multiple_choice', 'en', 'bible_basics',
 TRUE, 2, NOW(), NOW(), 'system'),

-- Q3: Trinity verse
(UUID(), 'Which Bible verse clearly teaches the Trinity?',
 '["Genesis 1:1", "Matthew 28:19 — in the name of the Father, Son, and Holy Spirit", "Psalm 23:1", "John 1:1"]',
 '[1]',
 'Matthew 28:19 is the Great Commission, where Jesus commands baptism in the name of three Persons: Father, Son, and Holy Spirit.',
 'Matthew 28:19',
 'Matthew', 28, '19', 'medium', 'multiple_choice', 'en', 'bible_basics',
 TRUE, 3, NOW(), NOW(), 'system'),

-- Q4: Who is Jesus
(UUID(), 'Who is Jesus Christ?',
 '["A great prophet", "A moral teacher", "God incarnate, the Son of God, the Savior", "A special angel"]',
 '[2]',
 'Jesus Christ is fully God and fully man. He is the Son of God who became flesh to save humanity.',
 'John 1:1, 14',
 'John', 1, '1,14', 'medium', 'multiple_choice', 'en', 'bible_basics',
 TRUE, 4, NOW(), NOW(), 'system'),

-- Q5: Why Jesus came
(UUID(), 'Why did Jesus come to earth?',
 '["To teach people to live better", "To die on the cross to atone for humanity''s sins", "To establish an earthly kingdom", "To free Israel from Rome"]',
 '[1]',
 'The primary purpose of Jesus coming to earth was to die in place of sinners, so that through His sacrifice, whoever believes in Him will be saved.',
 'Mark 10:45',
 'Mark', 10, '45', 'easy', 'multiple_choice', 'en', 'bible_basics',
 TRUE, 5, NOW(), NOW(), 'system'),

-- Q6: Resurrection
(UUID(), 'What happened after Jesus died?',
 '["His disciples buried Him and He stayed in the tomb forever", "He rose from the dead on the third day", "His soul went to heaven, body remained", "He turned into an angel"]',
 '[1]',
 'The resurrection of Jesus on the third day is the central event of Christian faith, proving He is God and victorious over death.',
 '1 Corinthians 15:3-4',
 '1 Corinthians', 15, '3-4', 'easy', 'multiple_choice', 'en', 'bible_basics',
 TRUE, 6, NOW(), NOW(), 'system'),

-- Q7: Creation (strict)
(UUID(), 'How were humans created?',
 '["Evolved from apes", "Appeared randomly", "God created them in His own image", "Created by angels"]',
 '[2]',
 'Genesis teaches that God directly created humans in His own image (imago Dei), distinct from all other creatures.',
 'Genesis 1:27',
 'Genesis', 1, '27', 'easy', 'multiple_choice', 'en', 'bible_basics',
 TRUE, 7, NOW(), NOW(), 'system'),

-- Q8: Sin and salvation
(UUID(), 'Why does everyone need salvation?',
 '["Because humans are weak", "Because all have sinned and fallen short of God''s glory", "Because people don''t know enough Bible", "Because life has too many difficulties"]',
 '[1]',
 'Romans 3:23 clearly states: "For all have sinned and fall short of the glory of God." Sin separates humanity from God, and everyone needs salvation.',
 'Romans 3:23',
 'Romans', 3, '23', 'easy', 'multiple_choice', 'en', 'bible_basics',
 TRUE, 8, NOW(), NOW(), 'system'),

-- Q9: How to be saved
(UUID(), 'How can a person be saved?',
 '["By doing many good deeds", "By keeping the law and going to church regularly", "By faith in Jesus Christ, not by works", "By being morally perfect"]',
 '[2]',
 'Ephesians 2:8-9 teaches: "For it is by grace you have been saved, through faith — and this is not from yourselves, it is the gift of God — not by works, so that no one can boast."',
 'Ephesians 2:8-9',
 'Ephesians', 2, '8-9', 'medium', 'multiple_choice', 'en', 'bible_basics',
 TRUE, 9, NOW(), NOW(), 'system'),

-- Q10: What is the Bible
(UUID(), 'What is the Bible?',
 '["A collection of ancient stories", "A good book about morality", "God-inspired Word, the absolute truth and authority for faith and life", "A history book of the Jewish people"]',
 '[2]',
 '2 Timothy 3:16 teaches: "All Scripture is God-breathed and is useful for teaching, rebuking, correcting and training in righteousness." The Bible is God''s Word, the absolute authority for faith and life.',
 '2 Timothy 3:16',
 '2 Timothy', 3, '16', 'medium', 'multiple_choice', 'en', 'bible_basics',
 TRUE, 10, NOW(), NOW(), 'system');
```

### 1.2 Update Question entity

`apps/api/src/main/java/com/biblequiz/modules/quiz/entity/Question.java`:
```java
@Column(length = 50)
private String category; // null cho câu thường, 'bible_basics' cho bài giáo lý
```

### 1.3 Update User entity

`apps/api/src/main/java/com/biblequiz/modules/user/entity/User.java`:
```java
@Column(name = "basic_quiz_passed")
private Boolean basicQuizPassed = false;

@Column(name = "basic_quiz_passed_at")
private LocalDateTime basicQuizPassedAt;

@Column(name = "basic_quiz_attempts")
private Integer basicQuizAttempts = 0;

@Column(name = "basic_quiz_last_attempt_at")
private LocalDateTime basicQuizLastAttemptAt;
```

### Acceptance criteria

- Migration V29 chạy thành công
- 20 records (10 VN + 10 EN) trong question table với `category = 'bible_basics'`
- User entity có 4 fields mới
- Existing tests vẫn pass

### Cost: 1.5-2h

### Commit
- `feat(db): V29 — bible basics quiz schema + seed 10 questions (vi+en)`

---

## Step 2 — Backend: Service + Endpoints

### 2.1 BasicQuizService

File: `apps/api/src/main/java/com/biblequiz/modules/quiz/service/BasicQuizService.java`

```java
@Service
@RequiredArgsConstructor
public class BasicQuizService {
  
  public static final int TOTAL_QUESTIONS = 10;
  public static final int PASS_THRESHOLD = 8; // 8/10 = 80%
  public static final int COOLDOWN_SECONDS = 60;
  
  private final QuestionRepository questionRepo;
  private final UserRepository userRepo;
  
  /**
   * Get 10 questions in display_order, shuffled order returned to client.
   * Same 10 questions every time, just different order.
   */
  public List<Question> getQuestions(String language) {
    List<Question> questions = questionRepo.findByCategoryAndLanguageAndIsActive(
      "bible_basics", language, true,
      Sort.by("displayOrder")
    );
    
    if (questions.size() != TOTAL_QUESTIONS) {
      throw new IllegalStateException(
        "Bible basics quiz must have exactly " + TOTAL_QUESTIONS + 
        " questions for language " + language + 
        ", found: " + questions.size()
      );
    }
    
    // Shuffle for randomized display order
    List<Question> shuffled = new ArrayList<>(questions);
    Collections.shuffle(shuffled);
    return shuffled;
  }
  
  /**
   * Submit attempt. Returns result with pass/fail + score.
   * Updates user state if pass.
   */
  @Transactional
  public BasicQuizResult submitAttempt(
    Long userId, 
    List<UserAnswer> answers,
    String language
  ) {
    User user = userRepo.findById(userId).orElseThrow();
    
    // Check cooldown
    if (user.getBasicQuizLastAttemptAt() != null) {
      long secondsSinceLastAttempt = ChronoUnit.SECONDS.between(
        user.getBasicQuizLastAttemptAt(), 
        LocalDateTime.now()
      );
      if (secondsSinceLastAttempt < COOLDOWN_SECONDS) {
        throw new BasicQuizCooldownException(
          COOLDOWN_SECONDS - (int) secondsSinceLastAttempt
        );
      }
    }
    
    // If already passed, no need to retake
    if (Boolean.TRUE.equals(user.getBasicQuizPassed())) {
      throw new BasicQuizAlreadyPassedException();
    }
    
    // Score the attempt
    int correctCount = scoreAttempt(answers, language);
    boolean passed = correctCount >= PASS_THRESHOLD;
    
    // Update user state
    user.setBasicQuizAttempts(
      (user.getBasicQuizAttempts() == null ? 0 : user.getBasicQuizAttempts()) + 1
    );
    user.setBasicQuizLastAttemptAt(LocalDateTime.now());
    
    if (passed) {
      user.setBasicQuizPassed(true);
      user.setBasicQuizPassedAt(LocalDateTime.now());
    }
    
    userRepo.save(user);
    
    return BasicQuizResult.builder()
      .passed(passed)
      .correctCount(correctCount)
      .totalQuestions(TOTAL_QUESTIONS)
      .threshold(PASS_THRESHOLD)
      .attemptCount(user.getBasicQuizAttempts())
      .build();
  }
  
  /**
   * Get current status for FE display.
   */
  public BasicQuizStatus getStatus(Long userId) {
    User user = userRepo.findById(userId).orElseThrow();
    
    int cooldownRemainingSeconds = 0;
    if (user.getBasicQuizLastAttemptAt() != null && 
        !Boolean.TRUE.equals(user.getBasicQuizPassed())) {
      long elapsed = ChronoUnit.SECONDS.between(
        user.getBasicQuizLastAttemptAt(), 
        LocalDateTime.now()
      );
      cooldownRemainingSeconds = Math.max(0, COOLDOWN_SECONDS - (int) elapsed);
    }
    
    return BasicQuizStatus.builder()
      .passed(Boolean.TRUE.equals(user.getBasicQuizPassed()))
      .passedAt(user.getBasicQuizPassedAt())
      .attemptCount(user.getBasicQuizAttempts() == null ? 0 : user.getBasicQuizAttempts())
      .cooldownRemainingSeconds(cooldownRemainingSeconds)
      .totalQuestions(TOTAL_QUESTIONS)
      .threshold(PASS_THRESHOLD)
      .build();
  }
  
  private int scoreAttempt(List<UserAnswer> answers, String language) {
    // Map answers to questions, count correct
    // Implementation detail
  }
}
```

### 2.2 Controller

File: `apps/api/src/main/java/com/biblequiz/api/BasicQuizController.java`

```java
@RestController
@RequestMapping("/api/basic-quiz")
@RequiredArgsConstructor
public class BasicQuizController {
  
  private final BasicQuizService service;
  
  /**
   * Get status (passed? cooldown? attempts?)
   */
  @GetMapping("/status")
  public ResponseEntity<BasicQuizStatus> getStatus(
    @AuthenticationPrincipal UserDetails userDetails
  ) {
    Long userId = ((CustomUserDetails) userDetails).getId();
    return ResponseEntity.ok(service.getStatus(userId));
  }
  
  /**
   * Get 10 questions to display (shuffled order, no correct answer revealed)
   */
  @GetMapping("/questions")
  public ResponseEntity<List<QuestionDto>> getQuestions(
    @RequestParam(defaultValue = "vi") String language
  ) {
    return ResponseEntity.ok(
      service.getQuestions(language).stream()
        .map(q -> QuestionDto.fromEntity(q, false)) // false = don't reveal correct answer
        .toList()
    );
  }
  
  /**
   * Submit all 10 answers, get pass/fail result
   */
  @PostMapping("/submit")
  public ResponseEntity<BasicQuizResult> submit(
    @AuthenticationPrincipal UserDetails userDetails,
    @RequestBody BasicQuizSubmission submission
  ) {
    Long userId = ((CustomUserDetails) userDetails).getId();
    return ResponseEntity.ok(
      service.submitAttempt(userId, submission.getAnswers(), submission.getLanguage())
    );
  }
}
```

### 2.3 Update SessionService — Replace XP gate

**Trước:**
```java
if (mode == GameMode.RANKED) {
  boolean hasXP = user.getTotalPoints() >= 1000;
  boolean hasEarlyUnlock = practiceAccuracy >= 0.80 && practiceCount >= 10;
  if (!hasXP && !hasEarlyUnlock) {
    throw new ForbiddenException("Need 1000 XP or 80% Practice accuracy");
  }
}
```

**Sau:**
```java
if (mode == GameMode.RANKED) {
  if (!Boolean.TRUE.equals(user.getBasicQuizPassed())) {
    throw new RankedNotUnlockedException(
      "Bạn cần hoàn thành Bài Giáo Lý Căn Bản để mở khóa Ranked"
    );
  }
}
```

### 2.4 Custom exceptions

```java
// BasicQuizCooldownException.java
public class BasicQuizCooldownException extends RuntimeException {
  private final int secondsRemaining;
  // getter
}

// BasicQuizAlreadyPassedException.java
public class BasicQuizAlreadyPassedException extends RuntimeException {}

// RankedNotUnlockedException.java
public class RankedNotUnlockedException extends RuntimeException {
  // simple message
}
```

Map qua global exception handler → 403 (cooldown), 409 (already passed), 403 (not unlocked).

### Acceptance criteria

- 3 endpoints work: GET /status, GET /questions, POST /submit
- User pass 8/10 → `basicQuizPassed = true`, `basicQuizPassedAt` set
- User fail < 8/10 → cooldown 60s active
- Submit lần 2 trước 60s → 403 với message countdown
- Submit khi đã pass → 409 "already passed"
- Tier 1 user chưa pass → POST /api/sessions với mode=ranked bị 403
- Tier 1 user đã pass → POST /api/sessions với mode=ranked OK
- Tests (10): get status, get questions vi+en, pass 8/10, pass 10/10, fail 7/10, cooldown enforced, already passed, language filter, ranked unlock check, edge case 9/10

### Cost: 2-2.5h

### Commit
- `feat(api): BasicQuizService + endpoints + replace Ranked XP gate`

---

## Step 3 — Frontend: BasicQuizCard trên Home

### Component: `apps/web/src/components/BasicQuizCard.tsx`

Replace existing Ranked card (or wrap it).

**State 1: Chưa làm bài (attemptCount = 0)**
```
┌──────────────────────────────────────────────────────────┐
│  🎓  THI ĐẤU XẾP HẠNG                                     │
│                                                            │
│  Tranh tài trực tiếp, kiếm điểm rank lớn.                 │
│                                                            │
│  ──────────────────────────────────────────────           │
│                                                            │
│  📖 HOÀN THÀNH BÀI GIÁO LÝ CĂN BẢN ĐỂ MỞ KHÓA            │
│                                                            │
│  10 câu hỏi cơ bản về đức tin Cơ-đốc                      │
│  Đúng tối thiểu 8/10 để pass                              │
│                                                            │
│  ┌────────────────────────────────────────────────────┐   │
│  │  📖  Bắt đầu Bài Giáo Lý                          │   │
│  └────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

**State 2: Đã làm nhưng chưa pass (attemptCount > 0, không cooldown)**
```
┌──────────────────────────────────────────────────────────┐
│  🎓  THI ĐẤU XẾP HẠNG                                     │
│                                                            │
│  📖 BÀI GIÁO LÝ CĂN BẢN                                   │
│                                                            │
│  Lần thử gần nhất: chưa pass                              │
│  Đã thử: 2 lần                                             │
│  Cần đúng: 8/10                                            │
│                                                            │
│  ┌────────────────────────────────────────────────────┐   │
│  │  🔄  Làm lại bài                                  │   │
│  └────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

**State 3: Trong cooldown**
```
┌──────────────────────────────────────────────────────────┐
│  🎓  THI ĐẤU XẾP HẠNG                                     │
│                                                            │
│  📖 BÀI GIÁO LÝ CĂN BẢN                                   │
│                                                            │
│  ⏱  Có thể thử lại sau: 0:42                              │
│                                                            │
│  Đã thử: 2 lần                                             │
│  Cần đúng: 8/10                                            │
│                                                            │
│  ┌────────────────────────────────────────────────────┐   │
│  │  ⏳  Đang chờ... (0:42)                           │   │
│  └────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

Button disabled, countdown realtime.

**State 4: Đã pass (basicQuizPassed = true)**
```
┌──────────────────────────────────────────────────────────┐
│  ✅ Đã hoàn thành Bài Giáo Lý                             │
│  🎓  THI ĐẤU XẾP HẠNG                                     │
│                                                            │
│  Tranh tài trực tiếp, kiếm điểm rank lớn.                 │
│                                                            │
│  ⚡ 100/100 NĂNG LƯỢNG                                     │
│  Sai -5 năng lượng/câu                                     │
│                                                            │
│  ┌────────────────────────────────────────────────────┐   │
│  │  ▶  Bắt đầu Ranked                                │   │
│  └────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

### Implementation skeleton

```tsx
function BasicQuizCard() {
  const { data: status, refetch } = useQuery({
    queryKey: ['basic-quiz-status'],
    queryFn: () => api.get('/api/basic-quiz/status'),
    refetchInterval: (data) => 
      data?.cooldownRemainingSeconds > 0 ? 1000 : false, // poll mỗi 1s khi đang cooldown
  })
  
  if (!status) return <SkeletonCard />
  
  if (status.passed) return <RankedUnlockedCard />
  if (status.cooldownRemainingSeconds > 0) return <CooldownCard status={status} />
  if (status.attemptCount > 0) return <RetryCard status={status} />
  return <FirstTimeCard status={status} />
}
```

### Acceptance criteria

- 4 states render đúng
- Cooldown countdown realtime (mỗi giây update)
- Click "Bắt đầu Bài Giáo Lý" navigate `/basic-quiz`
- Click "Bắt đầu Ranked" (state 4) navigate `/ranked`
- Tests (5): render mỗi state, navigate đúng

### Cost: 1.5-2h

### Commit
- `feat(home): BasicQuizCard with 4 states`

---

## Step 4 — Frontend: BasicQuiz Page (chơi 10 câu)

### Page: `apps/web/src/pages/BasicQuiz.tsx`

Route: `/basic-quiz`

Layout: Giống Quiz page hiện tại nhưng simpler:
- Header: "📖 Bài Giáo Lý Căn Bản — Câu {n}/10"
- Progress bar
- Question + 4 MCQ options
- KHÔNG có timer (vì doctrinal questions cần suy nghĩ)
- KHÔNG có energy cost
- KHÔNG có streak/combo

### Flow

```
1. Load /basic-quiz
2. GET /api/basic-quiz/questions?language=vi
3. User answer each câu (10 câu)
4. Sau câu cuối: POST /api/basic-quiz/submit { answers: [...] }
5. Server returns BasicQuizResult
6. Hiển thị result screen:
   - Pass: 🎉 celebration screen + "Mở khóa Ranked thành công!"
   - Fail: review screen với câu sai + "Thử lại sau 60 giây"
```

### Result screen — Pass

```
┌──────────────────────────────────────────────────────────┐
│                                                            │
│              🎉                                            │
│                                                            │
│       Chúc mừng! Bạn đã hoàn thành                        │
│       Bài Giáo Lý Căn Bản                                  │
│                                                            │
│            8 / 10 câu đúng                                 │
│                                                            │
│  ✨ Đã mở khóa: Thi Đấu Xếp Hạng                          │
│                                                            │
│  ┌────────────────────────────────────────────────────┐   │
│  │  ▶  Bắt đầu Ranked ngay                           │   │
│  └────────────────────────────────────────────────────┘   │
│                                                            │
│         [Quay lại trang chủ]                              │
└──────────────────────────────────────────────────────────┘
```

### Result screen — Fail

```
┌──────────────────────────────────────────────────────────┐
│                                                            │
│              😅                                            │
│                                                            │
│     Bạn đúng 6/10 câu — chưa đủ                            │
│     Cần đúng tối thiểu 8/10 để pass                       │
│                                                            │
│  📖 Hãy ôn lại các câu sai bên dưới:                      │
│                                                            │
│  Câu 4: ❌ Bạn chọn... | ✅ Đáp án đúng:...                │
│       💡 [Explanation...]                                  │
│                                                            │
│  [...3 câu sai khác...]                                    │
│                                                            │
│  ⏱  Có thể thử lại sau: 0:60                              │
│                                                            │
│         [Quay lại trang chủ]                              │
└──────────────────────────────────────────────────────────┘
```

### Acceptance criteria

- Quiz flow work end-to-end
- 10 câu hiển thị shuffled order (mỗi lần khác nhau)
- Submit work, hiển thị correct result screen
- Pass: navigation hoặc CTA "Bắt đầu Ranked" work
- Fail: hiển thị câu sai + explanation, cooldown countdown
- Tests (6): render quiz, answer all, submit pass, submit fail, navigate after pass, review wrong answers

### Cost: 2-2.5h

### Commit
- `feat(quiz): BasicQuiz page with 10 questions + result screens`

---

## Step 5 — Admin: Edit bible_basics questions

### Mục tiêu

Admin có thể edit 10 câu hỏi `bible_basics` qua existing Questions page.

### Changes cần làm

`apps/web/src/admin/pages/Questions.tsx`:

1. **Thêm filter "Category"** vào filter bar:
   ```
   [All] [Bible Basics] [Practice] [...]
   ```

2. **Hiển thị badge "Bible Basics"** trên rows có category=bible_basics

3. **Cảnh báo khi delete câu bible_basics**:
   ```
   ⚠️ Câu này thuộc Bài Giáo Lý Căn Bản. 
   Xóa sẽ ảnh hưởng đến quá trình unlock Ranked của user mới.
   Đảm bảo bạn có 10 câu thay thế.
   
   [Hủy] [Vẫn xóa]
   ```

4. **Backend safeguard**: 
   ```java
   @DeleteMapping("/{id}")
   public ResponseEntity<?> delete(@PathVariable Long id) {
     Question q = repo.findById(id).orElseThrow();
     
     if ("bible_basics".equals(q.getCategory())) {
       long count = repo.countByCategoryAndLanguageAndIsActive(
         "bible_basics", q.getLanguage(), true
       );
       if (count <= 10) {
         throw new BadRequestException(
           "Không thể xóa — cần giữ tối thiểu 10 câu Bible Basics cho ngôn ngữ " + q.getLanguage()
         );
       }
     }
     // ...delete
   }
   ```

5. **Tương tự cho update**: Nếu update làm question inactive → check tương tự.

### Acceptance criteria

- Filter "Bible Basics" trong admin Questions page
- Badge hiển thị trên rows
- Cannot delete nếu sẽ < 10 câu active per language
- Tests (3): filter work, delete blocked, update inactive blocked

### Cost: 1h

### Commit
- `feat(admin): Bible Basics questions management with safeguards`

---

## Step 6 — i18n + Cleanup

### Strings mới `vi.json`

```json
{
  "basicQuiz": {
    "title": "Bài Giáo Lý Căn Bản",
    "subtitle": "10 câu hỏi cơ bản về đức tin Cơ-đốc",
    "passThreshold": "Đúng tối thiểu {{count}}/{{total}} để pass",
    "questionCounter": "Câu {{current}}/{{total}}",
    "submitButton": "Nộp bài",
    "result": {
      "passTitle": "Chúc mừng!",
      "passSubtitle": "Bạn đã hoàn thành Bài Giáo Lý Căn Bản",
      "passUnlock": "✨ Đã mở khóa: Thi Đấu Xếp Hạng",
      "passCta": "Bắt đầu Ranked ngay",
      "failTitle": "Chưa đủ",
      "failSubtitle": "Bạn đúng {{correct}}/{{total}} câu — cần tối thiểu {{required}}",
      "failReview": "Hãy ôn lại các câu sai bên dưới:",
      "cooldownMessage": "Có thể thử lại sau: {{time}}",
      "homeButton": "Quay lại trang chủ"
    },
    "card": {
      "rankedHeader": "THI ĐẤU XẾP HẠNG",
      "rankedDescription": "Tranh tài trực tiếp, kiếm điểm rank lớn.",
      "unlockHeader": "📖 HOÀN THÀNH BÀI GIÁO LÝ CĂN BẢN ĐỂ MỞ KHÓA",
      "passedBadge": "✅ Đã hoàn thành Bài Giáo Lý",
      "attemptCount": "Đã thử: {{count}} lần",
      "cooldownLabel": "Có thể thử lại sau",
      "ctaFirst": "Bắt đầu Bài Giáo Lý",
      "ctaRetry": "Làm lại bài",
      "ctaCooldown": "Đang chờ...",
      "ctaRanked": "Bắt đầu Ranked"
    }
  }
}
```

### `en.json` — corresponding translations

(Translate all keys to English)

### Strings cần XÓA

- `ranked.locked.*`
- `home.lockedTeaser.*` (nếu còn)
- `ranked.xpRequirement.*`
- `ranked.earlyUnlock.*`

### Acceptance criteria

- i18n validator pass
- Tất cả keys mới có cả vi và en
- Old keys removed

### Cost: 30 phút

### Commit
- `i18n: Bible Basics strings + remove old XP-based unlock strings`

---

## Step 7 — Full regression

### Checklist

- [ ] `npm run build` pass (0 errors)
- [ ] FE tests pass (>= baseline + ~14 new)
- [ ] BE tests pass (>= baseline + ~10 new)
- [ ] Manual smoke test:
  - Fresh user → mở Home → BasicQuizCard hiện State 1
  - Click "Bắt đầu Bài Giáo Lý" → vào /basic-quiz
  - Trả lời 10 câu → submit → result screen
  - **Test pass**: Trả lời ≥ 8/10 đúng → pass screen → click "Bắt đầu Ranked" → vào /ranked
  - **Test fail**: Trả lời < 8/10 → fail screen → review câu sai → cooldown 60s
  - **Test cooldown**: Quay lại Home trong 60s → BasicQuizCard State 3 với countdown
  - **Test cooldown end**: Sau 60s → BasicQuizCard State 2 → có thể retry
  - **Test passed persist**: Logout/login → vẫn passed
- [ ] Admin: filter Bible Basics work, delete safeguard work
- [ ] i18n validator pass
- [ ] No console errors

### Commit
- `chore: regression after Bible Basics quiz implementation`

---

## Workflow Order (BẮT BUỘC)

```
Step 0: Verify                       — KHÔNG commit
Step 1: DB schema + seed             — 1 commit
Step 2: Service + endpoints          — 1 commit
Step 3: BasicQuizCard component      — 1 commit
Step 4: BasicQuiz page (chơi)        — 1 commit
Step 5: Admin management             — 1 commit
Step 6: i18n cleanup                 — 1 commit
Step 7: Regression                   — 1 commit
```

7 commits, mỗi commit revertable.

---

## Files dự kiến đụng tới

### Backend
- **Mới**:
  - `apps/api/src/main/resources/db/migration/V29__bible_basics_quiz.sql`
  - `apps/api/src/main/java/com/biblequiz/modules/quiz/service/BasicQuizService.java`
  - `apps/api/src/main/java/com/biblequiz/modules/quiz/dto/BasicQuizStatus.java`
  - `apps/api/src/main/java/com/biblequiz/modules/quiz/dto/BasicQuizResult.java`
  - `apps/api/src/main/java/com/biblequiz/modules/quiz/dto/BasicQuizSubmission.java`
  - `apps/api/src/main/java/com/biblequiz/modules/quiz/exception/BasicQuizCooldownException.java`
  - `apps/api/src/main/java/com/biblequiz/modules/quiz/exception/BasicQuizAlreadyPassedException.java`
  - `apps/api/src/main/java/com/biblequiz/modules/quiz/exception/RankedNotUnlockedException.java`
  - `apps/api/src/main/java/com/biblequiz/api/BasicQuizController.java`
- **Sửa**:
  - `apps/api/src/main/java/com/biblequiz/modules/quiz/entity/Question.java` (add category)
  - `apps/api/src/main/java/com/biblequiz/modules/user/entity/User.java` (add 4 fields)
  - `apps/api/src/main/java/com/biblequiz/modules/quiz/service/SessionService.java` (replace XP gate)
  - `apps/api/src/main/java/com/biblequiz/modules/quiz/repository/QuestionRepository.java` (add findByCategory)
  - `apps/api/src/main/java/com/biblequiz/api/AdminQuestionController.java` (delete safeguard)

### Frontend
- **Mới**:
  - `apps/web/src/components/BasicQuizCard.tsx`
  - `apps/web/src/pages/BasicQuiz.tsx`
  - Tests cho 2 file trên
- **Sửa**:
  - `apps/web/src/components/GameModeGrid.tsx` hoặc `pages/Home.tsx` (replace Ranked card với BasicQuizCard)
  - `apps/web/src/admin/pages/Questions.tsx` (thêm filter Category)
  - `apps/web/src/i18n/vi.json` + `en.json`
  - Routing: thêm `/basic-quiz` route

### Mobile
- **TÁCH PR** sau khi web done

---

## Definition of Done

✅ 10 câu giáo lý seed thành công (vi + en, total 20 records)  
✅ Schema có `basicQuizPassed`, `basicQuizPassedAt`, `basicQuizAttempts`, `basicQuizLastAttemptAt`  
✅ 3 endpoints work: GET /status, GET /questions, POST /submit  
✅ Ranked gate đổi từ XP-based → bible_basics_passed-based  
✅ BasicQuizCard hiển thị 4 states đúng  
✅ BasicQuiz page chơi 10 câu, submit, result screen  
✅ Pass 8/10 → unlock Ranked vĩnh viễn  
✅ Fail → cooldown 60s active  
✅ Admin có thể edit 10 câu, không thể delete xuống dưới 10  
✅ KHÔNG còn references đến XP unlock (1000 XP, "early unlock", etc.)  
✅ All tests + i18n validator pass  

---

## Câu hỏi trước khi bắt đầu

Trả lời trong reply đầu tiên:

1. **Step 0 findings**: Question entity có field `category` chưa? User entity có field tương tự `basicQuizPassed` chưa?
2. **Migration version**: Số V tiếp theo là V29? Hay khác?
3. **Concern về 10 câu**: Có comment gì về wording, options, hoặc explanation của 10 câu trong seed SQL? Đặc biệt câu nào có thể controversial trong context Free Methodist Vietnam?

Sau khi confirm 3 câu → bắt đầu Step 1.

---

## Reminder cuối

- Đây là **major feature** — không chỉ refactor.
- 10 câu giáo lý là **product decision đã chốt** — KHÔNG sửa wording mà không hỏi user trước.
- Pass once = unlock vĩnh viễn — KHÔNG implement re-test feature.
- Cooldown 60s — KHÔNG đổi.
- Threshold 8/10 — KHÔNG đổi.
- Update SPEC_USER_v3 §3.2.3 sau khi launch (TODO mới).
- Mobile parity tách PR riêng sau.
