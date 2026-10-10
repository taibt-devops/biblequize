# Bộ câu "Dễ cốt lõi"

Đây là bộ câu Dễ viết mới cho Bible Quiz. Nó dùng cho:

- Luyện tập **theo câu chuyện** (mỗi phiên chơi hết một chuyện) và Luyện tập ở độ khó Dễ;
- Đấu Hạng bậc 1–2;
- Vòng Tốc độ;
- những lần chơi đầu tiên của người mới.

Mục tiêu: người đi nhóm bình thường trả lời đúng **từ 80% trở lên**.

## Vì sao viết mới (08/10/2026)

Số liệu chơi thật trên prod: câu gắn nhãn Dễ chỉ có 50% lượt trả lời đúng, ngang câu Khó (50%) và thấp hơn câu Trung bình (66%). Có hai nguyên nhân:

- Câu lệnh sinh câu hỏi cũ định nghĩa độ khó **chỉ bằng phương án nhiễu**. Nó không xét chi tiết được hỏi có phổ biến hay không.
- Kết quả là sách nào cũng có 30–65% câu Dễ. Trong số câu Dễ:
  - 61% thuộc các sách ít người đọc;
  - 46% hỏi chi tiết theo chương/câu cụ thể.

## Bản Kinh Thánh

Câu hỏi và đoạn trích theo **Kinh Thánh Bản Truyền Thống Hiệu Đính 2010 (RVV11)**:

- tên riêng viết như bản này: Đức Chúa Jêsus, Ai Cập, Đức Giê-hô-va;
- đoạn trích phải trùng từng chữ với bản này;
- chủ dự án lo phần xin phép nhà giữ bản quyền (quyết định 08/10/2026);
- văn bản đối chiếu lấy từ kinhthanh.httlvn.org và chỉ lưu tạm trong `.cache/` (không commit).

## Luật viết câu Dễ

1. Chỉ hỏi về câu chuyện trong danh sách cốt lõi ([stories.md](stories.md)): những chuyện người đi nhóm hay đi Trường Chúa nhật đều từng nghe.
2. Mỗi câu hỏi đúng **một ý**: ai, cái gì, ở đâu, làm gì. Câu hỏi tối đa 20 chữ (nên dưới 15), đáp án tối đa 9 chữ.
3. Không bắt nhớ số chương, số câu, không mở đầu bằng "Theo … 12:4". Script sẽ từ chối câu vi phạm.
4. Chỉ hỏi con số khi con số đó ai cũng biết: 7 ngày, 40 ngày đêm, 12 môn đồ, 5 bánh 2 cá, 3 ngày.
5. Có 4 phương án cùng loại, độ dài gần nhau. Phương án nhiễu phải sai rõ với người biết chuyện:
   - không gài bẫy bằng chi tiết gần đúng, ví dụ con quạ so với bồ câu, "ngày thứ nhất trong tuần" so với "ngày thứ ba";
   - không dùng "Tất cả đều đúng".
6. Lời giải thích gồm hai phần: một câu kể lại chuyện, rồi một đoạn trích nguyên văn kèm tham chiếu. Script tự ghép, ví dụ:
   `Kinh Thánh mở đầu bằng việc Đức Chúa Trời sáng tạo muôn vật. “Ban đầu, Đức Chúa Trời sáng tạo trời và đất.” (Sáng Thế Ký 1:1)`
7. Mỗi câu chuyện có khoảng 10 câu, trải đều các chi tiết chính của chuyện.
8. **Câu hỏi phải tự đứng được.** Người chơi thấy từng câu riêng lẻ, không thấy tên chuyện và không có câu trước đó. Câu hỏi phải nói đủ ai, ở đâu, lúc nào để người biết chuyện nhận ra ngay:
   - sai: "Trở về thành, các môn đồ cùng nhau làm gì?";
   - đúng: "Sau khi Chúa Jêsus thăng thiên, các môn đồ về Giê-ru-sa-lem cùng nhau làm gì?".
   Không mở đầu bằng "ông", "họ", "vua", "dân" khi chưa nói là ai.

## Tệp và lệnh

| Tệp | Nội dung |
| --- | --- |
| `pilot.src.json`, `b02.src.json`, … | Nguồn do người viết và sửa, mỗi đợt khoảng 10 câu chuyện. Mỗi câu gồm: `story`, `ref` (mã sách theo trang HTTLVN, ví dụ `sa 1:1`), `q`, `a`, `wrong` (3 phương án nhiễu), `why`, `quote` |
| `build.py` | Đối chiếu trích dẫn với RVV11, kiểm tra luật, xếp đáp án đúng rải đều A–D, rồi xuất định dạng câu hỏi gốc |
| `pilot_quiz.json`, `b02_quiz.json`, … | Kết quả dựng (đừng sửa tay) |
| `stories.md` | Danh sách 120 câu chuyện cốt lõi, dấu ✓ là chuyện đã viết |
| `apps/api/src/main/resources/seed/questions/easy_core_quiz.json` | Bộ câu app nạp: mọi đợt gộp lại, mỗi câu thêm `story` (id chuyện). Do `export` sinh ra |
| `apps/api/src/main/resources/seed/stories/stories.json` | Danh mục 120 chuyện (`id`, `order`, `title`, `ref`, `testament`) cho màn Luyện Tập. Do `export` sinh ra |

```
python content/easy-core/build.py pilot b02        # dựng và kiểm tra từng đợt
python content/easy-core/build.py show "sa 3:1-7"  # in đoạn Kinh Thánh RVV11 để viết câu hỏi
python content/easy-core/build.py mark             # đánh dấu ✓ các chuyện đã viết trong stories.md
python content/easy-core/build.py export           # đưa cả bộ vào app (2 file seed ở trên)
```

`export` từ chối xuất nếu: hai chuyện trùng id, câu nào không thuộc chuyện nào, chuyện nào không có câu, hai câu trùng nhau trong bộ, hoặc câu trùng `content_hash` với file seed khác (seeder sẽ bỏ qua câu đó nên nó không có chuyện).

Id chuyện là tên chuyện bỏ dấu (`Nô-ê và trận lụt` → `no-e-va-tran-lut`). Đổi tên chuyện thì id đổi theo: chạy lại `export`, seeder cập nhật cột `story` tại chỗ (id câu hỏi không phụ thuộc chuyện).

Bản thử giữ cách xáo đáp án cũ vì kết quả chơi thử đã ghi theo thứ tự đó; các đợt sau rải đáp án đúng đều qua A–D.

Các file `*_quiz.json` của từng đợt cố ý nằm **ngoài** `apps/api/src/main/resources/seed/questions/`: app chỉ nạp file `export` sinh ra, khi QuestionSeeder chạy lúc khởi động.

## Quy trình

1. **Bản thử** (xong 08/10): 100 câu cho 10 câu chuyện. Chủ dự án chơi thử, thấy ổn.
2. Viết đủ 120 câu chuyện (xong 09/10: 1.095 câu) và đưa vào Luyện Tập theo câu chuyện.
3. Chấm lại nhãn của các câu Dễ cũ theo cùng thước đo. Câu nào dễ thật thì giữ, còn lại chuyển sang Trung bình hoặc Khó.
4. Nạp lên prod. Mục tiêu: câu Dễ đúng từ 80% trở lên. Đo lại sau 2–4 tuần.
