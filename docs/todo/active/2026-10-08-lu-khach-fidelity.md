# 2026-10-08 — Lữ Khách: code bám đúng mockup đã duyệt (LKF)

> **Source**: user 2026-10-08 sau LKD-21 — "ko đẹp cần design lại", chọn "Giữ Lữ Khách, làm kỹ", ưu tiên Trang chủ + Quiz/kết quả; "mockup thì đẹp mà code ko giống mockup"; biển chỉ đường cần hiệu ứng cho biết bấm được; phần thẻ dưới Trang chủ gom vào tranh · **Mockup**: canvas "BibleQuiz × Lữ Khách" (claude.ai/artifact/PGPt4eys2jWJiKPjNRu4dQ) · **Branch**: `feat/lu-khach-ui`

Nguyên tắc: render artboard ra PNG, đặt cạnh ảnh app cùng khổ (1280 / 390×844), sửa tới khi khớp. Lệch mockup thì ghi ở đây + báo user.

- LKF-1 Khung app theo mockup: menu Trang chủ · Hành trình · Xếp hạng · Nhóm · Cá nhân; chip chuỗi ngày / năng lượng / điểm mùa; avatar tròn nền lá; chuông viền mực; thanh dưới điện thoại
  - Status: [x] DONE · Lệch mockup: giữ chuông thông báo; thanh dưới điện thoại có thêm "Nhóm" (mockup 4 tab); Phòng Chơi vào từ biển chỉ đường
  - **Spec impact**: [x] None · **Spec strategy**: [x] (c)
- LKF-2 Mockup Trang chủ "cả trang là một cảnh game" — v2 → v3 → v4 "biển gỗ sống" (user góp ý từng vòng, duyệt v4 "v4 ok rồi bạn triển khai code đi")
  - Status: [x] DONE · artboard `HomeSceneV4*` trên canvas
- LKF-3 Code Trang chủ theo v4 (desktop + điện thoại + sáng/hoàng hôn/đêm)
  - Status: [x] DONE · `components/home/scene/*` (sceneData, SignBoards, PlayerPlate, QuestLanterns, SceneDove, SceneDecor, HomeHud, ScenePanel, HomeScene) + `pages/Home.tsx` chỉ còn lấy dữ liệu
  - Ảnh mới: tranh cột trơn sáng/hoàng hôn/đêm + bản nối rộng 3:1 (vẽ nối 2 bên bằng Game Asset Studio, ghép mép mờ dần), 2 tấm biển gỗ rời, bàn tay hướng dẫn, bồ câu bay / bồ câu đậu, icon bản đồ / cúp
  - Quyết định khi code (khác mockup):
    - Theo góp ý giữa chừng "2 khoảng trống 2 bên… để full": desktop full bề ngang, cảnh cao bằng màn hình, hai bên là tranh vẽ nối dài; bảng tên + icon bám góc màn hình
    - Thưởng thử thách hiện +150 XP (giá trị thật `DailyChallengeService`, mockup ghi +50)
    - Làm xong thử thách: bồ câu đậu trên đầu cột kèm thư đã mở (bấm = xem lại); bong bóng quay về "Hôm nay đi lối nào đây?"
    - Điện thoại: bong bóng chỉ còn nút "Mở thư · +150 XP" (dòng chữ đẩy bong bóng đè lên biển "Phòng Chơi" ở máy 360px)
    - Không còn tên người trên Trang chủ: icon Xếp hạng chỉ mang huy hiệu "#hạng" (ẩn khi < 10 người chơi tuần — LBF-11)
    - Câu gốc: cuộn giấy có nút Nghe (Web Speech, chỉ hiện khi trình duyệt hỗ trợ), Học thuộc, và "Ôn N câu đến hạn" khi có câu đến hạn (thay thẻ MemoryDueCard — spec §5.1.1 cập nhật)
    - Lần đầu vào (0 XP, 0 chuỗi, chưa làm thử thách): bàn tay hướng dẫn chạm biển Luyện Tập
  - **Spec impact**: [x] SPEC_USER §5.1.1 (lối vào Học Thuộc trên Home) · **Spec strategy**: [x] (a) update inline
- LKF-4 Quiz theo artboard Quiz / QuizPhone (hàng chip trên tranh, 20 chấm + lữ khách, dầu đèn + combo trong cuộn giấy, phản hồi dưới đáp án)
  - Status: [x] DONE · Lệch mockup: giữ badge "✓ ĐÚNG · BẠN CHỌN" (test khoá, giúp người mù màu) + nhãn độ khó cạnh tham chiếu; quiz > 20 câu dùng thanh thay chấm
  - Sửa kèm: `.group:hover { box-shadow:none !important }` (tắt quầng đáp án + bóng nút khi rê chuột), `:root`/`select` color-scheme dark → light, `quiz.correctAnswerIs` thiếu đáp án (thay bằng `quiz.lk.correctIs`)
  - **Spec impact**: [x] None · **Spec strategy**: [x] (c)
- LKF-5 Màn Kết quả (Quiz + Đấu Hạng)
  - Status: [x] DONE · Quiz: đồng cỏ, 3 sao bật lần lượt, lữ khách mừng/đứng, kết quả trên cuộn giấy, số liệu dạng huy chương viền gỗ, biên lai điểm, thanh độ khó gỗ · Đấu Hạng: sân đấu, 3 trạng thái (thường / lên hạng = khiên hạng mới tỏa sáng / hết năng lượng = lữ khách nghỉ), +XP chữ sticker, thanh hạng, 3 huy chương (câu đúng, điểm mùa, năng lượng = tim)
  - Quyết định: không làm mockup riêng (user uỷ quyền tự quyết) — dùng ngôn ngữ của Quiz/Trang chủ; tên sách trên kết quả đổi sang tiếng Việt qua `useBookName`
- LKF-6 Hành trình theo artboard Journey (trạm sách trên bản đồ, panel chi tiết, 8 vùng, huy hiệu)
  - Status: [x] DONE · `data/journeyRegions.ts` (lối mòn từng vùng, `trailPoints`, huy hiệu §6.5), `JourneyMap` (trạm sách, lữ khách ở sách hiện tại), `JourneyAside` (thẻ sách có vạch 80%, 8 vùng, huy hiệu), trang ghép + "Sổ sách theo vùng" (giữ testid E2E)
  - Lệch artboard: sách chưa học hiện số thứ tự thay vì ổ khóa (API trả NOT_STARTED và app vẫn cho luyện mọi sách — không khóa); thêm "Sổ sách theo vùng" dưới bản đồ (E2E cần thẻ sách + đủ 66 sách để chọn nhanh); mức thuộc hiển thị tối đa 100% (API có sách 150%)
  - **Spec impact**: [x] SPEC_USER §6.3 · **Spec strategy**: [x] (a) update inline

### Giai đoạn tự làm toàn bộ màn hình (user 08/10: "list các màn hình ra… design lại và code theo đến khi xong… điều gì cần tôi quyết định bạn cứ tự quyết định")

Hướng thiết kế chung (tự quyết): **mỗi màn là một địa điểm trong thế giới Lữ Khách** — tranh nền vẽ cùng nét (cố định sau nội dung, phủ lớp kem nhẹ để dễ đọc), tiêu đề trên tấm biển gỗ, nội dung trên tấm giấy da viền mực, số liệu dạng huy chương / chip như HUD Trang chủ, nút vàng ấn được. Tranh địa điểm: phòng đọc (Luyện Tập, Học Thuộc, Ôn tập), sân đấu (Đấu Hạng, Giải đấu), nhà bưu điện + chuồng bồ câu (Thử thách hôm nay), quảng trường làng buổi tối (Phòng chơi), gốc sồi cạnh nhà nguyện (Nhóm), đỉnh đồi có bục (Xếp hạng), lều trại lữ khách (Cá nhân, Thành tích, Ngoại hình), cổng làng lúc bình minh (Đăng nhập, Đăng ký, Onboarding), đồng cỏ (Quiz, Kết quả), bản đồ (Hành trình).

| # | Màn hình | Route | Ghi chú |
|---|---|---|---|
| LKF-5 | Kết quả Quiz, Kết quả Đấu Hạng | (cuối `/quiz`) | lữ khách ăn mừng, sao, huy chương số liệu |
| LKF-6 | Hành trình 66 sách | `/journey` | theo artboard Journey đã duyệt (trạm sách trên bản đồ, bảng chi tiết, 8 vùng, huy hiệu) |
| LKF-7 | Bộ "địa điểm" dùng chung ✅ | — | `components/lk/Place.tsx`: `PlaceBackdrop`, `Plaque` (biển gỗ), `ScrollPanel`, `Medal`, `TrackBar` + 8 tranh địa điểm `place-*.webp` |
| LKF-8 | Luyện Tập, Học Thuộc (3 màn), Ôn tập ✅ | `/practice`, `/practice/memorize*`, `/review` | phòng đọc |
| LKF-9 | Đấu Hạng, Bài kiểm tra cơ bản ✅ | `/ranked`, `/basic-quiz` | sân đấu |
| LKF-10 | Thử thách hôm nay ✅ | `/daily` | lá thư bồ câu mang tới |
| LKF-11 | Xếp hạng ✅ | `/leaderboard` | đỉnh đồi, bục vinh danh |
| LKF-12 | Cá nhân, Thành tích, Ngoại hình ✅ | `/profile`, `/achievements`, `/cosmetics` | lều trại |
| LKF-13 | Phòng chơi, Danh sách phòng, Tạo phòng, Vào phòng ✅ | `/multiplayer`, `/rooms`, `/room/create`, `/room/join` | quảng trường làng |
| LKF-14 | Phòng chờ, Chơi phòng, Màn chủ phòng, Phân tích phòng ✅ | `/room/:id/*` | quảng trường |
| LKF-15 | Nhóm + chi tiết + trang con ✅ | `/groups*` | gốc sồi nhà nguyện |
| LKF-16 | Giải đấu, chi tiết, trận ✅ | `/tournaments*` | sân đấu |
| LKF-17 | Đăng nhập, Đăng ký, Onboarding, Thử quiz, Landing, Câu đố Kinh Thánh ✅ | `/login`, `/register`, `/onboarding*`, `/landing`, `/cau-do-kinh-thanh` | cổng làng |
| LKF-18 | Chủ đề tuần, Bí ẩn, Tốc độ, Bộ đề của tôi, Trợ giúp, Chính sách, Điều khoản ✅ | … | |
| LKF-19 | Admin | `/admin/*` | **giữ dạng công cụ** (đã sang màu Lữ Khách ở LKD-18) — màn làm việc cần gọn, không đưa cảnh game vào |
| LKF-20 | Hồi quy + trang nghiệm thu trước/sau + báo cáo | — | |

### Nhật ký từng màn

- LKF-8 Luyện Tập · Học Thuộc · Ôn tập — phòng đọc
  - Status: [x] DONE
  - Luyện Tập: tranh phòng đọc, biển gỗ "Luyện Tập" (sửa lỗi dính chữ "LuyệnTập"), form trên cuộn giấy; số câu là huy chương bấm chọn, độ khó là chip (`aria-pressed`), thanh trượt gỗ (`lkClass.range`), công tắc giải thích có đèn lồng; thẻ "làm lại câu sai", lượt gần đây có huy chương %
  - Học Thuộc (danh sách / thêm câu / phiên ôn): cùng tranh với lớp kem đậm (`veil="strong"`) vì trang nhiều chữ; thẻ câu viền mực, chấm thuộc vàng; nút vàng / nút lá
  - Ôn tập: biển gỗ + chip điểm & thời gian, thanh lọc dính dưới app bar, mỗi câu là tờ giấy có dải trạng thái (lá = đúng, đỏ = sai), đáp án viền mực có chữ A–D / ✓ / ✗, giải thích dạng ghi chú nét đứt; đánh dấu là ngôi sao vàng (`aria-pressed`, nhãn "Đánh dấu câu này")
  - Quyết định: bỏ chữ in hoa — `review.questionNumber` "CÂU 01" → "Câu 01"; độ khó hiện tiếng Việt qua `practice.easy|medium|hard` (trước là "Easy/Medium/Hard" gõ cứng); test chọn độ khó đọc `aria-pressed` thay vì class `ring-bq-sapphire`
  - **Spec impact**: [x] None · **Spec strategy**: [x] (c)
- LKF-9 Đấu Hạng · Bài Giáo Lý Căn Bản — sân đấu
  - Status: [x] DONE
  - Đấu Hạng: biển gỗ có thanh kiếm; thẻ hạng = khiên hạng hiện tại + 5 sao + khiên hạng kế (xám) làm đích, thanh XP gỗ; thẻ hôm nay = năng lượng tim (thanh đỏ) + 3 huy chương (đèn lồng = chuỗi ngày, cuộn giấy = câu hôm nay, cúp = điểm hôm nay); thẻ "Sẵn sàng leo hạng?" có lữ khách (hết lượt thì lữ khách ngồi nghỉ); nút dính đáy điện thoại = nút vàng có kiếm; thẻ tuần (coverage) sách đã phủ = nền lá
  - Bài Giáo Lý: là "bài thi vào sân đấu" — câu hỏi trên cuộn giấy, đáp án dùng màu biển gỗ như Quiz (A san hô, B trời, C vàng, D lá), chọn = biển ấn xuống + vòng mực + ✓; 10 viên đá tiến độ; đậu = lữ khách nhảy mừng + huy chương kiếm "Đã mở khóa: Đấu Hạng"; trượt = lữ khách ngồi nghỉ + đèn lồng đếm giờ thử lại; ôn bài = tờ giấy có dải trạng thái
  - Quyết định: bỏ xoay ảnh kiếm (ảnh gốc đã chéo, xoay thêm thành cây nến) — cả màn kết quả Đấu Hạng; sửa chữ "Đủ chơi −N câu" → "~N", "Cap N/ngày" → "Tối đa N câu/ngày", "Bắt đầu Ranked ngay" → "Vào Đấu Hạng ngay"
  - Chưa chụp được: kết quả Đấu Hạng trên điện thoại ở máy local — kho câu Đấu Hạng của tài khoản test đã hết (`questions/select` trả rỗng); Bài Giáo Lý chụp bằng API giả lập (DB local không có bộ bible_basics → 404)
  - **Spec impact**: [x] None · **Spec strategy**: [x] (c)
- LKF-10 Thử thách hôm nay — nhà bưu điện, lá thư bồ câu mang tới
  - Status: [x] DONE
  - Thẻ chính là lá thư: viền thư máy bay (sọc đỏ–xanh), dấu bưu điện tròn nét đứt ghi ngày (chỉ khi thư còn niêm), bồ câu ngậm thư nhún nhảy; nút "Mở thư hôm nay" (cùng chữ với Trang chủ); phần thưởng trong huy chương sao
  - Đã làm: thư mở — bảng tổng kết viền mực, 5 viên đá đúng/sai, huy chương điểm lớn, chip % chính xác, hạng toàn cầu, nút Chia sẻ / Tải ảnh
  - Chuỗi = đèn lồng (tắt khi 0 ngày), 7 ngày dạng đèn tròn (vàng = đã làm, nét đứt = hôm nay chưa làm), đóng băng ❄; lịch sử 30 ngày = con tem vàng đậm/nhạt; bảng xếp hạng hôm nay = huy chương vàng/bạc/đồng
  - Khi chơi: tranh bưu điện, biển gỗ, 5 viên đá tiến độ, câu hỏi trên cuộn giấy, tham chiếu tên sách tiếng Việt (`useBookName`, bỏ chữ IN HOA tiếng Anh), thanh phản hồi nền lá / hồng, giải thích trên giấy
  - Quyết định: CTA `daily.ready.cta` "Bắt đầu thử thách" → "Mở thư hôm nay" (EN "Open today's letter"); "· perfect" → "★"; ô "đáp án đúng là" dùng `quiz.lk.correctIs` (có chữ cái đáp án)
  - Ghi nhận (không sửa, ngoài phạm vi giao diện): DB local chỉ có 3 câu/ngày nhưng kết quả ghi "trên 5 câu" và chữ thưởng "+150 XP nếu đúng cả 5" — số 5 đến từ BE/i18n
  - **Spec impact**: [x] None · **Spec strategy**: [x] (c)
- LKF-11 Xếp hạng — đỉnh đồi, bục vinh danh
  - Status: [x] DONE
  - Biển gỗ có cúp, công tắc Tất cả / Hàng tuần đưa lên đầu (bục đổi theo bảng); bục gỗ vàng / bạc / đồng có vân ván, vương miện + hào quang cho hạng 1; hàng danh sách viền mực, số hạng trong huy chương; "Khu vực của bạn"; trạng thái ít dữ liệu = lữ khách + nút vàng; bậc mùa = 6 khiên hạng
  - Góp ý giữa chừng (user 08/10: "huy hiệu của người chơi đang không đẹp… tạo gì đó đẹp đẹp để xịn hơn"): làm `components/lk/PlayerCrest` — ảnh đại diện trong vành đinh tán làm bằng chất liệu của bậc (gỗ sáng, gỗ sẫm, đồng, bạc, vàng, vàng rực có hào quang), vàng có vệt sáng chạy chậm (tắt khi giảm chuyển động), khiên bậc gắn góc dưới phải như huy hiệu game; người chưa có ảnh = chân dung màu pastel theo tên + chữ cái đầu; `TierRibbon` = dải tên bậc màu riêng từng bậc. Dùng cho bục + mọi hàng; sẽ dùng tiếp ở Cá nhân / Nhóm / Phòng
  - Ảnh chụp dùng bảng giả lập (DB local < 10 người → trạng thái ít dữ liệu)
  - **Spec impact**: [x] None · **Spec strategy**: [x] (c)
- LKF-12 Cá nhân · Thành tích · Ngoại hình — lều trại
  - Status: [x] DONE
  - Cá nhân: biển gỗ có lữ khách; thẻ chính = huy hiệu người chơi cỡ lớn (`PlayerCrest` 116px), tên, dải bậc, chip email / ngày tham gia, nút Chia sẻ + Chỉnh sửa; 4 huy chương số liệu (cúp, đèn lồng, cuộn giấy, ✓); thẻ bậc = khiên hiện tại → khiên kế (xám), 5 sao viền mực, thanh gỗ mốc 50/90%; tiêu đề các thẻ còn lại bỏ chữ IN HOA; huy hiệu sưu tập = huy chương viền gỗ (khóa = nét đứt); Prestige nền kem; Vùng nguy hiểm = viền đỏ nét đứt
  - Ngoại hình: mỗi khung avatar xem trước ngay trên huy hiệu của chính người chơi; khung chưa mở vẫn thấy màu (mờ 70%) để biết mình sắp nhận gì; giao diện quiz = huy chương
  - Thành tích: biển gỗ có cúp, thanh tiến trình tổng bằng gỗ, thẻ thành tích = huy chương (đã mở viền mực, khóa nét đứt), cột phải: mới đạt, thống kê mùa (dải bậc), đường bậc với khiên
  - Quyết định:
    - Khung avatar đã đeo tô màu đúng tên khung (Viền Xám, Xanh Nhạt, Xanh Dương, Tím Lửa, Vàng Sao, Vàng Đỏ Hoàng Gia) — `PlayerCrest` có thêm `frame`; không đeo khung thì vành = chất liệu bậc như Bảng xếp hạng
    - Sửa lỗi có sẵn: Thành tích tự giữ bảng bậc riêng với ngưỡng sai (500/1500/4000…) → dùng `data/tiers` (1.000/5.000/15.000…); thiếu chữ các mục lọc (`achievements.catAll`… hiện nguyên khóa) → thêm 9 khóa vi/en; tên icon huy hiệu viết hoa (`FLAME`, `ZAP`) hiện thành chữ → `utils/achievementIcon`
    - Bỏ banner "Sự kiện đặc biệt" (không dẫn đi đâu, không có sự kiện) và nút "Xem tất cả lịch sử" (không làm gì)
  - Ghi nhận (dữ liệu, không sửa): `/api/achievements/my-achievements` trả rỗng trong khi `/api/achievements/me` (Cá nhân) trả 7 huy hiệu; tên huy hiệu ở DB local không dấu; Phân tích chi tiết hiện 6320%
  - **Spec impact**: [x] None · **Spec strategy**: [x] (c)
- LKF-7b Bỏ nhãn chữ IN HOA giãn chữ trên mọi màn người dùng (trước khi làm LKF-13..18)
  - Status: [x] DONE · script một lần (198 chuỗi class / 81 file): chỉ đổi chuỗi class có `uppercase` + cỡ chữ nhỏ (text-[8–11px] / text-xs) → bỏ `uppercase` + `tracking-*`, tăng cỡ một bậc (10px→12px, 11px/xs→12.5px); chữ in hoa cỡ lớn (mã phòng, ô nhập) giữ nguyên; bỏ qua Admin (LKF-19)
  - Test SectionHeader / VerseFooter đổi kỳ vọng từ "có uppercase" sang "không uppercase" (hướng thiết kế mới, strategy b)
  - **Spec impact**: [x] None · **Spec strategy**: [x] (b) cập nhật test theo thiết kế
- LKF-13 Phòng chơi · Tạo phòng · Vào phòng — quảng trường làng
  - Status: [x] DONE (`/rooms` chỉ chuyển hướng về `/multiplayer`)
  - Phòng chơi: biển gỗ có cờ đuôi nheo, chip "N phòng đang sống" + mô tả; thanh nhập mã = 6 viên đá khắc trên nền kem; thẻ Tạo phòng (đèn lồng, nút vàng) + thẻ Đấu Nhanh (thanh kiếm, nút lá — bỏ màu xanh dương riêng); "Phòng đang chờ" là biển gỗ nhỏ, chip lọc viền mực; thẻ phòng viền mực, gần đầy thì có viền màu chế độ; trống = lữ khách ngồi nghỉ + 2 nút
  - Tạo phòng: tranh quảng trường, biển gỗ có đèn lồng, chip vai trò (vàng = Quản trò, lá = cùng chơi), nhãn mục đậm không in hoa, ô nhập focus vàng; ô chế độ giữ màu riêng từng chế độ (để phân biệt)
  - Vào phòng (quét QR): thẻ giữa màn, đèn lồng nhún + mã dạng đá khắc khi đang vào; lỗi = lữ khách lạc đường + nút vàng
  - Quyết định: Đấu Nhanh đổi xanh dương → nút lá (giữ 2 màu chính vàng/lá của bộ nút)
  - **Spec impact**: [x] None · **Spec strategy**: [x] (c)
- LKF-14 Phòng chờ · Chơi phòng · Màn quản trò · Phân tích — quảng trường
  - Status: [x] DONE
  - Phòng chờ: tranh quảng trường sau cột giữa, thanh trên viền mực đậm, nút quay lại / rời phòng dạng viên thuốc; mã phòng = 6 viên đá khắc; QR có khung mực; "Người chơi" là biển gỗ nhỏ; thẻ người chơi = huy hiệu người chơi (vành theo bậc, không gắn khiên), chip trạng thái vàng/lá; ô mời = nét đứt + nút vàng; ô trống = đèn lồng tắt; luật chơi trên nền kem có cuộn giấy; nút Bắt đầu / Sẵn sàng là nút vàng / lá, chữ thường ("Bắt đầu trận đấu", "Đang chờ người chơi…" thay "BẮT ĐẦU TRẬN ĐẤU", "ĐANG CHỜ...")
  - Chơi phòng / quản trò / phân tích / chế độ tuần tự: thêm tranh quảng trường + viền mực thanh trên; phân tích có biển gỗ tên phòng
  - Sửa lỗi có sẵn: màn kết thúc trận (`RoomOverlays`) hiện tiếng Việt KHÔNG DẤU ("KET QUA CUOI", "Ban da bi loai!", "Ve Phong Cho"…) → viết lại có dấu và chuyển sang khóa `room.overlay.*` (vi + en); test cập nhật theo
  - `PlayerCrest` tự quay về chân dung chữ cái khi ảnh đại diện lỗi 404
  - Không chụp được màn chơi / quản trò / phân tích ở máy local (cần ≥ 2 người chơi thật) — chỉ đổi khung + màu, giữ nguyên bố cục; dựa vào test (86 test phòng pass)
  - **Spec impact**: [x] None · **Spec strategy**: [x] (b) test RoomOverlays theo chữ có dấu
- LKF-15 Nhóm · chi tiết nhóm · trang con — gốc sồi cạnh nhà nguyện
  - Status: [x] DONE
  - Nhóm: tranh nhà nguyện, biển gỗ "Nhóm Hội Thánh", thanh nhập mã nền kem (ô nhập chữ đậm giãn), "Nhóm của bạn" / "Khám phá nhóm công khai" là biển gỗ nhỏ, thẻ nhóm viền mực + nút lá "Tham gia", trống = lữ khách + nút vàng/lá, nút nổi tạo nhóm tròn vàng
  - Chi tiết nhóm: tranh nhà nguyện, mã mời dạng viên thuốc kem chữ đậm (bỏ font Orbitron nghiêng), tab dạng nút tròn trong khung mực (`aria-pressed`)
  - Trang con (bộ câu hỏi, chi tiết bộ, lịch quiz tạo/xem/chơi, hành trình nhóm tạo/xem, phân tích nhóm): công cụ của trưởng nhóm → giữ bố cục, chỉ thêm tranh nhà nguyện (bỏ nền giấy che tranh); trình soạn bộ câu hỏi giữ nền riêng
  - Quyết định: bỏ dòng "Sprint 6" (tên mốc nội bộ hiện cho người dùng ở "Hoạt động nhóm — sắp ra mắt"); bỏ nút "Xem tất cả" nhóm công khai (không có hành động)
  - **Spec impact**: [x] None · **Spec strategy**: [x] (c)
- LKF-16 Giải đấu · chi tiết · trận — sân đấu
  - Status: [x] DONE
  - Danh sách: tranh sân đấu, chip "Sự kiện đặc biệt", biển gỗ có cờ đuôi nheo, mô tả trên dải kem; thẻ giải viền mực nổi lên khi rê; chip trạng thái vàng (đăng ký) / lá (đang đấu) / giấy (đã xong); trống = lữ khách nghỉ, lỗi = lữ khách lạc + nút vàng
  - Chi tiết giải / trận: thêm tranh sân đấu (bỏ nền gradient che tranh), bố cục giữ nguyên
  - Không chụp được: `/api/tournaments` trả 500 ở máy local
  - Phát hiện: 17 file `pages/*.module.css` (gồm bảng màu neon của giao diện cũ) không còn được import ở đâu → xóa ở commit dọn dẹp riêng
  - **Spec impact**: [x] None · **Spec strategy**: [x] (c)
- LKF-17 Đăng nhập · Đăng ký · Onboarding · Thử quiz · Landing · Câu đố Kinh Thánh — cổng làng lúc bình minh
  - Status: [x] DONE
  - Đăng nhập / Đăng ký: tranh cổng làng phủ cả màn; trái = lữ khách (Đăng ký: lữ khách nhảy mừng) + lời chào trên tấm giấy; phải = thẻ viền mực, logo đèn lồng + "BibleQuiz" (bỏ "B I B L E  Q U I Z"), ô nhập nền giấy viền mực, nút vàng, "Chơi thử" = viên thuốc lá có thanh kiếm
  - Landing: ảnh chính = tranh cổng làng + lữ khách đứng ở cổng, lời giới thiệu trên tấm giấy (không tô màu một cụm chữ); ảnh nhóm = tranh nhà nguyện; nút Google cuối trang = nút trắng có logo vẽ sẵn
  - Onboarding: tranh cổng làng, biển gỗ "Chào mừng / Welcome", thẻ ngôn ngữ viền mực có huy chương (cờ Việt Nam vẽ lại bằng SVG trong máy, tiếng Anh = quả địa cầu), slide 1–3 = tranh cổng làng + lữ khách / quảng trường / bản đồ 66 sách, chấm tiến độ = viên đá, nút vàng
  - Thử quiz: câu hỏi trên cuộn giấy, đáp án = biển gỗ 4 màu như Quiz, đúng = vòng lá, sai = vòng đỏ
  - Câu đố Kinh Thánh (trang SEO): thêm tranh cổng làng, giữ nội dung + bố cục
  - Sửa lỗi có sẵn: ảnh lấy từ host ngoài của công cụ thiết kế (`lh3.googleusercontent.com/aida-public`) ở Landing (ảnh nhóm, logo Google) và Onboarding (cờ Việt Nam hiện chữ rác) → ảnh trong máy; 2 hằng ảnh placeholder không dùng ở GroupDetail bị xóa; chân trang ghi "The Sacred Modernist Path" / "The Sacred Path" (tên bản thiết kế cũ) → "© 2026 BibleQuiz"; khẩu hiệu Landing viết HOA → chữ thường; "Step Indicator" (giá trị tạm tiếng Anh) → "Làm quen" / "Getting started"
  - Font: bỏ Orbitron (font khoa học viễn tưởng của giao diện cũ) — 6 chỗ người dùng thấy (mã nhóm, mã phòng, điểm Landing, đồng hồ trận) đổi sang Baloo số thẳng hàng; `font-mono` = monospace hệ thống (Admin giữ cho ID); gỡ Orbitron khỏi link Google Fonts
  - Test: Landing kiểm "tranh cổng làng + không tải ảnh ngoài" thay cho ảnh minh họa cũ (đã xóa `HeroIllustration`); Onboarding tìm nút bằng test id (bỏ mũi tên); chân trang 2026
  - **Spec impact**: [x] None · **Spec strategy**: [x] (b) cập nhật test theo thiết kế
- LKF-18 Chủ đề tuần · Bí ẩn · Tốc độ · Bộ đề của tôi · Trợ giúp · Chính sách · Điều khoản
  - Status: [x] DONE
  - Chủ đề tuần (phòng đọc, cuộn giấy), Chế độ Bí ẩn (quảng trường buổi tối, đèn lồng), Vòng Tốc độ (sân đấu, thanh kiếm): biển gỗ + dải phụ đề, thẻ viền mực, số liệu = huy chương, nút vàng; "???" của Bí ẩn trên dải giấy nét đứt; sách trong chủ đề tuần hiện tên tiếng Việt (`useBookName`); chờ tải = đèn lồng
  - Bộ câu hỏi của tôi, Trợ giúp, Chính sách, Điều khoản: tranh phòng đọc, biển gỗ tiêu đề; nhóm câu hỏi Trợ giúp = chip vàng; nút quay lại + ngày cập nhật dạng viên thuốc nền trắng (đọc được trên tranh)
  - Quyết định: tiêu đề "Mystery Mode" / "Speed Round" (tiếng Anh gõ cứng) → `gameModes.mystery` / `gameModes.speed` ("Chế Độ Bí Ẩn" / "Vòng Tốc Độ"); test cập nhật theo; test chờ tải của Chủ đề tuần tìm theo test id thay vì vòng quay
  - **Spec impact**: [x] None · **Spec strategy**: [x] (b)
