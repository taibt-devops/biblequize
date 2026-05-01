# Backend gaps — Home redesign V2

> Tracked while shipping the H1-H8 home redesign on `feat/home-redesign-v2`.
> Each gap is documented with the FE fallback that's in place today plus
> what the desired live behaviour would look like once the BE endpoint
> lands.

## ✅ H4 — 6 mode cards live data — ALL WIRED 2026-05-01

All 4 dynamic-data BE endpoints are now implemented + consumed by FE.
Mystery + Speed remain static (XP multipliers). Closes HM-P1-1 in
`docs/BUG_REPORT_HOME_POST_IMPL.md`.

| # | Card | Endpoint | FE rendering |
|---|------|----------|--------------|
| 1 | Nhóm Giáo Xứ | `GET /api/groups/me` ✅ shipped 2026-05-01 | "Trong {groupName}" if `hasGroup=true`, else "Bạn chưa có nhóm" |
| 2 | Phòng Chơi   | `GET /api/rooms/public` ✅ | "{N} phòng đang mở" when count > 0 |
| 3 | Giải Đấu     | `GET /api/tournaments/upcoming` ✅ shipped 2026-05-01 | "{count} đấu trường đang mở" when LOBBY tournaments > 0 |
| 4 | Chủ Đề Tuần  | `GET /api/quiz/weekly/theme` ✅ | weekly `themeName` |
| 5 | Mystery Mode | n/a — static "+50% XP" | hardcoded |
| 6 | Speed Round  | n/a — static "+100% XP" | hardcoded |

**`/api/groups/me` semantics:**
- Auth required.
- Returns `{ hasGroup: false }` when the user has no GroupMember rows.
- Returns `{ hasGroup: true, groupId, groupName, memberCount, role }` for the
  user's primary group (first by joined-at order if multiple memberships).
- Lives in `ChurchGroupService.getMyGroup(userId)` →
  `ChurchGroupController.GET /me`.

**`/api/tournaments/upcoming` semantics:**
- Auth required.
- "Upcoming" maps to `Tournament.Status.LOBBY` (open for joining) since the
  entity has no scheduled `startsAt` field.
- Returns `{ count: int, next: { id, name, bracketSize, createdAt } | null }`.
  `next` is the most-recently-created LOBBY tournament so the user lands on
  the freshest one when they tap through.
- Lives in `TournamentService.getUpcomingTournaments()` →
  `TournamentController.GET /upcoming`.

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
