# Backend gaps — Home redesign V2

> Tracked while shipping the H1-H8 home redesign on `feat/home-redesign-v2`.
> Each gap is documented with the FE fallback that's in place today plus
> what the desired live behaviour would look like once the BE endpoint
> lands.

## H4 — 6 mode cards live data

| # | Card | Endpoint needed | FE today | FE when wired up |
|---|------|-----------------|----------|------------------|
| 1 | Nhóm Giáo Xứ | `GET /api/groups/me` (or expose `User.groupId`) | No live hint rendered | "Trong {groupName}" / "Bạn chưa có nhóm" |
| 2 | Phòng Chơi   | `GET /api/rooms/public` (already exists) ✅ | Counts the response array length and renders "{N} phòng đang mở" when > 0 | already live |
| 3 | Giải Đấu     | `GET /api/tournaments/upcoming` (or filter on `/api/tournaments`) | No live hint | "Mới sau {N} ngày" / "{N} đang diễn ra" |
| 4 | Chủ Đề Tuần  | `GET /api/quiz/weekly/theme` (already exists) ✅ | Reads `themeName` and renders it | already live |
| 5 | Mystery Mode | n/a — static "+50% XP" | hardcoded | (no change) |
| 6 | Speed Round  | n/a — static "+100% XP" | hardcoded | (no change) |

**Recommended BE work post-launch:**

1. Add `GET /api/groups/me` returning the user's primary group (or
   expose `groupId` on `/api/me`). Single-row read; no new schema.
2. Add `GET /api/tournaments/upcoming?limit=1` returning the next
   `startsAt`-sorted tournament so FE can render "Mới sau {N} ngày".
3. Wire both into `liveHints` in
   `apps/web/src/components/GameModeGrid.tsx`; the rest of the H4 card
   plumbing is already generic over the `liveHint` slot.

## H6 — Bible Journey

`GET /api/me/journey` already returns the OT/NT split via the
`oldCompletedBooks` + `newCompletedBooks` fields on the summary, so
**no backend work needed** for H6. Frontend consumes those values
directly — see `apps/api/src/main/java/com/biblequiz/modules/quiz/service/BookMasteryService.java`.

## H5 — Daily missions sidebar dedup

Both the `Home` H5 section and the `AppLayout` sidebar widget hit the
same `['daily-missions']` query key, so TanStack Query deduplicates
the request. Optional polish post-launch: make the sidebar widget link
to the Home H5 anchor (`#daily-missions`) instead of rendering its own
expanded list.
