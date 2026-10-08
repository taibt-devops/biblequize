// CRR-2 — Create Room page, 2-column redesign per
// docs/MULTIPLAYER/create_room_redesign.html. Left column = 4 setting cards,
// right column = sticky <PreviewPanel/> that owns the submit CTA.
// data-testids + i18n keys + form behaviour are kept intact for E2E +
// CreateRoom.test.tsx (15 vitest specs).

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getQuizLanguage } from '../utils/quizLanguage'
import { useAuth } from '../store/authStore'
import { api } from '../api/client'
import PreviewPanel from './create-room/PreviewPanel'
import BookScopeOptions, { useBookScopeLabel } from './create-room/BookScopeOptions'
import { MODE_DEFAULTS, MODE_LIST, MODE_META, type RoomModeId } from './create-room/modeMeta'

const QUESTION_COUNTS = [10, 15, 20, 30]
const TIME_OPTIONS = [10, 15, 20, 30]
const DIFFICULTY_OPTIONS = [
  { value: 'EASY',   labelKey: 'practice.easy' },
  { value: 'MEDIUM', labelKey: 'practice.medium' },
  { value: 'HARD',   labelKey: 'practice.hard' },
  { value: 'MIXED',  labelKey: 'practice.mixed' },
] as const

const CARD_CLASS = 'bg-bq-white border border-bq-hair shadow-bq-soft rounded-[18px]'

export default function CreateRoom() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const resolveScopeLabel = useBookScopeLabel()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    roomName: '',
    mode: 'SPEED_RACE' as RoomModeId,
    questionCount: MODE_DEFAULTS.SPEED_RACE.questionCount,
    timePerQuestion: MODE_DEFAULTS.SPEED_RACE.timePerQuestion,
    difficulty: 'MIXED',
    maxPlayers: MODE_DEFAULTS.SPEED_RACE.maxPlayers,
    isPublic: true,
    bookScope: 'ALL',
    questionSource: 'DATABASE' as 'DATABASE' | 'CUSTOM',
    questionSetId: null as string | null,
    // HPT-1: opt-in host-plays. Default false = Quản trò (host điều phối, không
    // chơi) — giữ nguyên hành vi luồng đa người chơi hiện tại. Khi true →
    // backend thêm host làm RoomPlayer (RoomController đọc body.hostPlaysGame).
    hostPlaysGame: false,
  })

  const { data: setsData } = useQuery({
    queryKey: ['my-sets', 'published'],
    queryFn: () => api.get('/api/question-sets', { params: { status: 'PUBLISHED' } }).then(r => r.data),
    enabled: formData.questionSource === 'CUSTOM',
  })
  const userSets: { id: string; name: string; questionCount: number; visibility: string }[] = setsData?.sets ?? []
  const selectedSet = userSets.find(s => s.id === formData.questionSetId) ?? null

  useEffect(() => {
    if (!isAuthenticated) navigate('/login', { replace: true })
  }, [isAuthenticated, navigate])

  const validateRoomName = (name: string): string | null => {
    if (name.length === 0) return null
    if (name.length < 5) return 'Tên phòng phải có ít nhất 5 ký tự'
    if (name.length > 60) return 'Tên phòng tối đa 60 ký tự'
    if (/^(.)\1+$/.test(name)) return 'Tên phòng không hợp lệ (không thể chỉ một ký tự lặp lại)'
    return null
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const nameError = validateRoomName(formData.roomName.trim())
    if (nameError) { setError(nameError); return; }
    setLoading(true)
    setError(null)
    try {
      const payload: Record<string, unknown> = { ...formData, roomName: formData.roomName.trim(), language: getQuizLanguage() }
      if (formData.questionSource !== 'CUSTOM' || !formData.questionSetId) {
        delete payload.questionSetId
      }
      const res = await api.post('/api/rooms', payload)
      const room = res.data.room
      navigate(`/room/${room.id}/lobby`, { state: { room, mode: formData.mode, viewerUserId: res.data.viewerUserId } })
    } catch (err: any) {
      setError(err?.response?.data?.message || t('createRoom.error'))
    } finally {
      setLoading(false)
    }
  }

  if (!isAuthenticated) return null

  const selectedMode = MODE_META[formData.mode]
  const difficultyLabel = t(DIFFICULTY_OPTIONS.find(d => d.value === formData.difficulty)?.labelKey ?? 'practice.mixed')
  const bookScopeLabel = resolveScopeLabel(formData.bookScope)
  const canSubmit = !(formData.questionSource === 'CUSTOM' && !formData.questionSetId)

  return (
    <div data-testid="create-room-page" className="flex justify-center">
      <div className="w-full max-w-[1280px] space-y-6">

        {/* ── Top row: back + Quản trò chip ── */}
        <div className="flex justify-between items-center gap-4 flex-wrap">
          <Link
            to="/multiplayer"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[10px] text-sm text-bq-ink2 hover:text-bq-ink transition-colors border border-bq-hair"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
            Quay lại
          </Link>
          <div
            data-testid="create-room-organizer-hint"
            className={`inline-flex items-center gap-2.5 px-3.5 py-2 rounded-full text-[13px] font-medium ${formData.hostPlaysGame ? 'text-bq-sapphire' : 'text-bq-amberd'}`}
            style={formData.hostPlaysGame ? {
              background: 'linear-gradient(135deg, rgba(37,99,235,0.16), rgba(37,99,235,0.05))',
              border: '1px solid rgba(37,99,235,0.30)',
            } : {
              background: 'linear-gradient(135deg, rgba(245,158,11,0.18), rgba(245,158,11,0.06))',
              border: '1px solid rgba(245,158,11,0.32)',
            }}
          >
            <span className={`material-symbols-outlined ${formData.hostPlaysGame ? 'text-bq-sapphire' : 'text-bq-amber'}`} style={{ fontSize: 16 }}>
              {formData.hostPlaysGame ? 'sports_esports' : 'workspace_premium'}
            </span>
            <span>{formData.hostPlaysGame ? t('createRoom.hostPlaysHint') : t('createRoom.organizerHint')}</span>
          </div>
        </div>

        {/* ── Title ── */}
        <div>
          <h1 className="text-[30px] font-display font-extrabold text-bq-ink tracking-tight flex items-center gap-3.5 m-0">
            <span
              className="inline-flex items-center justify-center text-bq-amber"
              style={{
                width: 44, height: 44,
                background: 'linear-gradient(135deg, rgba(245,158,11,0.22), rgba(245,158,11,0.06))',
                borderRadius: 12,
                border: '1px solid rgba(245,158,11,0.3)',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 24, fontVariationSettings: "'FILL' 1" }}>videogame_asset</span>
            </span>
            {t('createRoom.title')}
          </h1>
          <p className="text-[14.5px] text-bq-ink2 pl-[58px] mt-1.5">
            Mời bạn bè và điều phối trận đấu Kinh Thánh
          </p>
        </div>

        {/* ── Main grid ── */}
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] gap-6 items-start">

          {/* ═════ LEFT COLUMN ═════ */}
          <div className="space-y-4">

            {/* Card 1: Name + Mode */}
            <section className={`p-[22px_24px] ${CARD_CLASS}`}>
              <CardLabel>Tên phòng</CardLabel>
              <input
                type="text"
                value={formData.roomName}
                onChange={(e) => setFormData(prev => ({ ...prev, roomName: e.target.value }))}
                placeholder={t('createRoom.roomNamePlaceholder')}
                data-testid="create-room-name-input"
                maxLength={60}
                className="w-full px-3.5 py-3 rounded-[10px] text-[15px] bg-bq-white border border-bq-hair text-bq-ink placeholder:text-bq-ink3 outline-none transition-all focus:ring-2 focus:ring-bq-sapphire"
              />
              <p className="text-xs text-bq-ink3 mt-1.5">
                {formData.roomName.length === 0 ? 'Để trống để dùng tên mặc định' : `${formData.roomName.length}/60`}
              </p>

              <div className="mt-5">
                <CardLabel>Chế độ chơi</CardLabel>
                <div data-testid="create-room-mode-select" className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {MODE_LIST.map(m => {
                    const active = formData.mode === m.id
                    return (
                      <button
                        key={m.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => {
                          const d = MODE_DEFAULTS[m.id]
                          setFormData(prev => ({
                            ...prev, mode: m.id,
                            questionCount: d.questionCount,
                            timePerQuestion: d.timePerQuestion,
                            maxPlayers: d.maxPlayers,
                          }))
                        }}
                        className={`relative rounded-[14px] p-4 pb-3.5 text-left overflow-hidden transition-all hover:-translate-y-0.5 ${active ? '' : 'bg-bq-inset'}`}
                        style={{
                          background: active
                            ? `linear-gradient(135deg, ${hexToRgba(m.color, 0.18)}, ${hexToRgba(m.color, 0.04)})`
                            : undefined,
                          border: `1.5px solid ${active ? m.color : '#C9B58C'}`,
                          boxShadow: active ? `0 0 0 1px ${m.color}, 0 10px 28px -10px ${m.color}` : undefined,
                        }}
                      >
                        <div
                          className="inline-flex items-center justify-center rounded-[10px] mb-2.5"
                          style={{
                            width: 32, height: 32,
                            background: hexToRgba(m.color, 0.18),
                            color: m.color,
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 18, fontVariationSettings: "'FILL' 1" }}>{m.icon}</span>
                        </div>
                        <div className="text-sm font-semibold text-bq-ink leading-tight">{t(m.labelKey)}</div>
                        {active && (
                          <span
                            className="material-symbols-outlined absolute top-2.5 right-2.5"
                            style={{ fontSize: 16, color: m.color, fontVariationSettings: "'FILL' 1" }}
                          >check_circle</span>
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Mode description banner */}
                <div
                  className="mt-3 px-3.5 py-2.5 rounded-lg flex items-center gap-2.5 text-[13px] text-bq-ink2 bg-bq-inset"
                  style={{
                    borderLeft: `3px solid ${selectedMode.color}`,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: selectedMode.color }}>info</span>
                  <span>{t(selectedMode.descKey)}</span>
                </div>
              </div>
            </section>

            {/* Card 2: Question source */}
            <section className={`p-[22px_24px] ${CARD_CLASS}`}>
              <CardLabel>Nguồn câu hỏi</CardLabel>
              <div data-testid="question-source-select" className="grid grid-cols-2 gap-2 mb-3.5">
                {([
                  { value: 'DATABASE' as const, icon: 'library_books', title: 'Ngân hàng hệ thống', sub: 'Toàn bộ Kinh Thánh' },
                  { value: 'CUSTOM'   as const, icon: 'edit_note',     title: 'Tự tạo câu hỏi',     sub: 'AI hoặc thủ công trong phòng chờ' },
                ]).map(src => {
                  const active = formData.questionSource === src.value
                  return (
                    <button
                      key={src.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setFormData(prev => ({ ...prev, questionSource: src.value }))}
                      className={`flex items-center gap-3 px-3.5 py-3 rounded-[12px] text-left transition-all ${active ? '' : 'bg-bq-inset'}`}
                      style={{
                        background: active
                          ? 'linear-gradient(135deg, rgba(245,158,11,0.18), rgba(245,158,11,0.06))'
                          : undefined,
                        border: `1.5px solid ${active ? 'rgba(245,158,11,0.5)' : '#C9B58C'}`,
                      }}
                    >
                      <span
                        className={`inline-flex items-center justify-center rounded-[9px] ${active ? 'text-bq-amber' : 'text-bq-ink3'}`}
                        style={{
                          width: 36, height: 36,
                          background: active ? 'rgba(245,158,11,0.2)' : '#EFE3C3',
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{src.icon}</span>
                      </span>
                      <div className="min-w-0">
                        <div className={`text-sm font-semibold ${active ? 'text-bq-ink' : 'text-bq-ink2'}`}>{src.title}</div>
                        <div className="text-[11.5px] text-bq-ink2 mt-0.5">{src.sub}</div>
                      </div>
                    </button>
                  )
                })}
              </div>

              {formData.questionSource === 'CUSTOM' ? (
                <>
                  <div className="flex items-center justify-between mt-3.5 mb-2">
                    <span className="text-[12.5px] font-bold text-bq-ink2">Bộ câu hỏi</span>
                    <Link to="/my-sets/new" className="inline-flex items-center gap-1 text-[13px] font-semibold text-bq-amberd hover:text-bq-amber">
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
                      Tạo bộ mới
                    </Link>
                  </div>
                  {userSets.length === 0 ? (
                    <div className="p-3.5 rounded-[12px] text-center bg-bq-inset border border-dashed border-bq-hair">
                      <p className="text-xs text-bq-ink2">Chưa có bộ câu hỏi nào đã xuất bản.</p>
                      <Link to="/my-sets/new" className="text-xs text-bq-amberd hover:underline mt-1 inline-block">Soạn bộ mới →</Link>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[260px] overflow-y-auto pr-0.5">
                      {userSets.map(set => {
                        const active = formData.questionSetId === set.id
                        return (
                          <button
                            key={set.id}
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, questionSetId: active ? null : set.id }))}
                            className={`w-full flex items-center gap-3.5 p-3.5 rounded-[12px] text-left transition-all ${active ? '' : 'bg-bq-inset'}`}
                            style={{
                              background: active
                                ? 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.04))'
                                : undefined,
                              border: `1.5px solid ${active ? 'rgba(245,158,11,0.5)' : '#C9B58C'}`,
                            }}
                          >
                            <span
                              className="inline-flex items-center justify-center rounded-[10px] text-bq-amber"
                              style={{ width: 42, height: 42, background: 'rgba(245,158,11,0.16)' }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>menu_book</span>
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-[15px] font-semibold text-bq-ink truncate">{set.name}</div>
                              <div className="text-xs text-bq-ink2 mt-0.5">
                                {set.questionCount} câu · {set.visibility === 'PUBLIC' ? 'Công khai' : 'Riêng tư'}
                              </div>
                            </div>
                            {active && (
                              <span className="material-symbols-outlined text-bq-amber" style={{ fontSize: 20 }}>check_circle</span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </>
              ) : (
                <div className="mt-3.5 flex items-center gap-3 p-3.5 rounded-[12px] text-[13px] text-bq-ink2 bg-bq-inset border border-bq-hair">
                  <span
                    className="inline-flex items-center justify-center rounded-[10px] flex-shrink-0 text-bq-sapphire"
                    style={{ width: 42, height: 42, background: 'rgba(47,111,176,0.15)' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>info</span>
                  </span>
                  <div>
                    Câu hỏi sẽ được chọn ngẫu nhiên từ <strong className="text-bq-ink">ngân hàng hệ thống</strong> theo độ khó và sách Kinh Thánh bạn chọn bên dưới.
                  </div>
                </div>
              )}
            </section>

            {/* Card 3: Match settings */}
            <section className={`p-[22px_24px] ${CARD_CLASS}`}>
              <CardLabel>Cài đặt trận đấu</CardLabel>
              {/* Vùng chọn câu hỏi — mờ đi khi dùng nguồn "Tự tạo câu hỏi" */}
              <div className={`transition-opacity ${formData.questionSource === 'CUSTOM' ? 'opacity-40 pointer-events-none' : ''}`}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-[18px]">
                <ChipGroup
                  label={t('createRoom.questionCount')}
                  options={QUESTION_COUNTS.map(n => ({ value: n, label: String(n) }))}
                  value={formData.questionCount}
                  onChange={v => setFormData(p => ({ ...p, questionCount: v }))}
                />
                <ChipGroup
                  label={t('createRoom.difficulty')}
                  options={DIFFICULTY_OPTIONS.map(d => ({ value: d.value, label: t(d.labelKey) }))}
                  value={formData.difficulty}
                  onChange={v => setFormData(p => ({ ...p, difficulty: v }))}
                />
                <ChipGroup
                  label={t('createRoom.timePerQuestion')}
                  options={TIME_OPTIONS.map(s => ({ value: s, label: `${s}s` }))}
                  value={formData.timePerQuestion}
                  onChange={v => setFormData(p => ({ ...p, timePerQuestion: v }))}
                />
                <div>
                  <div className="text-[11.5px] font-bold tracking-[0.08em] uppercase text-bq-ink2 mb-2">
                    {t('createRoom.bookScope', 'Sách Kinh Thánh')}
                  </div>
                  <div className="relative">
                    <select
                      value={formData.bookScope}
                      onChange={e => setFormData(prev => ({ ...prev, bookScope: e.target.value }))}
                      className="w-full px-3.5 py-2.5 rounded-[10px] text-sm bg-bq-white border border-bq-hair text-bq-ink appearance-none outline-none cursor-pointer pr-9 focus:ring-2 focus:ring-bq-sapphire"
                    >
                      <BookScopeOptions />
                    </select>
                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-bq-ink3" style={{ fontSize: 18 }}>
                      expand_more
                    </span>
                  </div>
                </div>
              </div>

              <div
                className="mt-4 flex items-center gap-2 px-3.5 py-2.5 rounded-[10px] text-[13px] text-bq-sapphire"
                style={{
                  background: 'rgba(47,111,176,0.08)',
                  border: '1px solid rgba(47,111,176,0.22)',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>schedule</span>
                <span>
                  Ước lượng trận đấu khoảng{' '}
                  <strong className="text-bq-sapphire">~{Math.max(1, Math.ceil(formData.questionCount * formData.timePerQuestion / 60))} phút</strong>
                </span>
              </div>
              </div>

              {/* Số người chơi tối đa — luôn bật, không phụ thuộc nguồn câu hỏi */}
              <div className="mt-[18px] pt-[18px] border-t border-bq-hair">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[11.5px] font-bold tracking-[0.08em] uppercase text-bq-ink2">
                    {t('createRoom.maxPlayers')}
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-bold text-bq-amberd" style={{ background: 'rgba(245,158,11,0.15)' }}>
                    {formData.maxPlayers}
                  </span>
                </div>
                <input
                  type="range" min={2} max={100} value={formData.maxPlayers}
                  onChange={e => setFormData(prev => ({ ...prev, maxPlayers: parseInt(e.target.value) }))}
                  className="w-full accent-bq-amber h-2 rounded-full appearance-none cursor-pointer bg-bq-inset"
                />
                <div className="flex justify-between text-[10px] text-bq-ink3 mt-1">
                  <span>2</span><span>100</span>
                </div>
              </div>
            </section>

            {/* Card 4: Privacy + Advanced */}
            <section className={`p-[22px_24px] ${CARD_CLASS}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className="inline-flex items-center justify-center rounded-[9px] text-bq-amber"
                    style={{ width: 36, height: 36, background: 'rgba(245,158,11,0.14)' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18, fontVariationSettings: "'FILL' 1" }}>
                      {formData.isPublic ? 'public' : 'lock'}
                    </span>
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-bq-ink">
                      {formData.isPublic ? t('createRoom.isPublic') : t('createRoom.isPrivate')}
                    </div>
                    <div className="text-xs text-bq-ink2 mt-0.5">
                      {formData.isPublic ? t('createRoom.publicDesc') : t('createRoom.privateDesc')}
                    </div>
                  </div>
                </div>
                {/* Toggle switch — preserves `rounded-full w-12` for vitest selector */}
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, isPublic: !prev.isPublic }))}
                  className={`relative rounded-full w-12 h-6 transition-colors flex-shrink-0 ${formData.isPublic ? 'bg-bq-action' : 'bg-bq-inset'}`}
                  aria-pressed={formData.isPublic}
                >
                  <span
                    className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform"
                    style={{
                      left: 2,
                      transform: formData.isPublic ? 'translateX(22px)' : 'translateX(0)',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                    }}
                  />
                </button>
              </div>

              {/* HPT-2: host-plays opt-in. Default off = Quản trò (không chơi). */}
              <div className="mt-[18px] pt-[18px] border-t border-bq-hair flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex items-center justify-center rounded-[9px] ${formData.hostPlaysGame ? 'text-bq-sapphire' : 'text-bq-amber'}`}
                    style={{ width: 36, height: 36, background: formData.hostPlaysGame ? 'rgba(37,99,235,0.12)' : 'rgba(245,158,11,0.14)' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18, fontVariationSettings: "'FILL' 1" }}>
                      {formData.hostPlaysGame ? 'sports_esports' : 'workspace_premium'}
                    </span>
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-bq-ink">{t('createRoom.hostPlaysTitle')}</div>
                    <div className="text-xs text-bq-ink2 mt-0.5">
                      {formData.hostPlaysGame ? t('createRoom.hostPlaysDescOn') : t('createRoom.hostPlaysDescOff')}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  data-testid="create-room-host-plays-toggle"
                  onClick={() => setFormData(prev => ({ ...prev, hostPlaysGame: !prev.hostPlaysGame }))}
                  className={`relative rounded-full w-12 h-6 transition-colors flex-shrink-0 ${formData.hostPlaysGame ? 'bg-bq-action' : 'bg-bq-inset'}`}
                  aria-pressed={formData.hostPlaysGame}
                  aria-label={t('createRoom.hostPlaysTitle')}
                >
                  <span
                    className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform"
                    style={{
                      left: 2,
                      transform: formData.hostPlaysGame ? 'translateX(22px)' : 'translateX(0)',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                    }}
                  />
                </button>
              </div>
            </section>
          </div>

          {/* ═════ RIGHT COLUMN ═════ */}
          <PreviewPanel
            mode={selectedMode}
            modeLabel={t(selectedMode.labelKey)}
            roomName={formData.roomName}
            questionCount={formData.questionCount}
            timePerQuestion={formData.timePerQuestion}
            difficultyLabel={difficultyLabel}
            bookScopeLabel={bookScopeLabel}
            isPublic={formData.isPublic}
            questionSource={formData.questionSource}
            selectedSet={selectedSet ? { name: selectedSet.name, questionCount: selectedSet.questionCount } : null}
            loading={loading}
            canSubmit={canSubmit}
            error={error}
            onSubmit={handleSubmit}
          />
        </form>
      </div>
    </div>
  )
}

// ── Local sub-components ─────────────────────────────────────────────────────

function CardLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[12.5px] font-bold text-bq-ink2 mb-2.5 flex items-center gap-2">
      {children}
    </div>
  )
}

function ChipGroup<T extends string | number>({
  label, options, value, onChange,
}: {
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div>
      <div className="text-[11.5px] font-bold tracking-[0.08em] uppercase text-bq-ink2 mb-2">{label}</div>
      <div className="flex gap-1 p-1 rounded-[10px] bg-bq-inset border border-bq-hair">
        {options.map(opt => {
          const active = opt.value === value
          return (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`flex-1 py-2 px-2 rounded-[7px] text-[13px] transition-all ${
                active
                  ? 'font-bold text-bq-ink bg-bq-action shadow-bq-action'
                  : 'font-medium text-bq-ink2 hover:text-bq-ink'
              }`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  return `rgba(${r},${g},${b},${alpha})`
}
