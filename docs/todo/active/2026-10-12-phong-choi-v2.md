# 2026-10-12 — Phòng chơi v2: sửa lỗi, thiết kế lại 4 mode, tính năng mới

> **Source**: review game design 12/10 + user: "làm hết luôn đi, làm cho đến khi hoàn thiện, cứ làm theo ý bạn ko cần đợi ý kiến của tôi" · **Scope**: apps/api modules/room + quiz missions, apps/web room pages · Design: `docs/MULTIPLAYER/2026-10-12-phong-choi-v2-design.md` · Plans: `docs/plans/2026-10-12-phong-choi-v2-dot-{1,2,3}.md`

### Tasks — Đợt 1 (sửa lỗi)
- PCV-1 Máy chủ đo giờ + đóng vòng — Status: [x] DONE
- PCV-2 Không lộ đáp án + ROUND_END đầy đủ + nhịp nghỉ 5/7 s — Status: [x] DONE
- PCV-3 Giao diện màn chơi theo payload mới — Status: [x] DONE
- PCV-4 Bộ luồng riêng cho trận + bắt đầu nguyên tử — Status: [x] DONE
- PCV-5 Luật số người theo mode (BE + sảnh chờ + tạo phòng) — Status: [x] DONE
- PCV-6 Hạng cuối mọi mode + nhiệm vụ phòng + MVP thật — Status: [x] DONE
- PCV-7 Nhiệm vụ ngày: đếm đủ 13 loại, thay loại không có lối vào, thưởng 50 XP thật — Status: [x] DONE
- PCV-8 Đấu nhanh không dùng AI, bỏ giới hạn 3 trận/ngày cho kho câu — Status: [x] DONE
- PCV-9 Tên/icon/mô tả mode thống nhất + chọn vai trò chủ phòng — Status: [x] DONE
- PCV-10 Spec + DECISIONS + deploy đợt 1 — Status: [~] IN PROGRESS (docs xong, chờ deploy)

### Tasks — Đợt 2 (thiết kế lại mode)
- PCV-11 Đua tốc độ: thưởng chuỗi, câu chốt ×2, phân hạng, bảng dẫn đầu mỗi 3 câu — Status: [x] DONE
- PCV-12 Sinh tồn: 2 mạng, độ khó tăng dần, vùng nguy hiểm, câu quyết định — Status: [x] DONE
- PCV-13 Sinh tồn: bóng + hồi sinh — Status: [x] DONE
- PCV-14 Đội đấu đội: điểm trung bình, thưởng cả đội, xáo đội, tên đội — Status: [ ] TODO
- PCV-15 Đấu vương: xoay vòng, xếp hạng theo trận thắng, kết thúc theo ngai — Status: [ ] TODO
- PCV-16 Đấu vương: khán giả đoán — Status: [ ] TODO
- PCV-17 Chơi lại với nhóm này — Status: [ ] TODO
- PCV-18 Đổi cách chơi trong sảnh chờ — Status: [ ] TODO
- PCV-19 Spec + DECISIONS + deploy đợt 2 — Status: [ ] TODO

### Tasks — Đợt 3 (tính năng mới)
- PCV-20 Người máy (dữ liệu + thêm/bớt trong sảnh) — Status: [ ] TODO
- PCV-21 Người máy trả lời trong trận + loại trừ khỏi chủ phòng/thống kê — Status: [ ] TODO
- PCV-22 Hội ý cho Đội đấu đội (phiếu đội + chat đội) — Status: [ ] TODO
- PCV-23 Thách đấu bạn bè hoàn chỉnh — Status: [ ] TODO
- PCV-24 Ôn phần đọc hôm nay (phạm vi theo đoạn + liên kết từ doc.forbible.org) — Status: [ ] TODO
- PCV-25 Spec + DECISIONS + deploy đợt 3 + review toàn nhánh — Status: [ ] TODO

Mỗi task: **Spec impact** SPEC_MULTIPLAYER / SPEC_USER §13 theo design · **Spec strategy** (a) update inline · quyết định mới vào DECISIONS 2026-10-12.
