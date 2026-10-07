import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  archiveQuizSet, deleteQuizSet, playQuizSetCoPlay, unarchiveQuizSet,
  type QuizSet,
} from '../../api/quizSets'

// Khung Sáng palette hex (Bui rule: no CSS variables in card files, avoids the
// white-background bug from var() resolution failures). Light-theme jewel tokens.
const HEX = {
  gold: '#D97F06',          // bq-amber-deep (contrast-safe on light)
  goldHover: '#F59E0B',     // bq-amber
  navy: '#FFFFFF',          // fg on filled jewel buttons
  textPrimary: '#1D2B22',   // bq-ink
  textMuted: '#4D3A1F',     // bq-ink-soft
  textDim: '#6B5530',       // bq-ink-faint
  iconText: '#4D3A1F',      // bq-ink-soft
  green: '#2E7D4F',         // bq-emerald
  blue: '#2F6FB0',          // bq-sapphire
  red: '#B3452F',           // bq-ruby
  copper: '#D97F06',        // bq-amber-deep
}

type Role = 'LEADER' | 'MOD' | 'MEMBER' | null

interface Props {
  groupId: string
  qs: QuizSet
  myRole: Role
  isMember: boolean
  /** Live co-play room cho quiz set này — nếu có, member thấy CTA "Tham gia". */
  activeCoPlayRoom?: { id: string; roomCode: string; currentPlayers?: number; maxPlayers?: number } | null
  /** Active scheduled session cho quiz set này — fallback nếu không có live room. */
  activeSchedule?: { id: string; deadline?: string } | null
  onPlayCoPlay?: (qs: QuizSet) => void
  onSchedule?: (qs: QuizSet) => void
  onEditDraft?: (qs: QuizSet) => void
  onDeleteDraft?: (qs: QuizSet) => void
  onUnarchive?: (qs: QuizSet) => void
  onMenuOpen?: (qs: QuizSet, anchor: HTMLElement) => void
  onClick?: () => void
}

function statusBadge(status: QuizSet['publishStatus']): { label: string; bg: string; color: string; icon: string } | null {
  switch (status) {
    case 'PUBLISHED': return { label: 'Đã xuất bản', bg: 'rgba(46,125,79, 0.12)', color: HEX.green,  icon: 'check_circle' }
    case 'DRAFT':     return { label: 'Bản nháp',    bg: 'rgba(108, 106, 98, 0.12)', color: HEX.textMuted, icon: 'edit_note' }
    case 'ARCHIVED':  return { label: 'Đã lưu trữ',  bg: 'rgba(217, 127, 6, 0.12)',  color: HEX.copper, icon: 'archive' }
    case 'SOFT_DELETED': return { label: 'Đã xóa',  bg: 'rgba(179,69,47, 0.12)',   color: HEX.red, icon: 'delete' }
    default: return null
  }
}

function bookFromTagsOrScripture(qs: QuizSet): string {
  if (qs.coverScripture) {
    const m = qs.coverScripture.match(/^([^\d]+)/)
    if (m && m[1].trim()) return m[1].trim()
  }
  if (qs.tags && qs.tags.length > 0) return qs.tags[0]
  return 'Chưa chọn'
}

/**
 * Difficulty pills: BE only exposes a single `difficulty` enum (no per-level breakdown).
 * Map to a 3-pill display where the matching pill shows count, others show 0.
 * MIXED splits roughly: 40/40/20 of totalQuestions.
 * Documented in IMPL_NOTES.md as deviation from mockup.
 */
function difficultyDistribution(qs: QuizSet): { easy: number; medium: number; hard: number } {
  const total = qs.totalQuestions || 0
  switch (qs.difficulty) {
    case 'EASY':   return { easy: total, medium: 0, hard: 0 }
    case 'MEDIUM': return { easy: 0, medium: total, hard: 0 }
    case 'HARD':   return { easy: 0, medium: 0, hard: total }
    case 'MIXED': {
      const easy = Math.round(total * 0.4)
      const medium = Math.round(total * 0.4)
      return { easy, medium, hard: Math.max(0, total - easy - medium) }
    }
    default: return { easy: 0, medium: 0, hard: 0 }
  }
}

function formatRelative(iso?: string | null): string {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 1) return 'vừa xong'
  if (min < 60) return `${min} phút trước`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h trước`
  const day = Math.floor(hr / 24)
  if (day === 1) return 'hôm qua'
  if (day < 7) return `${day} ngày trước`
  return new Date(iso).toLocaleDateString('vi-VN')
}

export default function QuizSetListCard({
  groupId, qs, myRole, isMember: _isMember,
  activeCoPlayRoom, activeSchedule,
  onPlayCoPlay: _onPlayCoPlay, onSchedule: _onSchedule,
  onEditDraft, onDeleteDraft, onUnarchive,
  onClick,
}: Props) {
  void _isMember // legacy prop, no longer used since solo practice was removed (2026-05-20)
  const navigate = useNavigate()
  const [coPlayBusy, setCoPlayBusy] = useState(false)
  const [coPlayError, setCoPlayError] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuBusy, setMenuBusy] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const badge = statusBadge(qs.publishStatus)
  const book = bookFromTagsOrScripture(qs)
  const dist = difficultyDistribution(qs)
  const isLeader = myRole === 'LEADER' || myRole === 'MOD'
  const isPublished = qs.publishStatus === 'PUBLISHED'
  const isDraft = qs.publishStatus === 'DRAFT'
  const isArchived = qs.publishStatus === 'ARCHIVED'

  useEffect(() => {
    if (!menuOpen) return
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [menuOpen])

  const handleMenuAction = async (
    action: 'edit' | 'detail' | 'archive' | 'unarchive' | 'delete',
  ) => {
    setMenuOpen(false)
    if (action === 'edit')   { navigate(`/groups/${groupId}/quiz-sets/${qs.id}/edit`); return }
    if (action === 'detail') { navigate(`/groups/${groupId}/quiz-sets/${qs.id}`); return }
    if (action === 'delete' && !window.confirm(`Xóa bộ "${qs.name}"?`)) return
    setMenuBusy(true)
    try {
      if (action === 'archive')    await archiveQuizSet(groupId, qs.id)
      if (action === 'unarchive')  await unarchiveQuizSet(groupId, qs.id)
      if (action === 'delete')     await deleteQuizSet(groupId, qs.id)
      navigate(0)
    } catch (err: any) {
      window.alert(err?.response?.data?.message || err?.message || 'Thao tác thất bại')
    } finally { setMenuBusy(false) }
  }

  const handleCoPlay = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (coPlayBusy) return
    setCoPlayBusy(true); setCoPlayError(null)
    try {
      const room = await playQuizSetCoPlay(groupId, qs.id)
      // Pass fromGroupId so RoomLobby's leave handler returns to the group page
      // (RoomDetailsDTO doesn't expose groupId, only groupQuizSetId — this state
      // is the only way leave knows where to go back).
      navigate(`/room/${room.id}/lobby`, { state: { fromGroupId: groupId } })
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Không thể tạo phòng'
      setCoPlayError(msg)
      setCoPlayBusy(false)
    }
  }

  // Card body intentionally NOT clickable — only the action buttons fire
  // actions. Reserved future: click body = open quiz set editor (Bui).
  const stop = (e: React.MouseEvent) => e.stopPropagation()
  void onClick // kept in props for future editor wiring

  return (
    <>
      <div
        data-testid="quiz-set-list-card"
        data-status={qs.publishStatus}
        style={{
          background: '#FFFFFF',
          border: '1px solid #C9B58C',
          borderRadius: 16,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          transition: 'all 0.2s',
          boxShadow: '0 18px 40px -24px rgba(20,20,30,.28)',
        }}
      >
        {/* HEADER STRIP */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '14px 16px',
            borderBottom: '1px solid #C9B58C',
          }}
        >
          {badge && (
            <span
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '4px 10px', borderRadius: 6,
                fontSize: 11, fontWeight: 700, letterSpacing: 0.3,
                textTransform: 'uppercase',
                background: badge.bg, color: badge.color,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{badge.icon}</span>
              {badge.label}
            </span>
          )}
          <span
            style={{
              background: 'rgba(245, 158, 11, 0.12)', color: HEX.gold,
              padding: '4px 10px', borderRadius: 6,
              fontSize: 12, fontWeight: 600,
              marginLeft: 'auto', marginRight: 8,
            }}
          >{book}</span>
          {isLeader && (
            <div ref={menuRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={e => { stop(e); setMenuOpen(v => !v) }}
                aria-label="Tùy chọn"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                data-testid="btn-card-menu"
                disabled={menuBusy}
                style={{
                  background: menuOpen ? 'rgba(20,20,30,0.06)' : 'transparent',
                  border: 'none', color: HEX.textMuted,
                  cursor: menuBusy ? 'wait' : 'pointer',
                  width: 28, height: 28, borderRadius: 6,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>more_vert</span>
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  data-testid="card-menu"
                  style={{
                    position: 'absolute', top: 32, right: 0, zIndex: 30,
                    minWidth: 180,
                    background: '#FFFFFF',
                    border: '1px solid #C9B58C',
                    borderRadius: 10, padding: 4,
                    boxShadow: '0 18px 40px -24px rgba(20,20,30,.28)',
                  }}
                >
                  <MenuItem icon="edit"        label="Sửa câu hỏi" onClick={() => handleMenuAction('edit')} testId="menu-edit" />
                  <MenuItem icon="visibility"  label="Xem chi tiết" onClick={() => handleMenuAction('detail')} testId="menu-detail" />
                  {isPublished && (
                    <MenuItem icon="archive" label="Lưu trữ" onClick={() => handleMenuAction('archive')} testId="menu-archive" />
                  )}
                  {isArchived && (
                    <MenuItem icon="lock_open" label="Mở khóa" onClick={() => handleMenuAction('unarchive')} testId="menu-unarchive" />
                  )}
                  <MenuItem icon="delete" label="Xóa" onClick={() => handleMenuAction('delete')} danger testId="menu-delete" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* BODY */}
        <div style={{ padding: 16, flex: 1 }}>
          <div
            style={{
              fontFamily: '"Bricolage Grotesque", "Be Vietnam Pro", sans-serif',
              fontSize: 17, fontWeight: 700,
              marginBottom: 4, color: HEX.textPrimary,
            }}
          >{qs.name}</div>
          <div
            style={{
              color: qs.description ? HEX.textMuted : HEX.textDim,
              fontStyle: qs.description ? 'normal' : 'italic',
              fontSize: 13, marginBottom: 14,
            }}
          >{qs.description || 'Chưa có mô tả'}</div>

          {/* Difficulty pills (3-bin display per mockup; data adapted from single difficulty enum) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
            <DifficultyPill label="Dễ"  count={dist.easy}   color={HEX.green} />
            <DifficultyPill label="TB"  count={dist.medium} color={HEX.gold} />
            <DifficultyPill label="Khó" count={dist.hard}   color={HEX.red} />
          </div>

          {/* Stats row */}
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px', background: '#EFE3C3',
              borderRadius: 10, fontSize: 12, color: HEX.textMuted,
            }}
          >
            <Stat icon="quiz">
              <span style={{ color: HEX.gold, fontWeight: 600 }}>{qs.totalQuestions}</span> câu
            </Stat>
            <Divider />
            <Stat icon="groups">{qs.playCount} lượt chơi</Stat>
            {qs.lastPlayedAt && (
              <>
                <Divider />
                <Stat icon="schedule">{formatRelative(qs.lastPlayedAt)}</Stat>
              </>
            )}
          </div>

        </div>

        {/* ACTIONS FOOTER — state-aware */}
        <div
          style={{
            padding: 12, borderTop: '1px solid #C9B58C',
            display: 'flex', gap: 8,
            background: isDraft ? '#EFE3C3' : '#FBFAF5',
          }}
        >
          {isPublished && isLeader && (
            // Leader/Mod: Chơi cùng nhau + Đặt lịch (solo removed 2026-05-20).
            <>
              <button
                type="button"
                disabled={coPlayBusy}
                onClick={handleCoPlay}
                title="Tạo phòng chơi cùng nhóm (Speed Race)"
                aria-label="Chơi cùng nhau"
                data-testid="btn-coplay"
                style={{
                  flex: 1, background: HEX.gold, color: '#FFFFFF', border: 'none',
                  padding: '11px 14px', borderRadius: 10,
                  fontWeight: 700, fontSize: 14,
                  cursor: coPlayBusy ? 'not-allowed' : 'pointer',
                  opacity: coPlayBusy ? 0.6 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  fontFamily: 'inherit',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>groups</span>
                {coPlayBusy ? 'Đang tạo phòng...' : 'Chơi cùng nhau'}
              </button>
              <IconButton
                title="Đặt lịch quiz"
                aria-label="Đặt lịch quiz"
                icon="event"
                onClick={e => {
                  stop(e)
                  navigate(`/groups/${groupId}/scheduled-quizzes/new?quizSetId=${qs.id}`)
                }}
                data-testid="btn-schedule"
              />
            </>
          )}

          {isPublished && !isLeader && (() => {
            // Member view: only Tham gia surfaces (live co-play room or scheduled session).
            // Without either, members see no action button — they reach quiz sets via
            // the leader's invite to a live or scheduled session, not by browsing.
            if (activeCoPlayRoom) {
              return (
                <button
                  type="button"
                  onClick={e => { stop(e); navigate(`/room/${activeCoPlayRoom.id}/lobby`, { state: { fromGroupId: groupId } }) }}
                  title="Tham gia trận đấu đang diễn ra"
                  aria-label="Tham gia trận đấu"
                  data-testid="btn-join-live"
                  style={{
                    flex: 1, background: HEX.green, color: '#FFFFFF', border: 'none',
                    padding: '11px 14px', borderRadius: 10,
                    fontWeight: 700, fontSize: 14, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    fontFamily: 'inherit',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>play_arrow</span>
                  Tham gia
                  {activeCoPlayRoom.currentPlayers != null && activeCoPlayRoom.maxPlayers != null && (
                    <span style={{ fontSize: 12, fontWeight: 600, opacity: 0.85 }}>
                      ({activeCoPlayRoom.currentPlayers}/{activeCoPlayRoom.maxPlayers})
                    </span>
                  )}
                </button>
              )
            }
            if (activeSchedule) {
              return (
                <button
                  type="button"
                  onClick={e => { stop(e); navigate(`/groups/${groupId}/scheduled-quizzes/${activeSchedule.id}`) }}
                  title="Tham gia lịch quiz này"
                  aria-label="Tham gia lịch quiz"
                  data-testid="btn-join-schedule"
                  style={{
                    flex: 1, background: HEX.blue, color: '#fff', border: 'none',
                    padding: '11px 14px', borderRadius: 10,
                    fontWeight: 700, fontSize: 14, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    fontFamily: 'inherit',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>how_to_reg</span>
                  Tham gia lịch
                </button>
              )
            }
            // No active room or scheduled session — hint member to wait for leader.
            return (
              <div
                data-testid="btn-wait-leader"
                style={{
                  flex: 1, padding: '11px 14px', borderRadius: 10,
                  background: '#EFE3C3', color: HEX.textMuted,
                  fontSize: 12, textAlign: 'center', fontStyle: 'italic',
                }}
              >Đợi trưởng nhóm bắt đầu</div>
            )
          })()}
          {isDraft && isLeader && (
            <>
              <button
                type="button"
                onClick={e => { stop(e); onEditDraft ? onEditDraft(qs) : navigate(`/groups/${groupId}/quiz-sets/${qs.id}`) }}
                style={{
                  flex: 1,
                  background: 'rgba(245, 158, 11, 0.15)', color: HEX.gold,
                  border: '1px dashed rgba(245, 158, 11, 0.4)',
                  padding: '11px 14px', borderRadius: 10,
                  fontWeight: 700, fontSize: 14, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  fontFamily: 'inherit',
                }}
                data-testid="btn-edit-draft"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>
                Tiếp tục soạn
              </button>
              {onDeleteDraft && (
                <IconButton
                  title="Xóa nháp"
                  aria-label="Xóa nháp"
                  icon="delete"
                  onClick={e => { stop(e); onDeleteDraft(qs) }}
                  data-testid="btn-delete-draft"
                />
              )}
            </>
          )}
          {isArchived && (
            <>
              <button
                type="button"
                onClick={e => { stop(e); navigate(`/groups/${groupId}/quiz-sets/${qs.id}`) }}
                style={{
                  flex: 1,
                  background: '#EFE3C3', color: HEX.iconText,
                  border: '1px solid #C9B58C',
                  padding: '11px 14px', borderRadius: 10,
                  fontWeight: 700, fontSize: 14, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  fontFamily: 'inherit',
                }}
                data-testid="btn-view-archived"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>visibility</span>
                Xem chi tiết
              </button>
              {isLeader && onUnarchive && (
                <IconButton
                  title="Mở khóa"
                  aria-label="Mở khóa"
                  icon="lock_open"
                  onClick={e => { stop(e); onUnarchive(qs) }}
                  data-testid="btn-unarchive"
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* CO-PLAY ERROR TOAST */}
      {coPlayError && (
        <div
          role="alert"
          data-testid="coplay-error"
          style={{
            position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
            zIndex: 60, padding: '8px 14px', borderRadius: 8,
            background: 'rgba(179,69,47, 0.95)', color: '#fff',
            fontSize: 12, fontFamily: 'inherit', cursor: 'pointer',
          }}
          onClick={() => setCoPlayError(null)}
        >{coPlayError}</div>
      )}

    </>
  )
}

function DifficultyPill({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div
      style={{
        flex: 1, background: '#EFE3C3',
        borderRadius: 8, padding: '6px 8px', textAlign: 'center',
        border: '1px solid #C9B58C',
      }}
    >
      <span style={{ display: 'block', fontWeight: 700, fontSize: 15, marginBottom: 1, color }}>{count}</span>
      <span style={{ fontSize: 10, color: '#4D3A1F', textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</span>
    </div>
  )
}

function Stat({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{icon}</span>
      <span>{children}</span>
    </div>
  )
}

function Divider() {
  return <div style={{ width: 1, height: 12, background: '#C9B58C' }} />
}

interface IconButtonProps {
  icon: string
  onClick: (e: React.MouseEvent) => void
  title: string
  'aria-label': string
  disabled?: boolean
  'data-testid'?: string
}

function MenuItem({
  icon, label, onClick, danger, testId,
}: {
  icon: string; label: string; onClick: () => void; danger?: boolean; testId?: string;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={e => { e.stopPropagation(); onClick() }}
      data-testid={testId}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        background: 'transparent', border: 'none',
        color: danger ? HEX.red : HEX.textPrimary,
        padding: '9px 12px', borderRadius: 6,
        fontSize: 13, fontFamily: 'inherit', textAlign: 'left',
        cursor: 'pointer',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = danger ? 'rgba(179,69,47, 0.10)' : 'rgba(20,20,30,0.05)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 17 }}>{icon}</span>
      {label}
    </button>
  )
}

function IconButton(props: IconButtonProps) {
  const { icon, onClick, title, disabled } = props
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={props['aria-label']}
      disabled={disabled}
      data-testid={props['data-testid']}
      style={{
        width: 42, height: 42,
        background: '#EFE3C3',
        border: '1px solid #C9B58C',
        color: '#4D3A1F', borderRadius: 10,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'inherit', opacity: disabled ? 0.5 : 1,
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{icon}</span>
    </button>
  )
}
