# Book Seed TODO — `apps/api/src/main/resources/seed/questions/`

> **Goal**: 66 Protestant books, mỗi sách có **cặp** `{slug}_quiz.json` (VI, RVV11) + `{slug}_quiz_en.json` (EN, ESV) với 1:1 mapping. Số câu khuyến nghị theo size book — xem `PROMPT_GENERATE_QUESTIONS.md`.
>
> **Audit lúc 2026-04-25**: 42/66 có VI, 14/66 có EN, 23 hoàn toàn thiếu.

---

## Audit hiện trạng (sort theo slug)

Cột "Status": ✅ đủ | ⚠️ dưới min | ❌ thiếu | 🌐 thiếu EN

| Slug | book | Group | VI | EN | Target | Status |
|------|------|-------|----|----|--------|--------|
| genesis | Genesis | Pentateuch | 75 | 0 | 100+ | ⚠️ + 🌐 |
| exodus | Exodus | Pentateuch | 75 | 0 | 60-100 | 🌐 |
| leviticus | Leviticus | Pentateuch | 75 | 0 | 40-60 | 🌐 |
| numbers | Numbers | Pentateuch | 75 | 0 | 40-60 | 🌐 |
| deuteronomy | Deuteronomy | Pentateuch | 32 | 0 | 40-60 | ⚠️ + 🌐 |
| joshua | Joshua | History | 12 | 12 | 40-60 | ⚠️ |
| judges | Judges | History | 13 | 0 | 40-60 | ⚠️ + 🌐 |
| ruth | Ruth | History | 13 | 13 | 40-60 | ⚠️ |
| 1samuel | 1 Samuel | History | 12 | 12 | 40-60 | ⚠️ |
| 2samuel | 2 Samuel | History | 12 | 12 | 40-60 | ⚠️ |
| 1kings | 1 Kings | History | 13 | 0 | 40-60 | ⚠️ + 🌐 |
| 2kings | 2 Kings | History | 13 | 0 | 40-60 | ⚠️ + 🌐 |
| 1chronicles | 1 Chronicles | History | 0 | 0 | 30-50 | ❌ |
| 2chronicles | 2 Chronicles | History | 0 | 0 | 30-50 | ❌ |
| ezra | Ezra | History | 0 | 0 | 20-30 | ❌ |
| nehemiah | Nehemiah | History | 13 | 0 | 30-40 | ⚠️ + 🌐 |
| esther | Esther | History | 13 | 0 | 30-40 | ⚠️ + 🌐 |
| job | Job | Wisdom | 12 | 12 | 40-60 | ⚠️ |
| psalms | Psalms | Wisdom | 19 | 0 | 100+ | ⚠️ + 🌐 |
| proverbs | Proverbs | Wisdom | 14 | 0 | 60-80 | ⚠️ + 🌐 |
| ecclesiastes | Ecclesiastes | Wisdom | 12 | 12 | 30-40 | ⚠️ |
| songofsolomon | Song of Solomon | Wisdom | 0 | 0 | 20-30 | ❌ |
| isaiah | Isaiah | Prophets | 14 | 0 | 60-80 | ⚠️ + 🌐 |
| jeremiah | Jeremiah | Prophets | 12 | 12 | 60-80 | ⚠️ |
| lamentations | Lamentations | Prophets | 11 | 0 | 20-30 | ⚠️ + 🌐 |
| ezekiel | Ezekiel | Prophets | 12 | 12 | 40-60 | ⚠️ |
| daniel | Daniel | Prophets | 13 | 0 | 40-60 | ⚠️ + 🌐 |
| hosea | Hosea | Prophets | 0 | 0 | 30-40 | ❌ |
| joel | Joel | Prophets | 0 | 0 | 20 | ❌ |
| amos | Amos | Prophets | 0 | 0 | 30 | ❌ |
| obadiah | Obadiah | Prophets | 0 | 0 | 20 (min) | ❌ |
| jonah | Jonah | Prophets | 12 | 12 | 30-40 | ⚠️ |
| micah | Micah | Prophets | 11 | 0 | 20-30 | ⚠️ + 🌐 |
| nahum | Nahum | Prophets | 0 | 0 | 20 | ❌ |
| habakkuk | Habakkuk | Prophets | 12 | 12 | 20-30 | ✅ (gần đủ) |
| zephaniah | Zephaniah | Prophets | 0 | 0 | 20 | ❌ |
| haggai | Haggai | Prophets | 0 | 0 | 20 | ❌ |
| zechariah | Zechariah | Prophets | 0 | 0 | 30-40 | ❌ |
| malachi | Malachi | Prophets | 12 | 0 | 20-30 | ⚠️ + 🌐 |
| matthew | Matthew | Gospels | 34 | 0 | 100+ | ⚠️ + 🌐 |
| mark | Mark | Gospels | 33 | 0 | 60-80 | ⚠️ + 🌐 |
| luke | Luke | Gospels | 33 | 0 | 100+ | ⚠️ + 🌐 |
| john | John | Gospels | 34 | 0 | 100+ | ⚠️ + 🌐 |
| acts | Acts | Acts | 33 | 0 | 60-80 | ⚠️ + 🌐 |
| romans | Romans | Epistle | 34 | 0 | 60-80 | ⚠️ + 🌐 |
| 1corinthians | 1 Corinthians | Epistle | 34 | 0 | 50-60 | ⚠️ + 🌐 |
| 2corinthians | 2 Corinthians | Epistle | 30 | 0 | 40-50 | ⚠️ + 🌐 |
| galatians | Galatians | Epistle | 12 | 12 | 30-40 | ⚠️ |
| ephesians | Ephesians | Epistle | 14 | 0 | 30-40 | ⚠️ + 🌐 |
| philippians | Philippians | Epistle | 11 | 0 | 30-40 | ⚠️ + 🌐 |
| colossians | Colossians | Epistle | 0 | 0 | 30 | ❌ |
| 1thessalonians | 1 Thessalonians | Epistle | 0 | 0 | 30 | ❌ |
| 2thessalonians | 2 Thessalonians | Epistle | 0 | 0 | 20 | ❌ |
| 1timothy | 1 Timothy | Epistle | 0 | 0 | 30 | ❌ |
| 2timothy | 2 Timothy | Epistle | 0 | 0 | 25 | ❌ |
| titus | Titus | Epistle | 0 | 0 | 20 | ❌ |
| philemon | Philemon | Epistle | 0 | 0 | 20 (min) | ❌ |
| hebrews | Hebrews | Epistle | 12 | 12 | 50-60 | ⚠️ |
| james | James | Epistle | 12 | 12 | 30-40 | ⚠️ |
| 1peter | 1 Peter | Epistle | 11 | 11 | 30-40 | ⚠️ |
| 2peter | 2 Peter | Epistle | 0 | 0 | 25 | ❌ |
| 1john | 1 John | Epistle | 12 | 12 | 30-40 | ⚠️ |
| 2john | 2 John | Epistle | 0 | 0 | 20 (min) | ❌ |
| 3john | 3 John | Epistle | 0 | 0 | 20 (min) | ❌ |
| jude | Jude | Epistle | 0 | 0 | 20 (min) | ❌ |
| revelation | Revelation | Apocalyptic | 13 | 0 | 50-60 | ⚠️ + 🌐 |

---

## Priority queue (làm theo thứ tự này)

### P1 — Sách hoàn toàn thiếu (❌, 23 sách)

Mỗi sách cần CẢ VI + EN. Bắt đầu từ size nhỏ nhất để dễ ship:

**Tier 1 — Min 20 câu (sách 1 chương)**
- [x] obadiah (1 chương, 21 câu) — 20 VI + 20 EN, commit 825b680
- [x] philemon (1 chương, 25 câu) — 21 VI + 21 EN
- [ ] 2john (1 chương, 13 câu)
- [ ] 3john (1 chương, 14 câu)
- [ ] jude (1 chương, 25 câu)

**Tier 2 — 20-30 câu (sách ngắn)**
- [ ] joel (3 chương)
- [ ] nahum (3 chương)
- [ ] zephaniah (3 chương)
- [ ] haggai (2 chương)
- [ ] 2thessalonians (3 chương)
- [ ] titus (3 chương)

**Tier 3 — 25-30 câu**
- [ ] amos (9 chương)
- [ ] hosea (14 chương)
- [ ] 2timothy (4 chương)
- [ ] 2peter (3 chương)
- [ ] colossians (4 chương)
- [ ] 1thessalonians (5 chương)
- [ ] 1timothy (6 chương)
- [ ] zechariah (14 chương)

**Tier 4 — 30-50 câu (sách lớn missing)**
- [ ] songofsolomon (8 chương)
- [ ] ezra (10 chương)
- [ ] 1chronicles (29 chương)
- [ ] 2chronicles (36 chương)

### P2 — Sách có VI nhưng thiếu EN (🌐, 28 sách)

Mỗi sách dịch VI → EN giữ 1:1 mapping. Chạy script `scripts/translate_to_en.py` (Gemini) để bootstrap, sau đó review từng câu.

Danh sách: genesis, exodus, leviticus, numbers, deuteronomy, judges, 1kings, 2kings, nehemiah, esther, psalms, proverbs, isaiah, lamentations, daniel, micah, malachi, matthew, mark, luke, john, acts, romans, 1corinthians, 2corinthians, ephesians, philippians, revelation.

### P3 — Sách dưới minimum 20 câu (⚠️, ~17 sách)

Top up đến 20 câu min cho mọi sách (ưu tiên size nhỏ trước). Khi update VI, BẮT BUỘC update EN tương ứng để giữ 1:1 mapping.

### P4 — Core books cần đẩy lên rich tier 100+

| Sách | VI hiện tại | Target | Còn thiếu |
|------|-------------|--------|-----------|
| Genesis | 75 | 100+ | +25 |
| Psalms | 19 | 100+ | +81 |
| Matthew | 34 | 100+ | +66 |
| Mark | 33 | 60-80 | +27-47 |
| Luke | 33 | 100+ | +67 |
| John | 34 | 100+ | +66 |
| Acts | 33 | 60-80 | +27-47 |
| Romans | 34 | 60-80 | +27-47 |

---

## Process per book

1. Đọc `PROMPT_GENERATE_QUESTIONS.md` (spec đầy đủ — không skip)
2. Tham khảo file mẫu: `genesis_quiz.json` (cấu trúc) + `1peter_quiz.json` + `1peter_quiz_en.json` (cặp VI/EN)
3. Generate cặp VI + EN, mỗi câu match field-for-field (book/chapter/verseStart/verseEnd/difficulty/type/correctAnswer giữ nguyên giữa 2 file)
4. Đặt vào `apps/api/src/main/resources/seed/questions/{slug}_quiz.json` + `{slug}_quiz_en.json`
5. Restart api: `docker compose build api && docker compose up -d api`
6. Verify log `QuestionSeeder: inserted N new` khớp tổng số câu mới

## Self-check trước khi commit (per file)

- [ ] Top-level `[...]` array, UTF-8, no BOM
- [ ] Mỗi câu có đủ field: book, chapter, verseStart, [verseEnd], difficulty, type, content, correctAnswer, explanation, language, options, tags
- [ ] type ∈ {`multiple_choice_single`, `multiple_choice_multi`}; options luôn 4
- [ ] Difficulty mix ~ 50% easy / 30% medium / 20% hard
- [ ] correctAnswer phân bổ đều index 0/1/2/3 (không dồn về [0])
- [ ] Explanation có verse trích inline (vd "Sáng Thế Ký 1:1 — '...'")
- [ ] Tags 4-6, casing đúng, theme specific
- [ ] VI ↔ EN: cùng số câu, cùng thứ tự, cùng correctAnswer index
