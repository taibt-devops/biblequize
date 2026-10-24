# forbible theo phong cách Funny Hour

> Chốt ngày 24/10/2026. Áp dụng cho cả hệ forbible: forbible.org (Làng nhỏ, repo `forbible-home`) và Bible Quiz (repo này). Mục quyết định ở `DECISIONS.md` cùng ngày; việc cần làm ở `docs/todo/active/2026-10-24-forbible-funny-hour-style.md`.
> Mockup đã duyệt: [`mockup.html`](mockup.html). Mở trực tiếp bằng trình duyệt. Mockup cần mạng để tải Google Fonts và hình 3D từ jsDelivr.

## Vì sao đổi

- Chủ dự án thấy phong cách Lữ Khách "khó phát triển, khó làm quen, dễ rối". Một bạn trẻ dùng thử nói giao diện "khó hiểu, kiểu con nít".
- Lỗi thật, tái hiện ngày 24/10 trên quiz.forbible.org ở cỡ điện thoại (393×767) và trên forbible.org ở laptop 1280×635:
  - Trang chủ Bible Quiz là một bức tranh 3:2. Mọi thứ đặt theo % của tranh (`components/home/scene/sceneData.ts`). Trên điện thoại chỉ thấy nửa phải của tranh (`SceneStage.tsx`, `CORE_BOX`).
  - Vì vậy các phần có cỡ cố định đè lên biển gỗ:
    - Thẻ chào `PlayerPlate` (px cố định, góc trên trái) đè biển Luyện Tập và che mất bàn tay hướng dẫn người mới; chỉ còn lộ vòng gợn.
    - Bong bóng thoại (`SceneDecor.tsx` `SpeechBubble`) che biển Hành Trình và Phòng Chơi.
    - Chữ trên biển có cỡ tối thiểu 12.5px (`HomeScene.module.css` `.label`), to hơn tấm biển, nên chui dưới icon và ổ khóa.
  - Ở desktop 1280px gần như ổn; lỗi nặng nằm ở màn dưới 768px.
  - forbible.org (`forbible-home`), cùng kiểu đặt theo % tranh: khung "Câu hôm nay" đè biển Bible Quiz, thẻ đăng nhập đè biển Cầu nguyện, biển Tiếng Anh bị cắt ở mép dưới.
- Gốc rễ là cách làm "giao diện là bức tranh". Sửa từng chỗ đè không hết được, vì mỗi cỡ màn cắt tranh một kiểu. Phong cách mới bỏ hẳn cách này.

## Các hướng đã thử và bị loại

Giữ lại trong [`explored/`](explored/) để khỏi đề xuất lại.

| Lần | File | Hướng | Lý do bị loại (lời chủ dự án) |
|---|---|---|---|
| 1 | `mockup-3-huong.html` | A Sáng rõ · B Trẻ trung · C Tĩnh lặng | Chủ dự án chọn "đổi cả hệ sinh thái" và nhờ chọn giúp một style |
| 2 | `ngon-den.html` | "Ngọn Đèn": nền giấy sáng, Lora cho Lời Chúa, tranh làm cửa sổ | "simple quá" |
| 3 | `ngon-den-v2.html` | Ngọn Đèn thêm chất: tranh tràn, ánh đèn sống, 7 ngọn đèn chuỗi ngày | "tốt hơn nữa"; sau đó bỏ ý tưởng ngọn đèn vì "không năng động" |
| 4 | `nang-dong.html` | Game tối, màu rực, Kanit nghiêng, nút 3D bóng | "lòe loẹt", "bố cục không có gì mới mẻ" |
| 5 | `bo-cuc-moi.html` | 3 khung Story / Bento / Bộ bài, màu đen–ngà–đỏ cam | "trẻ trâu" |
| 6 | `../mockup.html` | **Phong cách funny-hour.infaxia.io** | **Chốt** |

Bài học: cái vui phải nằm ở **hình**, còn giao diện thì sạch và trưởng thành. Tránh tranh truyện, tránh "game neon", tránh poster chữ gắt.

## Công thức phong cách

Lấy từ CSS đang chạy của funny-hour.infaxia.io. Cột "chỉnh" là chỗ đổi để đạt độ tương phản WCAG AA.

| Token | Giá trị | Dùng cho | Chỉnh |
|---|---|---|---|
| `--bg` / `--bg-2` | `#F3F5FB` / `#E9EDF7` | nền trang, rãnh thanh tiến độ | |
| `--surface` / `--surface-2` | `#FFFFFF` / `#F6F8FC` | thẻ, nút phụ | |
| `--ink` / `--ink-2` | `#0E1430` / `#3B4566` | chữ chính / chữ thân bài | |
| `--muted` | FH `#7B86A8` | chữ phụ | **`#5D6788`** (FH chỉ đạt 3.6:1 trên nền trắng) |
| `--line` | `#E2E7F2` | viền thẻ, đường kẻ | |
| `--brand` → `--brand-2` | `#FF8A3D` → `#FF5A3C` (dải màu 135°) | **chỉ** nút chính và một từ nhấn trong tiêu đề lớn | chữ cam cỡ nhỏ dùng **`#D13A17`**; chữ trắng trên nút cam ≥ 18,7px đậm |
| `--blue` / `--gold` / `--green` | `#2E6BFF` / `#F5B000` / `#12B886` | điểm xuyết: tiến độ đọc, huy chương, đúng | |
| `--violet` | `#7C5CFF` | màu riêng của Cầu nguyện | thêm mới, FH không có |
| `--dot` | `#0E143017` | lưới chấm 22px trên nền | |
| quầng màu | cam `#FF5A3C29` góc trái, xanh `#2E6BFF24` góc phải | trên đầu trang | |
| bóng | `0 1px 2px #0E14300D, 0 12px 32px -14px #0E143038` (vừa) · `0 2px 4px #0E14300D, 0 32px 64px -24px #0E143061` (lớn) | thẻ / thẻ nổi bật | |

- **Chữ:**
  - **Unbounded** 700–800 cho tiêu đề, logo, số lớn.
  - **Plus Jakarta Sans** 400–800 cho mọi chữ còn lại, kể cả câu Kinh Thánh.
  - Cả hai đủ dấu tiếng Việt (đã kiểm subset `vietnamese` trên Google Fonts).
  - Font hiện tại (Baloo 2, Be Vietnam Pro) sẽ bỏ.
- **Thành phần:**
  - Thẻ trắng bo 20–24px, viền 1px `--line`, bóng mềm.
  - Nút chính: dải cam, bo 14px, cao 52–56px. Nút phụ trắng có viền.
  - "Kicker pill": viên tròn trắng, chấm cam, chữ in hoa giãn 0.12em. Dùng một lần ở đầu màn.
  - Nhãn mục: chữ cam nhỏ in hoa đặt trên tiêu đề Unbounded.
  - "Nhãn dán" nghiêng ±5°, nền xanh đậm hoặc trắng. Chỉ dùng ở khu hình minh họa.
  - Avatar tròn viền trắng, xếp chồng −10px.
- **Hình:**
  - Hình 3D bóng bẩy là chỗ vui của giao diện: icon cho từng nhà và chế độ chơi, cúp, lửa chuỗi ngày, avatar con thú.
  - Mockup dùng **Fluent Emoji 3D** của Microsoft (giấy phép MIT, được dùng trong sản phẩm, kèm file LICENSE).
  - Muốn có linh vật riêng như hai quân cờ của Funny Hour (ví dụ cuốn sách biết cười, chim bồ câu đưa thư) thì vẽ bằng Game Asset Studio. Cần chủ dự án chỉ định key OpenAI.
  - Không bao giờ đặt nút lên tranh hay định vị nút theo % tranh.
- **Màu đáp án C5 giữ nguyên hex** (A `#E8826A`, B `#6AB8E8`, C `#E8C76A`, D `#7AB87A`), dùng làm nền nhạt cho ô chữ cái A/B/C/D trên thẻ đáp án trắng.
- **Chế độ tối:** Funny Hour có nút đổi sáng/tối; bản tối chưa vẽ.

## Phạm vi

- **Bible Quiz** (repo này): đổi toàn bộ màn người dùng. Thứ tự gợi ý: token và font → khung app (thanh trên, thanh dưới) → trang chủ (bỏ hẳn `components/home/scene/`) → Quiz và Kết quả → các màn còn lại → admin chỉ đổi token.
- **forbible.org** (`forbible-home`): trang chủ dạng trang giới thiệu như mockup. Hero "Mỗi ngày / một chút Lời Chúa.", 6 nhà là thẻ có icon 3D, rồi "Câu hôm nay" và "Ba việc nhỏ cho hôm nay". Phải sửa quy tắc "Giao diện theo bộ Lữ Khách" trong `forbible-home/CLAUDE.md` và `docs/quyet-dinh.md` của repo đó.
- **Đọc hằng ngày và Cầu nguyện** (doc.forbible.org): mockup có màn mẫu. Đổi sau Bible Quiz; vẫn không điểm, không xếp hạng.
- **Ngoài phạm vi** cho tới khi chủ dự án nói khác: Manna (game.forbible.org), Tiếng Anh (english.forbible.org), game Lữ Khách.
- **Giữ nguyên:** C1 tên 6 hạng, C2 "Luyện Tập"/"Đấu Hạng", C3, C5, toàn bộ tính năng và dữ liệu. Đây là đổi giao diện, không đổi hành vi.

## Còn phải chốt khi bắt tay làm

1. Giữ Fluent Emoji 3D, hay vẽ linh vật riêng bằng Game Asset Studio (key OpenAI nào)?
2. Có làm bản tối ngay đợt đầu không?
3. Màu thương hiệu: giữ cam như Funny Hour, hay mỗi app một màu chính (Bible Quiz cam, Cầu nguyện tím, Đọc xanh)?
4. Tên token: giữ `--bq-*` và chỉ đổi giá trị (như đợt Lữ Khách), hay tạo bộ token chung cho cả hệ forbible để `forbible-home` và app Đọc cùng dùng?
