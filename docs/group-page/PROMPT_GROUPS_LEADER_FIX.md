# PROMPT: Fix Groups Leader Dashboard — 11 Issues

> **Source:** Visual review screenshot 2026-04-30 — Groups Dashboard Leader view (post-implementation)
> **Scope:** 4 P0 critical bugs + 7 P1 UX issues, defer P2/P3 sang sprint sau
> **Effort:** 3-4h, 11 commits
> **Branch:** `fix/groups-leader-issues`
> **Pre-requirement:** ✅ `feat/groups-dashboard` đã merged

---

## ⚠️ Verify trước khi fix

Mỗi task có **verification step** — chạy trước khi viết code để confirm vấn đề thực tế tồn tại. Nếu issue đã được fix khác → skip task đó.

```bash
# Setup
git status
git checkout -b fix/groups-leader-issues
cd apps/web && npx vitest run | tail -5    # baseline test count
```

---

## 🔴 P0 — Critical Bugs (4 tasks, ~2h)

### Task 1 — Activity chart không render (P0, 45min)

**Issue:** Section "Phân tích nhóm" có labels trục X (T3 T4 T5 T6 T7 CN hôm nay) **nhưng KHÔNG có chart bars**.

**Verify:**
```bash
# Tìm chart component
grep -rn "ActivityChart\|chart.*activity\|recharts\|chart.js" apps/web/src/components/groups --include="*.tsx" --include="*.ts" | head -10

# Test API analytics endpoint
curl -H "Authorization: Bearer <token>" \
  "http://localhost:8080/api/groups/{groupId}/analytics?period=7d" | jq

# Inspect chart in browser DevTools — element exists nhưng height=0?
```

**Confirm vấn đề:** Mở DevTools → inspect chart container.
- Nếu element trống → component không render bars
- Nếu element có nhưng height=0 → CSS/data issue
- Nếu API trả `[]` empty → cần empty state

**Fix:**

```tsx
// apps/web/src/components/groups/leader/ActivityChart.tsx
interface ActivityDay {
  date: string;          // ISO date
  label: string;         // "T2", "T3", ..., "CN", "hôm nay"
  count: number;         // số người học
  isToday: boolean;
}

function ActivityChart({ data }: { data: ActivityDay[] }) {
  // Empty state
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-on-surface/40 text-sm">
        Chưa có dữ liệu hoạt động
      </div>
    );
  }

  // All zero state — group mới, chưa ai học
  const allZero = data.every(d => d.count === 0);
  if (allZero) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-7 gap-2 items-end h-[80px]">
          {data.map(day => (
            <div key={day.date} className="flex flex-col items-center gap-1 h-full">
              {/* Show 4px baseline để chart không trông empty */}
              <div className="flex-1 w-full flex items-end">
                <div
                  className="w-full bg-on-surface/10 rounded-t"
                  style={{ height: '4px' }}
                />
              </div>
              <span className={cn(
                'text-[9px]',
                day.isToday ? 'text-secondary font-medium' : 'text-on-surface/40'
              )}>
                {day.label}
              </span>
            </div>
          ))}
        </div>
        <div className="text-center text-xs text-on-surface/45">
          Chưa ai học trong tuần này. Hãy là người đầu tiên!
        </div>
      </div>
    );
  }

  // Normal state với data
  const maxCount = Math.max(...data.map(d => d.count), 1);

  return (
    <div className="grid grid-cols-7 gap-2 items-end h-[80px]">
      {data.map(day => {
        const heightPercent = (day.count / maxCount) * 100;
        // Min 8% để bars có visual feedback khi count > 0
        const finalHeight = day.count > 0 ? Math.max(heightPercent, 8) : 2;

        return (
          <div key={day.date} className="flex flex-col items-center gap-1 h-full">
            <div className="flex-1 w-full flex items-end">
              <div
                className={cn(
                  'w-full rounded-t transition-all',
                  day.isToday
                    ? 'bg-gradient-to-t from-secondary/70 to-secondary shadow-[0_0_8px_rgba(232,168,50,0.4)]'
                    : 'bg-gradient-to-t from-secondary/30 to-secondary/60',
                  day.count === 0 && 'opacity-30'
                )}
                style={{ height: `${finalHeight}%` }}
                title={`${day.label}: ${day.count} người học`}
              />
            </div>
            <span className={cn(
              'text-[9px]',
              day.isToday ? 'text-secondary font-medium' : 'text-on-surface/40'
            )}>
              {day.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
```

**Backend:** Verify endpoint trả đúng shape `data: ActivityDay[]`. Nếu BE trả empty/null → FE handle gracefully.

**Acceptance:**
- [ ] Chart render bars với data thật
- [ ] Empty state khi data null/empty
- [ ] All-zero state với baseline 4px + encouraging message
- [ ] Today highlight gold + glow
- [ ] Hover tooltip "X: Y người học"
- [ ] Tests cho 3 states (empty, all-zero, normal)
- [ ] Commit: `fix(groups): activity chart render với fallback states`

---

### Task 2 — "Invalid Date" trong notification (P0, 30min)

**Issue:** Notification card hiện "Invalid Date" thay vì timestamp.

**Verify:**
```bash
# Tìm date formatting trong announcements
grep -rn "Invalid Date\|formatDate\|formatRelativeTime\|toLocaleString" apps/web/src/components/groups --include="*.tsx" --include="*.ts"

# Test API response
curl -H "Authorization: Bearer <token>" \
  "http://localhost:8080/api/groups/{groupId}/announcements?limit=5" | jq '.[0]'
```

**Confirm vấn đề:** Check field nào bị `null`/`undefined`/format sai. Có thể:
- Backend trả `createdAt` null
- Backend trả format khác ISO (e.g., epoch millis)
- Frontend parse sai timezone

**Fix:**

```tsx
// apps/web/src/utils/dateFormatters.ts
import { formatDistanceToNow, isValid, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';

/**
 * Format relative time với fallback graceful.
 * Returns empty string thay vì "Invalid Date" để không lộ lỗi ra UI.
 */
export function formatRelativeTime(
  timestamp: string | number | Date | null | undefined
): string {
  if (!timestamp) return '';

  let date: Date;

  if (typeof timestamp === 'string') {
    date = parseISO(timestamp);
  } else if (typeof timestamp === 'number') {
    date = new Date(timestamp);
  } else {
    date = timestamp;
  }

  if (!isValid(date)) {
    console.warn('[formatRelativeTime] Invalid timestamp:', timestamp);
    return '';
  }

  return formatDistanceToNow(date, { addSuffix: true, locale: vi });
}

/**
 * Absolute date format ("23/04/2026 19:42")
 */
export function formatDateTime(
  timestamp: string | number | Date | null | undefined
): string {
  if (!timestamp) return '';

  const date = typeof timestamp === 'string' ? parseISO(timestamp) : new Date(timestamp);
  if (!isValid(date)) return '';

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }).format(date);
}
```

**Update render:**

```tsx
// AnnouncementCard.tsx
function AnnouncementCard({ announcement }) {
  const relativeTime = formatRelativeTime(announcement.createdAt);

  return (
    <div className="announcement-card">
      <div className="header">
        <span>{announcement.author.name}</span>
        {/* Chỉ render time nếu valid */}
        {relativeTime && (
          <span className="text-xs text-on-surface/40">{relativeTime}</span>
        )}
      </div>
      <div className="content">{announcement.content}</div>
    </div>
  );
}
```

**Acceptance:**
- [ ] Không còn "Invalid Date" anywhere trong UI
- [ ] Valid timestamp render đúng "2 giờ trước"
- [ ] Invalid/null timestamp → không render dòng (graceful)
- [ ] Console warning để dev biết có data sai
- [ ] Tests cho cả 3 cases (null, invalid string, valid)
- [ ] Commit: `fix(groups): replace Invalid Date với graceful fallback`

---

### Task 3 — "{{count}} câu hỏi" template literal lộ ra UI (P0, 30min)

**Issue:** Quiz set card hiển thị "{{count}} câu hỏi" — placeholder chưa được replace.

**Verify:**
```bash
# Tìm template literal pattern
grep -rn '{{count}}\|{{.*}}' apps/web/src --include="*.tsx" --include="*.ts" --include="*.json" | head -20

# Tìm i18n keys liên quan quiz set
grep -rn "câu hỏi\|count.*question\|question.*count" apps/web/src/i18n apps/web/src/components/groups --include="*.json" --include="*.tsx" | head -10
```

**Confirm vấn đề:** Có thể là:
- i18n key có `{{count}}` nhưng component không pass variable
- Component render literal string thay vì interpolate
- i18n library config sai (react-i18next nhưng không init đúng)

**Fix:**

**Strategy A — Nếu dùng react-i18next (recommend):**
```tsx
// vi.json
{
  "groups": {
    "quizSet": {
      "questionCount_one": "{{count}} câu hỏi",
      "questionCount_other": "{{count}} câu hỏi"
    }
  }
}

// QuizSetCard.tsx
function QuizSetCard({ quizSet }) {
  const { t } = useTranslation();
  return (
    <div>
      <div>{quizSet.name}</div>
      {/* Pass count variable */}
      <div>{t('groups.quizSet.questionCount', { count: quizSet.questionCount })}</div>
    </div>
  );
}
```

**Strategy B — Direct interpolation (simpler, không cần i18n):**
```tsx
function QuizSetCard({ quizSet }) {
  return (
    <div>
      <div>{quizSet.name}</div>
      <div>{quizSet.questionCount} câu hỏi</div>
    </div>
  );
}
```

**Strategy C — Defensive (tạm fix khi chưa rõ root cause):**
```tsx
function QuizSetCard({ quizSet }) {
  const countText = quizSet.questionCount > 0
    ? `${quizSet.questionCount} câu hỏi`
    : 'Đang tải...';

  return (
    <div>
      <div>{quizSet.name}</div>
      <div>{countText}</div>
    </div>
  );
}
```

**Recommend Strategy A** nếu app đã setup react-i18next, Strategy B nếu chưa.

**Sweep toàn codebase:**

```bash
# Tìm tất cả {{...}} patterns còn lại
grep -rn '{{[^}]*}}' apps/web/src --include="*.tsx" | grep -v "test\|spec"
```

→ Fix tất cả nếu có nhiều case tương tự.

**Acceptance:**
- [ ] Quiz set card render đúng "X câu hỏi"
- [ ] Không còn `{{...}}` pattern nào lộ ra UI
- [ ] i18n keys đúng format
- [ ] Tests
- [ ] Commit: `fix(groups): replace template placeholder với actual count`

---

### Task 4 — Highlight current user trong leaderboard (P0, 30min)

**Issue:** Trong "Bảng XH Thành Viên", current user (TAI THANH) **không có label "BẠN"** để phân biệt.

**Verify:**
```bash
grep -rn "PodiumCard\|currentUser.*member\|isMe\|isCurrentUser" apps/web/src/components/groups --include="*.tsx" | head -10
```

**Confirm vấn đề:** Component có nhận `currentUserId` prop không? Có check `member.userId === currentUserId` không?

**Fix:**

```tsx
// apps/web/src/components/groups/leaderboard/PodiumCard.tsx
interface Props {
  member: GroupMember | null;
  rank: 1 | 2 | 3;
  currentUserId: string;  // ← required prop
}

function PodiumCard({ member, rank, currentUserId }: Props) {
  if (!member) {
    return <EmptyPodiumSlot rank={rank} />;
  }

  const isMe = member.userId === currentUserId;

  return (
    <div className={cn(
      'podium-card',
      isMe && 'podium-card--me ring-2 ring-secondary/40'
    )}>
      <Avatar src={member.avatar} name={member.name} />

      <div className="text-center">
        <div className="flex items-center justify-center gap-1 flex-wrap">
          <span className="text-sm font-medium">{member.name}</span>
          {isMe && (
            <span className="bg-secondary/20 text-secondary text-[9px] px-1.5 py-0.5 rounded-full font-medium border border-secondary/40">
              BẠN
            </span>
          )}
          {member.role === 'leader' && <span title="Trưởng nhóm">👑</span>}
        </div>
        <div className="text-xs text-on-surface/55">{getTierName(member)}</div>
      </div>

      <div className="text-xs text-on-surface/45">{member.weekPoints} đ</div>
    </div>
  );
}
```

**Tương tự cho mini list rows:**

```tsx
function MemberMiniRow({ member, rank, currentUserId }) {
  const isMe = member.userId === currentUserId;

  return (
    <div className={cn(
      'member-row',
      isMe && 'bg-secondary/8 border-l-2 border-secondary'
    )}>
      <span>{rank}</span>
      <Avatar src={member.avatar} />
      <div>
        <span>{member.name}</span>
        {isMe && (
          <span className="badge-me">BẠN</span>
        )}
      </div>
      <span>{member.points} đ</span>
    </div>
  );
}
```

**Pass currentUserId từ parent:**

```tsx
// GroupLeaderboard.tsx
function GroupLeaderboard({ groupId }) {
  const { data: currentUser } = useCurrentUser();
  const { data: members } = useGroupMembers(groupId);

  return (
    <PodiumTop3
      members={members.slice(0, 3)}
      currentUserId={currentUser.id}  // ← pass down
    />
  );
}
```

**Acceptance:**
- [ ] Current user có label "BẠN" trong podium
- [ ] Current user có border highlight + label trong mini list
- [ ] Pattern consistent giữa podium và mini list
- [ ] Tests cho cả 2 components
- [ ] Commit: `fix(groups): highlight current user trong leaderboard với "BẠN" label`

---

## 🟠 P1 — UX Issues (7 tasks, ~1.5-2h)

### Task 5 — Notification badge "9+" inflated count (P1, 20min)

**Issue:** Badge "9+" trên bell icon có thể bao gồm test/system notifications, inflate cho user mới.

**Verify:**
```bash
grep -rn "unreadCount\|notification.*count" apps/web/src --include="*.tsx" --include="*.ts" | head -10

# Check API
curl -H "Authorization: Bearer <token>" \
  "http://localhost:8080/api/notifications/unread-count" | jq
```

**Confirm vấn đề:** API có filter user-relevant notifications không? Có auto-mark read khi user view không?

**Fix:**

```tsx
// apps/web/src/hooks/useNotifications.ts
export function useNotificationsBadge() {
  const { data, refetch } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.get('/notifications/unread-count'),
    refetchInterval: 60000,  // poll every minute
  });

  // Display logic
  const badgeText = useMemo(() => {
    if (!data?.count) return null;
    if (data.count > 99) return '99+';
    if (data.count > 9) return '9+';
    return String(data.count);
  }, [data]);

  return { count: data?.count ?? 0, badgeText, refetch };
}
```

**Backend filter:**
```java
// NotificationService.java
public long countUnreadForUser(UUID userId) {
  return notificationRepository.countByRecipientIdAndReadAtIsNullAndType_NotIn(
    userId,
    List.of("system_test", "internal_debug")  // exclude test types
  );
}
```

**Auto-mark read khi user open notifications page:**
```tsx
function NotificationsPage() {
  const { mutate: markAllRead } = useMarkAllNotificationsRead();

  useEffect(() => {
    markAllRead();
  }, []);
  // ...
}
```

**Acceptance:**
- [ ] Badge count chính xác (chỉ user-relevant)
- [ ] Auto-mark read khi view notifications
- [ ] "9+" cap giữ design nhưng count thực correct
- [ ] Test scenarios
- [ ] Commit: `fix(notifications): filter test types + auto-mark read`

---

### Task 6 — Small group threshold cho analytics (P1, 30min)

**Issue:** Group 2 thành viên hiện full analytics — nhưng "1/2 active = 50%" stats vô nghĩa cho group nhỏ.

**Verify:**
```bash
grep -rn "LeaderAnalyticsPanel\|memberCount.*threshold" apps/web/src/components/groups/leader --include="*.tsx"
```

**Fix:**

```tsx
// apps/web/src/components/groups/leader/LeaderAnalyticsPanel.tsx
const SMALL_GROUP_THRESHOLD = 5;

function LeaderAnalyticsPanel({ group }: { group: Group }) {
  const memberCount = group.memberCount ?? 0;

  // Group quá nhỏ — show invite CTA thay vì analytics
  if (memberCount < SMALL_GROUP_THRESHOLD) {
    return (
      <Card variant="info" className="border-info/25">
        <div className="flex items-start gap-3">
          <span className="text-2xl">📊</span>
          <div className="flex-1">
            <div className="text-on-surface font-medium text-sm mb-1">
              Phân tích nhóm
            </div>
            <div className="text-on-surface/55 text-sm mb-3">
              Cần ít nhất {SMALL_GROUP_THRESHOLD} thành viên để hiển thị phân tích chi tiết.
              Hiện tại nhóm có {memberCount} thành viên.
            </div>
            <div className="flex gap-2">
              <Button onClick={openInviteModal}>+ Mời thành viên</Button>
              <Button variant="outline" onClick={shareGroupCode}>
                🔗 Chia sẻ mã nhóm
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // Render full analytics (existing code)
  return <FullAnalytics group={group} />;
}
```

**Acceptance:**
- [ ] Group < 5 members → invite CTA panel
- [ ] Group ≥ 5 members → full analytics
- [ ] Threshold configurable nếu cần (constant export)
- [ ] Tests cho 2 states
- [ ] Commit: `feat(groups): hide analytics for small groups, show invite CTA`

---

### Task 7 — Inactive alert chỉ cho group active đủ lâu (P1, 20min)

**Issue:** Group mới tạo (1 ngày) hiển thị "1 thành viên không hoạt động 7+ ngày" — confusing.

**Verify:**
```bash
grep -rn "InactiveAlert\|inactive.*alert\|inactiveCount" apps/web/src/components/groups/leader --include="*.tsx"
```

**Fix:**

```tsx
function InactiveAlert({ group, inactiveCount }) {
  // Group quá mới — không show alert
  const groupAgeDays = differenceInDays(new Date(), parseISO(group.createdAt));
  const MIN_GROUP_AGE_FOR_ALERT = 14;

  if (groupAgeDays < MIN_GROUP_AGE_FOR_ALERT) {
    return null;
  }

  // Không có inactive members
  if (inactiveCount === 0) {
    return null;
  }

  return (
    <div className="bg-warning/06 border-warning/30 rounded-lg p-3">
      <div className="flex items-center gap-2">
        <span>⚠️</span>
        <span>{inactiveCount} thành viên không hoạt động 7+ ngày</span>
      </div>
      {/* ... */}
    </div>
  );
}
```

**Acceptance:**
- [ ] Group < 14 ngày → ẩn alert
- [ ] Group ≥ 14 ngày + có inactive → show alert
- [ ] Group ≥ 14 ngày + 0 inactive → ẩn alert
- [ ] Tests
- [ ] Commit: `fix(groups): inactive alert chỉ cho group đã active đủ lâu`

---

### Task 8 — Streak widget copy theo state (P1, 20min)

**Issue:** Group streak = 0 nhưng vẫn hiện "Cả nhóm cùng học liên tục" → mismatch reality.

**Verify:**
```bash
grep -rn "GroupStreakWidget\|STREAK CỦA NHÓM" apps/web/src/components/groups --include="*.tsx"
```

**Fix:**

```tsx
function GroupStreakWidget({ streak, activeToday, totalMembers }) {
  // State 1: Streak = 0 (group mới hoặc đã gãy)
  if (streak === 0) {
    return (
      <Card>
        <Header icon="🔥" title="STREAK CỦA NHÓM" />
        <div className="text-3xl font-medium text-on-surface/60">0 ngày</div>
        <div className="text-sm text-on-surface/55 mt-2">
          {activeToday > 0
            ? `Đang xây dựng streak. ${activeToday}/${totalMembers} đã học hôm nay.`
            : 'Hãy là người đầu tiên học hôm nay để khởi động streak nhóm!'}
        </div>
        {activeToday > 0 && (
          <Progress value={activeToday} max={totalMembers} className="mt-3" />
        )}
      </Card>
    );
  }

  // State 2: Streak active
  return (
    <Card>
      <Header icon="🔥" title="STREAK CỦA NHÓM" />
      <div className="text-3xl font-medium text-success">{streak} ngày</div>
      <div className="text-sm text-on-surface/55 mt-2">
        Cả nhóm cùng học liên tục. Đừng để gãy chuỗi!
      </div>
      <Progress value={activeToday} max={totalMembers} className="mt-3" />
      <div className="text-xs text-on-surface/45 mt-1">
        {activeToday}/{totalMembers} thành viên đã học hôm nay
      </div>
    </Card>
  );
}
```

**Acceptance:**
- [ ] Streak 0 + 0 active → "Hãy là người đầu tiên..."
- [ ] Streak 0 + > 0 active → "Đang xây dựng streak..."
- [ ] Streak > 0 → "Cả nhóm cùng học liên tục..."
- [ ] Tests cho 3 states
- [ ] Commit: `fix(groups): streak widget copy theo state thực`

---

### Task 9 — KPI accuracy color + trend rõ ràng (P1, 20min)

**Issue:** "ĐỘ CHÍNH XÁC 41% — Ổn định" — 41% accuracy thấp nhưng "Ổn định" không rõ là tốt hay xấu.

**Verify:**
```bash
grep -rn "ĐỘ CHÍNH XÁC\|accuracy.*kpi" apps/web/src/components/groups/leader --include="*.tsx"
```

**Fix:**

```tsx
interface AccuracyKpiProps {
  current: number;       // 0-100
  previous?: number;     // optional, for trend
}

function AccuracyKpiCard({ current, previous }: AccuracyKpiProps) {
  // Color theo threshold
  const color = current >= 70 ? 'success' : current >= 50 ? 'warning' : 'error';

  // Trend
  let trend = null;
  if (previous != null) {
    const diff = current - previous;
    if (Math.abs(diff) < 1) {
      trend = { icon: '—', text: 'Không đổi', color: 'neutral' };
    } else if (diff > 0) {
      trend = { icon: '▲', text: `+${diff.toFixed(1)}% vs tuần trước`, color: 'success' };
    } else {
      trend = { icon: '▼', text: `${diff.toFixed(1)}% vs tuần trước`, color: 'error' };
    }
  }

  // Reference text
  const reference = current < 60
    ? 'Trung bình 70% là tốt'
    : current < 80
    ? 'Đang trên trung bình'
    : 'Xuất sắc!';

  return (
    <KpiCard variant={color}>
      <Label>ĐỘ CHÍNH XÁC</Label>
      <Value>{current}%</Value>
      {trend && (
        <Trend className={`text-${trend.color}`}>
          {trend.icon} {trend.text}
        </Trend>
      )}
      <Hint>{reference}</Hint>
    </KpiCard>
  );
}
```

**Acceptance:**
- [ ] Color theo accuracy threshold (≥70 green, 50-69 orange, <50 red)
- [ ] Trend rõ ràng với arrow + diff value
- [ ] Reference hint giúp user hiểu "41% là thấp"
- [ ] Tests
- [ ] Commit: `fix(groups): KPI accuracy với color + trend + reference`

---

### Task 10 — Group code clickable copy (P1, 15min)

**Issue:** Group code "NVHOS9" hiển thị nhưng không clear là clickable copy.

**Verify:**
```bash
grep -rn "NVHOS9\|groupCode\|invitation.*code\|inviteCode" apps/web/src/components/groups --include="*.tsx" | head -10
```

**Fix:**

```tsx
function GroupCodeBadge({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success(`Đã sao chép mã ${code}`);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Không thể sao chép. Vui lòng thử lại.');
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="group flex items-center gap-1.5 bg-surface-container rounded-md px-2 py-1 hover:bg-surface-container-high transition-colors"
      title="Click để sao chép mã nhóm"
    >
      <span className="text-secondary text-xs">🔑</span>
      <code className="text-secondary font-mono text-xs">{code}</code>
      <span className="text-on-surface/40 text-xs group-hover:text-secondary transition-colors">
        {copied ? '✓' : '📋'}
      </span>
    </button>
  );
}
```

**Acceptance:**
- [ ] Click code → copy + toast feedback
- [ ] Hover state visible (cursor + bg change)
- [ ] Icon thay đổi sau khi copy (📋 → ✓)
- [ ] Title attribute cho a11y
- [ ] Tests
- [ ] Commit: `feat(groups): clickable group code với copy feedback`

---

### Task 11 — Validate quiz set name (P1, 20min)

**Issue:** Quiz set tên "tett" — junk data, validation thiếu.

**Verify:**
```bash
grep -rn "QuizSetForm\|createQuizSet\|quizSet.*name" apps/web/src --include="*.tsx" | head -10
grep -rn "QuizSetCreateDto\|quiz_set.*name" apps/api/src/main/java --include="*.java" | head -10
```

**Fix:** Apply same validation rule như Room name:

```tsx
// apps/web/src/utils/validation.ts (extract from Room Lobby Task 1)
export function validateName(
  name: string,
  options: { min?: number; max?: number; entityName?: string } = {}
): { valid: boolean; error?: string } {
  const { min = 5, max = 60, entityName = 'tên' } = options;

  if (!name?.trim()) {
    return { valid: false, error: `Vui lòng nhập ${entityName}` };
  }

  const trimmed = name.trim();

  if (trimmed.length < min) {
    return { valid: false, error: `${entityName} phải có ít nhất ${min} ký tự` };
  }

  if (trimmed.length > max) {
    return { valid: false, error: `${entityName} tối đa ${max} ký tự` };
  }

  // Reject single char repeated (vd "aaaa", "tttttt")
  if (/^(.)\1+$/.test(trimmed)) {
    return { valid: false, error: `${entityName} không hợp lệ` };
  }

  // Reject all-numeric
  if (/^\d+$/.test(trimmed)) {
    return { valid: false, error: `${entityName} không thể chỉ chứa số` };
  }

  return { valid: true };
}
```

**Apply to QuizSetForm:**

```tsx
function QuizSetForm() {
  const [name, setName] = useState('');
  const validation = validateName(name, { min: 5, entityName: 'tên bộ quiz' });

  return (
    <form>
      <Input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="VD: Bài học Chúa Nhật 04/05"
        error={!validation.valid ? validation.error : undefined}
      />
      <Button disabled={!validation.valid} type="submit">
        Tạo bộ quiz
      </Button>
    </form>
  );
}
```

**Backend mirror validation** trong `QuizSetCreateDto`.

**Acceptance:**
- [ ] Quiz set name min 5 chars
- [ ] Reject single char repeated
- [ ] Backend validation tương đương
- [ ] Helper function reusable cho Room name + Quiz set name + Group name
- [ ] Existing "tett" record có thể migrate hoặc delete trong dev
- [ ] Tests
- [ ] Commit: `fix(quiz-set): validate name với reusable helper`

---

## Final regression

```bash
# 1. Build pass
cd apps/web && npm run build

# 2. Tests pass
npx vitest run | tail -5

# 3. Backend tests
cd ../api && ./mvnw test

# 4. Visual smoke test 4 scenarios
# A. Group có ≥5 members → analytics chart render đầy đủ
# B. Group < 5 members → invite CTA thay analytics
# C. Group mới (< 14 ngày) → không alert inactive
# D. Quiz set tạo với name "tett" → reject với error message
# E. Click group code → copy + toast feedback
# F. Notifications bell badge count chính xác
# G. Current user trong leaderboard có "BẠN" label

# 5. Push
git push origin fix/groups-leader-issues
```

---

## ⚠️ Constraints

- **Mỗi task = 1 commit riêng** (11 commits total)
- **Verify trước khi code** — không assume issue tồn tại
- **Web-only this turn**, mobile sync follow-up
- **Backend coordination** cho Tasks 1, 2, 5, 11 nếu cần update API/validation
- **Không refactor ngoài scope** — defer P2/P3 issues sang sprint sau

---

## 🤔 Nếu gặp blocker

| Blocker | Action |
|---|---|
| Backend trả empty/null cho analytics | Frontend handle với empty/all-zero states (Task 1) |
| Date format khác ISO 8601 | Adjust parser trong `formatRelativeTime` helper |
| i18n không init đúng | Strategy B (direct interpolation) thay vì t() |
| Notification API không filter test types | Frontend filter tạm + backend ticket |
| Existing junk data ("tett" quiz sets) | Migration script delete records < 5 chars |
| Validation breaking existing valid records | Whitelist legacy records, apply rule cho records mới |

---

## 📋 Defer sang sprint sau

- 🟡 GR2-P2-1 Sidebar widgets generic vs group-specific
- 🟡 GR2-P2-2 KPI background colored gradient
- 🟡 GR2-P2-3 "Xem phân tích đầy đủ" link target
- 🟡 GR2-P2-4 Hide "Xem tất cả" link khi memberCount ≤ 7
- 🟡 GR2-P2-5 Test announcements cleanup
- 🟢 GR2-P3-1 Empty state Giải đấu CTA
- 🟢 GR2-P3-2 Activity chart label localization

Ghi vào `docs/FOLLOWUPS.md`.

---

## Files manifest

**New utilities:**
- `apps/web/src/utils/dateFormatters.ts` (Task 2 — reusable)
- `apps/web/src/utils/validation.ts` (Task 11 — reusable)

**Modify components:**
- `apps/web/src/components/groups/leader/ActivityChart.tsx` (Task 1)
- `apps/web/src/components/groups/AnnouncementCard.tsx` (Task 2)
- `apps/web/src/components/groups/QuizSetCard.tsx` (Task 3)
- `apps/web/src/components/groups/leaderboard/PodiumCard.tsx` (Task 4)
- `apps/web/src/components/groups/leaderboard/MemberMiniRow.tsx` (Task 4)
- `apps/web/src/components/groups/leader/LeaderAnalyticsPanel.tsx` (Task 6)
- `apps/web/src/components/groups/leader/InactiveAlert.tsx` (Task 7)
- `apps/web/src/components/groups/sidebar/GroupStreakWidget.tsx` (Task 8)
- `apps/web/src/components/groups/leader/AccuracyKpiCard.tsx` (Task 9)
- `apps/web/src/components/groups/GroupCodeBadge.tsx` (Task 10)
- `apps/web/src/components/quiz-set/QuizSetForm.tsx` (Task 11)

**Backend:**
- `NotificationService.java` (Task 5 — filter test types)
- `QuizSetCreateDto.java` (Task 11 — validation)

---

## Definition of Done

- [ ] 11 commits pushed lên branch `fix/groups-leader-issues`
- [ ] Activity chart render correctly hoặc empty state graceful
- [ ] Không còn "Invalid Date" anywhere
- [ ] Không còn `{{...}}` template literals lộ ra UI
- [ ] Current user có "BẠN" highlight trong leaderboard
- [ ] Notification badge count accurate
- [ ] Small groups có invite CTA thay analytics
- [ ] Inactive alert chỉ cho group ≥ 14 ngày
- [ ] Streak widget copy match reality
- [ ] Accuracy KPI có color + trend
- [ ] Group code clickable copy
- [ ] Quiz set name validation
- [ ] Build pass + tests ≥ baseline
- [ ] Backend coordination tickets ghi đầy đủ
- [ ] FOLLOWUPS.md updated với P2/P3 deferred

---

*Generated 2026-04-30 — Groups Leader Dashboard fix sprint, 4 P0 + 7 P1 issues.*
