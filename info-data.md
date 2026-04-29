# Thống kê dữ liệu câu hỏi BibleQuiz

> Source of truth: `apps/api/src/main/resources/seed/questions/*.json`
> Cập nhật: 2026-04-28

## Tổng quan

| Hạng mục | Số lượng |
|----------|----------|
| Tổng số sách | 66 (Protestant canon) |
| Tổng câu hỏi VI | 3341 |
| Tổng câu hỏi EN | 3341 |
| Tổng VI + EN | 6682 |
| Câu Dễ (easy) | 1192 (35.7%) |
| Câu Vừa (medium) | 1427 (42.7%) |
| Câu Khó (hard) | 722 (21.6%) |

> Phân bổ độ khó tính trên VI. EN là bản dịch 1:1 nên phân bổ độ khó giống hệt VI.
> Target ratio dài hạn 30/45/25 — pool đang dần dần đến gần (đang ở 35.7/42.7/21.6).

## Cựu Ước (39 sách)

| # | Sách | VI | EN | Dễ | Vừa | Khó |
|---|------|----|----|----|-----|-----|
| 1 | Genesis | 150 | 150 | 47 | 64 | 39 |
| 2 | Exodus | 151 | 151 | 45 | 69 | 37 |
| 3 | Leviticus | 75 | 75 | 35 | 25 | 15 |
| 4 | Numbers | 75 | 75 | 35 | 25 | 15 |
| 5 | Deuteronomy | 70 | 70 | 21 | 32 | 17 |
| 6 | Joshua | 20 | 20 | 11 | 8 | 1 |
| 7 | Judges | 20 | 20 | 11 | 7 | 2 |
| 8 | Ruth | 20 | 20 | 10 | 8 | 2 |
| 9 | 1 Samuel | 20 | 20 | 11 | 7 | 2 |
| 10 | 2 Samuel | 20 | 20 | 9 | 9 | 2 |
| 11 | 1 Kings | 20 | 20 | 11 | 7 | 2 |
| 12 | 2 Kings | 20 | 20 | 12 | 6 | 2 |
| 13 | 1 Chronicles | 25 | 25 | 10 | 11 | 4 |
| 14 | 2 Chronicles | 25 | 25 | 10 | 11 | 4 |
| 15 | Ezra | 25 | 25 | 10 | 11 | 4 |
| 16 | Nehemiah | 20 | 20 | 12 | 7 | 1 |
| 17 | Esther | 20 | 20 | 11 | 7 | 2 |
| 18 | Job | 20 | 20 | 10 | 8 | 2 |
| 19 | Psalms | 180 | 180 | 59 | 77 | 44 |
| 20 | Proverbs | 80 | 80 | 24 | 36 | 20 |
| 21 | Ecclesiastes | 20 | 20 | 12 | 6 | 2 |
| 22 | Song of Solomon | 25 | 25 | 10 | 11 | 4 |
| 23 | Isaiah | 99 | 99 | 30 | 44 | 25 |
| 24 | Jeremiah | 50 | 50 | 15 | 23 | 12 |
| 25 | Lamentations | 20 | 20 | 12 | 6 | 2 |
| 26 | Ezekiel | 50 | 50 | 15 | 23 | 12 |
| 27 | Daniel | 60 | 60 | 18 | 27 | 15 |
| 28 | Hosea | 25 | 25 | 10 | 11 | 4 |
| 29 | Joel | 20 | 20 | 10 | 7 | 3 |
| 30 | Amos | 25 | 25 | 10 | 11 | 4 |
| 31 | Obadiah | 20 | 20 | 9 | 8 | 3 |
| 32 | Jonah | 20 | 20 | 13 | 6 | 1 |
| 33 | Micah | 20 | 20 | 10 | 8 | 2 |
| 34 | Nahum | 20 | 20 | 10 | 7 | 3 |
| 35 | Habakkuk | 20 | 20 | 11 | 7 | 2 |
| 36 | Zephaniah | 20 | 20 | 10 | 7 | 3 |
| 37 | Haggai | 20 | 20 | 10 | 7 | 3 |
| 38 | Zechariah | 25 | 25 | 10 | 11 | 4 |
| 39 | Malachi | 20 | 20 | 10 | 9 | 1 |
| | **Tổng Cựu Ước** | **1635** | **1635** | **639** | **674** | **322** |

## Tân Ước (27 sách)

| # | Sách | VI | EN | Dễ | Vừa | Khó |
|---|------|----|----|----|-----|-----|
| 1 | Matthew | 160 | 160 | 48 | 71 | 41 |
| 2 | Mark | 120 | 120 | 36 | 54 | 30 |
| 3 | Luke | 159 | 159 | 48 | 72 | 39 |
| 4 | John | 160 | 160 | 48 | 71 | 41 |
| 5 | Acts | 130 | 130 | 39 | 58 | 33 |
| 6 | Romans | 130 | 130 | 39 | 59 | 32 |
| 7 | 1 Corinthians | 80 | 80 | 24 | 36 | 20 |
| 8 | 2 Corinthians | 30 | 30 | 14 | 12 | 4 |
| 9 | Galatians | 50 | 50 | 15 | 23 | 12 |
| 10 | Ephesians | 60 | 60 | 18 | 27 | 15 |
| 11 | Philippians | 50 | 50 | 15 | 23 | 12 |
| 12 | Colossians | 25 | 25 | 10 | 11 | 4 |
| 13 | 1 Thessalonians | 25 | 25 | 10 | 11 | 4 |
| 14 | 2 Thessalonians | 20 | 20 | 10 | 7 | 3 |
| 15 | 1 Timothy | 25 | 25 | 10 | 11 | 4 |
| 16 | 2 Timothy | 25 | 25 | 10 | 11 | 4 |
| 17 | Titus | 20 | 20 | 10 | 7 | 3 |
| 18 | Philemon | 21 | 21 | 10 | 7 | 4 |
| 19 | Hebrews | 80 | 80 | 24 | 36 | 20 |
| 20 | James | 51 | 51 | 15 | 24 | 12 |
| 21 | 1 Peter | 50 | 50 | 15 | 23 | 12 |
| 22 | 2 Peter | 25 | 25 | 10 | 10 | 5 |
| 23 | 1 John | 50 | 50 | 15 | 23 | 12 |
| 24 | 2 John | 20 | 20 | 10 | 7 | 3 |
| 25 | 3 John | 20 | 20 | 10 | 7 | 3 |
| 26 | Jude | 20 | 20 | 10 | 7 | 3 |
| 27 | Revelation | 100 | 100 | 30 | 45 | 25 |
| | **Tổng Tân Ước** | **1706** | **1706** | **553** | **753** | **400** |

## Sách đã đạt target chất lượng V3 (ratio 30/45/25)

Sau các đợt mở rộng V2 Tier A + V3 Tier B/C, các sách sau đã đạt mức "rich coverage" với phân bổ độ khó cân đối:

**14 sách V3 Tier B/C (mở rộng 2026-04-27..28)**:
- Tier B1 (giá trị Christology cao): Isaiah 99, Hebrews 80, 1 Corinthians 80
- Tier B2 (Pauline + General Epistles): Ephesians 60, Philippians 50, Galatians 50, James 51, 1 Peter 50, 1 John 50
- Tier B3 (OT major): Daniel 60, Jeremiah 50, Proverbs 80, Deuteronomy 70, Ezekiel 50

**Sách Tier A (V2 Go-Live, ratio 30/45/25 hoặc gần)**:
- Genesis 150, Exodus 151, Psalms 180
- Matthew 160, Mark 120, Luke 159, John 160, Acts 130, Romans 130, Revelation 100

## Sách còn cần mở rộng (ratio Easy quá cao)

Các sách nhỏ vẫn còn 20-25 câu với phân bổ ~50% Easy, chưa cân bằng Medium/Hard:

- 12 sách tiên tri nhỏ (Joel, Amos, Obadiah, Jonah, Micah, Nahum, Habakkuk, Zephaniah, Haggai, Zechariah, Hosea, Malachi)
- 12 sách lịch sử Cựu Ước nhỏ (Joshua đến Esther)
- Job, Ecclesiastes, Song of Solomon, Lamentations
- Tân Ước: 2 Corinthians, Colossians, 1-2 Thessalonians, 1-2 Timothy, Titus, Philemon, 2 Peter, 2-3 John, Jude

## Ghi chú

- **VI** = Vietnamese (RVV11), **EN** = English (ESV)
- Mỗi câu VI có 1 câu EN tương ứng (1:1 mapping cùng `chapter`, `verseStart`, `difficulty`, `type`).
- Các câu cũ loại `true_false` và `fill_in_blank` đã chuyển sang `multiple_choice_single` (commit `b059015`).
- Loại câu hỏi hiện tại: `multiple_choice_single` + `multiple_choice_multi` (không còn TF/FIB).
- Target ratio chất lượng: **30/45/25** (Easy/Medium/Hard) — sách Tier A + B đã đạt; pool tổng đang dần đến gần.
