# Bộ câu Trung bình và Khó theo từng sách (RVV11)

Bộ này thay dần bộ câu tiếng Việt cũ (viết năm 2026 bằng AI, tên riêng lẫn lộn giữa bản 1925 và bản mới, nhãn độ khó không đúng). Quyết định ngày 09/10/2026: viết lại theo từng sách, xong sách nào thì **tắt** (không xóa) câu cũ của sách đó.

- Câu **Dễ** lấy từ bộ "Dễ cốt lõi" (`content/easy-core/`, 120 câu chuyện).
- Câu **Trung bình** và **Khó** viết ở đây, mỗi sách một file nguồn. Sách nào bộ Dễ cốt lõi có ít câu (Ru-tơ, Ê-xơ-tê, Châm Ngôn, Rô-ma, Phi-líp, Gia-cơ…) thì viết thêm câu **Dễ** ở đây, để tắt bộ cũ không làm cạn câu Dễ của sách đó.
- Bản Kinh Thánh: **Truyền Thống Hiệu Đính 2010 (RVV11)**, giống bộ Dễ. Tên riêng viết đúng như bản này; đoạn trích trùng từng chữ (script kiểm).

## Độ khó

| Mức | Ai trả lời được | Đích tỷ lệ đúng | Ví dụ |
| --- | --- | --- | --- |
| Dễ | người mới đọc Kinh Thánh, đã nghe chuyện | 80–90% | nhân vật chính, sự kiện chính của chuyện quen, câu gốc nổi tiếng |
| Trung bình | người đọc Kinh Thánh đều đặn | 60–70% | chi tiết phụ của chuyện quen (Gia-cốp làm công 7 năm để cưới ai), nhân vật phụ, nơi chốn, ai nói câu nổi tiếng |
| Khó | người đã đọc kỹ cả sách | 40–55% | sự kiện ít được giảng, nhân vật chỉ xuất hiện một lần, lời hứa và lời tiên tri cụ thể, liên hệ giữa các phần của sách |

## Luật viết

1. Mỗi câu hỏi **một ý**. Câu hỏi tối đa 26 chữ, đáp án tối đa 10 chữ.
2. **Không** hỏi số chương, số câu; không mở đầu bằng "Theo … 3:15". Script từ chối câu vi phạm.
3. Con số chỉ hỏi khi nó có nghĩa trong chuyện (969 tuổi của Mê-tu-sê-la, 14 năm làm công). Không hỏi danh sách gia phả.
4. Phương án nhiễu được phép **gần đúng** (nhân vật, nơi chốn khác trong cùng sách) — đó là cái làm câu khó hơn. Nhưng theo bản RVV11 chỉ có **một** đáp án đúng, không có câu đánh đố chữ nghĩa, không "Tất cả đều đúng".
5. Không trùng ý với câu Dễ cốt lõi (script báo khi cùng câu Kinh Thánh, cùng đáp án).
6. Lời giải thích: một câu kể lại, rồi đoạn trích nguyên văn kèm tham chiếu (script tự ghép).
7. Tránh các đoạn nặng nề không hợp trò chơi gia đình (loạn luân, bạo lực tình dục).

## Tệp và lệnh

| Tệp | Nội dung |
| --- | --- |
| `<mã>.src.json` | Nguồn do người viết, mã sách theo trang HTTLVN (`sa` = Sáng Thế Ký, `mat` = Ma-thi-ơ…). Mỗi câu: `ref`, `d` (`medium`/`hard`), `q`, `a`, `wrong`, `why`, `quote` |
| `<mã>_quiz.json` | Kết quả dựng (đừng sửa tay) |
| `build.py` | Kiểm và dựng; dùng chung bộ đọc RVV11 với `content/easy-core/build.py` |
| `retired_hashes.txt` | `content_hash` của các câu cũ đã gỡ khỏi repo. Hàng cũ vẫn nằm trong DB (đã tắt), nên câu mới trùng hash sẽ bị seeder bỏ qua; `export` kiểm cả danh sách nầy |

```
python content/books/build.py show "sa 14:17-24"   # in đoạn Kinh Thánh RVV11
python content/books/build.py sa mat               # dựng và kiểm từng sách
python content/books/build.py export               # xuất seed/questions/rvv11_books_quiz.json
python content/books/build.py retire exodus_quiz.json   # ghi hash câu cũ trước khi xóa file
```

`export` từ chối khi có câu trùng trong bộ, trùng chữ với file seed khác hoặc câu đã nghỉ hưu (seeder sẽ bỏ qua câu đó), hoặc trùng ý với câu Dễ cốt lõi.

## Đưa lên prod (mỗi đợt sách)

1. `export`; `retire` các file seed tiếng Việt cũ của những sách đã thay rồi `git rm` chúng. Giữ bản tiếng Anh.
2. Deploy BE, rồi seed một lần chỉ file `rvv11_books_quiz.json` (`QUESTION_SEEDING_PATTERN`). Giữ `APP_SEEDING_QUESTIONS_SYNC_STALE=false`: chế độ sync-stale **xóa cứng** mọi hàng seed của sách không có trong lần quét, kèm lịch sử trả lời.
3. Sao lưu rồi tắt (`is_active=0`) các hàng có `content_hash` thuộc các hash vừa thêm vào `retired_hashes.txt`. Kiểm lại số câu đang bật theo sách và độ khó.

Đợt 1 (09/10/2026): Sáng Thế Ký + 4 sách Phúc Âm — xem `docs/todo/active/2026-10-09-rvv11-books-wave1.md`.
