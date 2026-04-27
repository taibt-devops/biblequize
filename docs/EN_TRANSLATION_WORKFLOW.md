# EN Translation Workflow — Question Seed Files

> **Status**: Implemented (GA-5 task complete). 66/66 books have VI + EN files.
> **Last updated**: 2026-04-27

## Mục đích

App phục vụ audience đa quốc gia (Tin Lành toàn cầu). Mỗi câu hỏi tồn
tại ở **2 file song song**:

- `{book}_quiz.json` — gốc tiếng Việt (RVV11 terminology)
- `{book}_quiz_en.json` — bản dịch tiếng Anh (ESV terminology)

Workflow này dùng AI (Gemini 2.0 Flash) để dịch tự động khi tác giả
thêm câu hỏi VI mới — tránh phải viết tay từng cặp.

## Khi nào chạy

| Tình huống | Hành động |
|---|---|
| Thêm sách mới (VI có sẵn, EN chưa có) | `--book {slug}` |
| Append câu mới vào sách hiện có | Manual: tự dịch theo cùng pattern hoặc rerun `--force` cho file đó |
| Bulk dịch toàn bộ sách chưa có EN | `--all` (idempotent: skip existing) |
| Sửa wording trong file EN sẵn có | Manual edit — KHÔNG rerun script |

> **Lưu ý**: Append-mode (chỉ dịch câu mới) chưa hỗ trợ tự động. Cách
> tạm: backup EN file → xóa → rerun → restore phần unchanged hoặc
> dịch tay câu mới và append vào EN file.

## Setup

### 1. API key

```bash
# Lấy free key tại https://aistudio.google.com/app/apikey (15 RPM free tier đủ dùng)
export GEMINI_API_KEY=AIzaSy...
```

Hoặc đặt vào `.env` ở repo root (đã được `.gitignore`):

```
GEMINI_API_KEY=AIzaSy...
```

### 2. Python dependencies

Script chỉ dùng stdlib (`urllib`, `json`, `argparse`) — không cần
`pip install` gì.

```bash
python3 --version  # ≥ 3.8 OK
```

## Cách dùng

### Dịch 1 sách

```bash
python3 scripts/translate_to_en.py --book genesis
```

Output:
- Đọc `apps/api/src/main/resources/seed/questions/genesis_quiz.json`
- Dịch theo batch 5 câu/call (5s sleep giữa các batch để stay dưới 15 RPM)
- Ghi `genesis_quiz_en.json` cùng thư mục

### Dịch tất cả sách chưa có EN

```bash
python3 scripts/translate_to_en.py --all
```

Idempotent: skip mọi file `_en.json` đã tồn tại. Chỉ dịch những file
chưa có. Dùng `--force` nếu muốn ghi đè.

### Tham số

| Flag | Mặc định | Mô tả |
|---|---|---|
| `--book {slug}` | — | Chỉ dịch 1 sách. VD `genesis`, `1corinthians` |
| `--all` | — | Dịch tất cả VI files chưa có EN pair |
| `--force` | false | Ghi đè file EN đã có |
| `--batch N` | 5 | Số câu/API call. Tăng lên 10 nếu rate limit dư |

## Strategy & Terminology

Script dùng prompt template với glossary cố định để đảm bảo terminology
nhất quán giữa các sách (xem `PROMPT_TEMPLATE` trong [scripts/translate_to_en.py](../scripts/translate_to_en.py)):

| Vietnamese (RVV11) | English (ESV) |
|---|---|
| Đức Chúa Trời / Đức Giê-hô-va | God / the LORD |
| Chúa Giê-su / Jêsus | Jesus |
| Đấng Cứu Thế / Đấng Christ | Christ / the Messiah |
| Sứ đồ | Apostle |
| Môn đồ | Disciple |
| Kinh Thánh | the Bible / Scripture |
| Thánh Linh / Thần Linh | the Holy Spirit |
| Thiên sứ | angel |
| Cựu Ước / Tân Ước | Old Testament / New Testament |
| Sáng Thế Ký | Genesis |
| Sáng tạo | Creation |

### Rules được enforce trong prompt

1. Dịch **content**, **options**, **explanation**, **tags**.
2. **GIỮ NGUYÊN** `correctAnswer` (index, không reorder options).
3. **GIỮ NGUYÊN** `book` / `chapter` / `verseStart` / `verseEnd` /
   `difficulty` / `type`.
4. Set `language: "en"`.
5. Output JSON valid only — không markdown, không prose.

### Anti-pattern (script không cho phép)

- ❌ Reorder options (sẽ làm `correctAnswer` index sai)
- ❌ Đổi `book` / `chapter` (sẽ làm seeder match sai DB row)
- ❌ Tạo câu mới hoặc xóa câu (1:1 mapping bắt buộc)

## Quality verification post-translation

Sau khi script chạy xong, verify:

```bash
# 1. Schema valid + count match
python3 -c "
import json
vi = json.load(open('apps/api/src/main/resources/seed/questions/genesis_quiz.json', encoding='utf-8'))
en = json.load(open('apps/api/src/main/resources/seed/questions/genesis_quiz_en.json', encoding='utf-8'))
assert len(vi) == len(en), f'count mismatch: VI={len(vi)} EN={len(en)}'
for i, (v, e) in enumerate(zip(vi, en)):
    for k in ['chapter','verseStart','difficulty','type','correctAnswer']:
        assert v[k] == e[k], f'Q{i+1} {k}: {v[k]} vs {e[k]}'
    assert e.get('language') == 'en'
    assert len(e['options']) == 4
print(f'OK: {len(vi)} questions, schema match VI/EN')
"
```

```bash
# 2. Restart api → seeder log inserted=N (= số câu mới)
docker compose up -d --build api
docker logs biblequiz-api 2>&1 | grep "genesis_quiz_en"
# Expected: "genesis_quiz_en.json → inserted=N, skipped=0, invalid=0"
```

```bash
# 3. Spot-check trong admin panel
# Vào /admin/questions → filter language=en → đọc 5-10 câu xem dịch tự nhiên không
```

## Troubleshooting

### Rate limit (429)

Script auto-retry với exponential backoff (30s/60s/120s/240s, max 5
attempts). Nếu vẫn fail, giảm `--batch` xuống 3 hoặc đợi 1 phút rồi
chạy lại — script idempotent, sẽ resume từ file chưa dịch.

### Partial output (script crash giữa chừng)

Script chỉ ghi file EN khi **TẤT CẢ** batches của 1 sách thành công.
Nếu fail giữa chừng, file EN không được tạo → rerun an toàn.

### Quality sai (dịch không chính xác)

Cách fix:
1. Mở file `_en.json` ra sửa thủ công câu sai
2. KHÔNG rerun `--force` (sẽ ghi đè manual fix)
3. Để track changes, commit message ghi rõ "manual fix EN translation Q#"

### Glossary không khớp (ví dụ "Sáng Thế Ký" → "Book of Genesis" thay vì "Genesis")

Edit `PROMPT_TEMPLATE` trong [scripts/translate_to_en.py](../scripts/translate_to_en.py),
thêm rule cụ thể, rerun với `--force` cho sách đó. Hoặc sửa thủ công nếu chỉ
1-2 câu.

## Priority books (V1 EN coverage — đã hoàn tất)

5 sách core đã có EN đầy đủ:

| Book | VI count | EN count |
|---|---|---|
| Genesis | 150 | 150 |
| Matthew | 160 | 160 |
| John | 160 | 160 |
| Psalms | 180 | 180 |
| Romans | 130 | 130 |

**Toàn bộ 66/66 sách trong canon Protestant đã có EN pair** (verified
2026-04-27 via `ls *_quiz_en.json | wc -l = 66`).

## Cost estimate (Gemini Free tier)

- Free tier: 15 requests/minute, 1500/day, 32K tokens/min
- Mỗi batch (5 câu) ~3-4K tokens input + ~2-3K output → 1 RPM
- 1 sách 100 câu = 20 batches × 5s sleep = ~2 phút
- 66 sách × ~120 câu trung bình = ~26 phút bulk run
- **Free tier đủ** cho toàn bộ pool — không cần paid

## References

- Script: [scripts/translate_to_en.py](../scripts/translate_to_en.py)
- Schema: [apps/api/src/main/java/com/biblequiz/infrastructure/seed/question/SeedQuestion.java](../apps/api/src/main/java/com/biblequiz/infrastructure/seed/question/SeedQuestion.java)
- Seeder: [QuestionSeeder.java](../apps/api/src/main/java/com/biblequiz/infrastructure/seed/question/QuestionSeeder.java)
- TODO entry: [TODO.md](../TODO.md) → `Task GA-5: EN translation workflow`
- Decision context: [DECISIONS.md](../DECISIONS.md) → "Target audience expanded: Tin Lành toàn cầu"
