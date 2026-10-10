# Bộ câu tiếng Anh (BSB)

Bộ câu tiếng Anh viết mới, độc lập với bộ tiếng Việt, theo **Berean Standard Bible (BSB)**. BSB là tiếng Anh hiện đại, dễ đọc, và đã được hiến tặng vào public domain (2023), nên toàn văn nằm ngay trong repo (`bsb_vpl.txt`, bản VPL của eBible.org). Người dùng chọn bản nầy thay cho ESV ngày 10/10/2026: "lấy bản tiếng Anh gần gũi với giới trẻ".

Bộ cũ (`*_quiz_en.json`, 5.048 câu) là bản dịch máy của bộ tiếng Việt cũ, chưa từng đối chiếu Kinh Thánh. Xong sách nào thì bỏ file cũ của sách đó, như bộ tiếng Việt.

## Cấu trúc

- Câu **Dễ** của 120 câu chuyện cốt lõi mang trường `story` (cùng id với bộ Dễ cốt lõi tiếng Việt), nên Luyện Tập theo câu chuyện chạy được bằng tiếng Anh. Tên câu chuyện tiếng Anh ở `stories_en.json`; `content/easy-core/build.py export` ghép vào `seed/stories/stories.json` (`titleEn`, `refEn`).
- Câu **Dễ / Trung bình / Khó** khác viết theo từng sách.
- Tất cả xuất chung vào `seed/questions/bsb_en_quiz.json`, `language: "en"`, tag `BSB`.

## Luật viết

1. Tiếng Anh đơn giản, tự nhiên, hợp người trẻ: câu ngắn, từ thường ngày, không văn cổ. Tên riêng viết đúng như BSB.
2. Mỗi câu hỏi một ý. Câu Dễ tối đa 20 từ, Trung bình/Khó tối đa 24 từ; mỗi phương án tối đa 8 từ.
3. Không hỏi số chương, số câu.
4. **Câu hỏi phải tự đứng được**: nói rõ ai, ở đâu, lúc nào ("When God called Abram…", "In Jesus' parable of the sower…"). Câu trích lời dạy nêu nguồn ("Proverbs says…", "Paul tells the Romans…").
5. Phương án nhiễu cùng loại, độ dài gần nhau. Câu Dễ: nhiễu sai rõ với người biết chuyện. Câu Khó: được phép gần đúng, nhưng chỉ một đáp án đúng theo BSB.
6. Lời giải thích: một câu kể lại, rồi đoạn trích nguyên văn BSB kèm tham chiếu (script tự ghép).
7. Tránh các đoạn nặng nề không hợp trò chơi gia đình.

## Tệp và lệnh

| Tệp | Nội dung |
| --- | --- |
| `<mã>.src.json` | Nguồn do người viết; mã sách là mã eBible viết thường (`gen`, `exo`, `joh`, `phm`…). Mỗi câu: `ref`, `d`, `q`, `a`, `wrong`, `why`, `quote`, và `story` nếu là câu Dễ của một câu chuyện cốt lõi |
| `<mã>_quiz.json` | Kết quả dựng (đừng sửa tay) |
| `bsb_vpl.txt` | Toàn văn BSB, mỗi dòng một câu: `GEN 1:1 In the beginning…` |
| `stories_en.json` | Tên và tham chiếu tiếng Anh của 120 câu chuyện |
| `retired_hashes.txt` | `content_hash` của câu tiếng Anh cũ đã gỡ; `export` không cho chữ cũ quay lại |

```
python content/en/build.py show "gen 3:1-7"     # in đoạn BSB
python content/en/build.py gen exo              # dựng và kiểm từng sách
python content/en/build.py export               # xuất seed/questions/bsb_en_quiz.json
python content/en/build.py retire genesis_quiz_en.json   # ghi hash câu cũ trước khi xóa file
```

## Đưa lên prod (mỗi đợt)

1. `export`; `retire` các file `*_quiz_en.json` của những sách đã viết xong rồi `git rm`.
2. Deploy BE, seed một lần chỉ `bsb_en_quiz.json` với `APP_SEEDING_QUESTIONS_SYNC_STALE=false`.
3. Dump rồi xóa các hàng tiếng Anh cũ của các sách đó (khớp hash vừa retire), xóa cache Redis `questions:*`, kiểm `GET /api/questions?language=en`.
