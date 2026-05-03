import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { getQuizLanguage } from '../utils/quizLanguage'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../store/authStore'
import { api } from '../api/client'

const FILL_1: React.CSSProperties = { fontVariationSettings: "'FILL' 1" }

const MODES = [
  { id: 'SPEED_RACE',   icon: 'bolt',              labelKey: 'room.modes.speed_race',   descKey: 'createRoom.modeDesc.speed_race',   color: '#3b82f6' },
  { id: 'BATTLE_ROYALE',icon: 'favorite',           labelKey: 'room.modes.battle_royale',descKey: 'createRoom.modeDesc.battle_royale',color: '#ef4444' },
  { id: 'TEAM_VS_TEAM', icon: 'groups',             labelKey: 'room.modes.team_vs_team', descKey: 'createRoom.modeDesc.team_vs_team', color: '#22c55e' },
  { id: 'SUDDEN_DEATH', icon: 'workspace_premium',  labelKey: 'room.modes.sudden_death', descKey: 'createRoom.modeDesc.sudden_death', color: '#a855f7' },
] as const

const QUESTION_COUNTS = [10, 15, 20, 30]
const TIME_OPTIONS = [10, 15, 20, 30]
const DIFFICULTY_OPTIONS = [
  { value: 'EASY',   labelKey: 'practice.easy' },
  { value: 'MEDIUM', labelKey: 'practice.medium' },
  { value: 'HARD',   labelKey: 'practice.hard' },
  { value: 'MIXED',  labelKey: 'practice.mixed' },
]

const BOOK_SCOPE_OPTIONS = [
  { value: 'ALL',           label: 'Tất cả (66 sách)' },
  { value: 'OLD_TESTAMENT', label: 'Cựu Ước (39 sách)' },
  { value: 'NEW_TESTAMENT', label: 'Tân Ước (27 sách)' },
  { value: 'GOSPELS',       label: '4 Phúc Âm' },
]

export default function CreateRoom() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    roomName: '',
    mode: 'SPEED_RACE',
    questionCount: 10,
    timePerQuestion: 15,
    difficulty: 'MIXED',
    maxPlayers: 8,
    isPublic: false,
    bookScope: 'ALL',
    questionSource: 'DATABASE',
  })

  useEffect(() => {
    if (!isAuthenticated) navigate('/login', { replace: true })
  }, [isAuthenticated, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await api.post('/api/rooms', { ...formData, language: getQuizLanguage() })
      const room = res.data.room
      navigate(`/room/${room.id}/lobby`, { state: { room, mode: formData.mode } })
    } catch (err: any) {
      setError(err?.response?.data?.message || t('createRoom.error'))
    } finally {
      setLoading(false)
    }
  }

  if (!isAuthenticated) return null

  const selectedMode = MODES.find(m => m.id === formData.mode)!

  return (
    <div data-testid="create-room-page" className="flex justify-center">
      <div className="w-full max-w-[560px] space-y-6">
        {/* Back link */}
        <Link to="/multiplayer" className="inline-flex items-center gap-2 text-on-surface-variant hover:text-on-surface text-sm transition-colors">
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          {t('common.back')}
        </Link>

        <form onSubmit={handleSubmit} className="glass-card rounded-xl p-6 md:p-8 space-y-8">
          {/* Header — centered */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-2">
              <span className="text-2xl">🎮</span>
              <h1 className="text-2xl font-bold text-on-surface tracking-tight">{t('createRoom.title')}</h1>
            </div>
            <div className="h-0.5 w-[60px] gold-gradient mx-auto rounded-full" />
          </div>

          {/* Room name */}
          <section className="space-y-2">
            <label className="text-sm font-medium text-on-surface-variant">{t('createRoom.roomName')}</label>
            <input
              type="text"
              value={formData.roomName}
              onChange={(e) => setFormData(prev => ({ ...prev, roomName: e.target.value }))}
              placeholder={t('createRoom.roomNamePlaceholder')}
              data-testid="create-room-name-input"
              className="w-full bg-surface-container-highest border border-transparent rounded-lg px-4 py-3 text-on-surface placeholder:text-on-surface-variant/40 focus:ring-1 focus:ring-secondary/60 focus:border-secondary/40 outline-none transition-all"
            />
            <p className="text-xs text-on-surface-variant/60 italic">Để trống để dùng tên mặc định</p>
          </section>

          {/* Game mode — 4-col tall cards */}
          <section className="space-y-4">
            <label className="text-sm font-medium text-on-surface-variant">{t('createRoom.gameMode')}</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="create-room-mode-select">
              {MODES.map((m) => {
                const active = formData.mode === m.id
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, mode: m.id }))}
                    aria-pressed={active}
                    className="relative flex flex-col items-center justify-center text-center p-3 h-[140px] rounded-xl glass-card border transition-all active:scale-95"
                    style={{
                      borderColor: active ? '#f8bd45' : 'transparent',
                      boxShadow: active ? '0 0 16px rgba(248,189,69,0.2)' : undefined,
                    }}
                  >
                    {/* Color accent bar at top */}
                    <div
                      className="absolute top-0 left-0 w-full h-1 rounded-t-xl transition-opacity"
                      style={{ background: m.color, opacity: active ? 1 : 0.4 }}
                    />
                    <span
                      className="material-symbols-outlined text-3xl mb-2"
                      style={{ color: m.color, ...FILL_1 }}
                    >
                      {m.icon}
                    </span>
                    <span className={`text-sm leading-snug ${active ? 'font-bold text-on-surface' : 'font-medium text-on-surface-variant'}`}>
                      {t(m.labelKey)}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Mode description banner */}
            <div
              className="p-3 rounded-lg border-l-4 flex items-start gap-3"
              style={{
                background: 'rgba(255,255,255,0.03)',
                borderColor: selectedMode.color,
              }}
            >
              <span className="material-symbols-outlined text-lg mt-0.5" style={{ color: selectedMode.color }}>info</span>
              <p className="text-xs text-on-surface-variant italic leading-relaxed">{t(selectedMode.descKey)}</p>
            </div>
          </section>

          {/* Question source */}
          <section className="space-y-3">
            <label className="text-sm font-medium text-on-surface-variant">Nguồn câu hỏi</label>
            <div className="grid grid-cols-2 gap-3" data-testid="question-source-select">
              {([
                { value: 'DATABASE', icon: 'library_books', label: 'Ngân hàng hệ thống', desc: 'Câu hỏi từ kho Kinh Thánh' },
                { value: 'CUSTOM',   icon: 'edit_note',     label: 'Tự tạo câu hỏi',    desc: 'AI hoặc thủ công trong phòng chờ' },
              ] as const).map((src) => {
                const active = formData.questionSource === src.value
                return (
                  <button
                    key={src.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, questionSource: src.value }))}
                    aria-pressed={active}
                    className="relative flex flex-col items-start gap-2 p-4 rounded-xl glass-card border transition-all text-left active:scale-[0.98]"
                    style={{
                      borderColor: active ? '#f8bd45' : 'transparent',
                      boxShadow: active ? '0 0 12px rgba(248,189,69,0.15)' : undefined,
                    }}
                  >
                    <span
                      className="material-symbols-outlined text-xl"
                      style={{ color: active ? '#f8bd45' : undefined, ...FILL_1 }}
                    >
                      {src.icon}
                    </span>
                    <div>
                      <p className={`text-sm leading-tight ${active ? 'font-bold text-on-surface' : 'font-medium text-on-surface-variant'}`}>
                        {src.label}
                      </p>
                      <p className="text-[11px] text-on-surface-variant/50 mt-0.5 leading-snug">{src.desc}</p>
                    </div>
                    {active && (
                      <span className="absolute top-2.5 right-2.5 material-symbols-outlined text-[14px] text-[#f8bd45]" style={FILL_1}>check_circle</span>
                    )}
                  </button>
                )
              })}
            </div>
            {formData.questionSource === 'CUSTOM' && (
              <p className="text-xs text-secondary/80 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm">info</span>
                Bạn sẽ tạo câu hỏi trong phòng chờ. Số câu hỏi sẽ theo danh sách bạn tạo.
              </p>
            )}
          </section>

          {/* Settings grid: left = questions+time, right = difficulty+book */}
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 transition-opacity ${formData.questionSource === 'CUSTOM' ? 'opacity-40 pointer-events-none' : ''}`}>
            {/* Left column */}
            <div className="space-y-6">
              {/* Question count */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-on-surface-variant">{t('createRoom.questionCount')}</label>
                <div className="flex bg-surface-container-highest p-1 rounded-lg">
                  {QUESTION_COUNTS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, questionCount: n }))}
                      className={`flex-1 py-1.5 text-xs rounded-md transition-all ${
                        formData.questionCount === n
                          ? 'font-bold bg-[#f8bd45] text-[#11131e] shadow-sm'
                          : 'font-medium text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time per question */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-on-surface-variant">{t('createRoom.timePerQuestion')}</label>
                <div className="flex bg-surface-container-highest p-1 rounded-lg">
                  {TIME_OPTIONS.map((tp) => (
                    <button
                      key={tp}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, timePerQuestion: tp }))}
                      className={`flex-1 py-1.5 text-xs rounded-md transition-all ${
                        formData.timePerQuestion === tp
                          ? 'font-bold bg-[#f8bd45] text-[#11131e] shadow-sm'
                          : 'font-medium text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      {tp}s
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right column */}
            <div className="space-y-6">
              {/* Difficulty */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-on-surface-variant">{t('createRoom.difficulty')}</label>
                <div className="flex bg-surface-container-highest p-1 rounded-lg">
                  {DIFFICULTY_OPTIONS.map((d) => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, difficulty: d.value }))}
                      className={`flex-1 py-1.5 text-xs rounded-md transition-all ${
                        formData.difficulty === d.value
                          ? 'font-bold bg-[#f8bd45] text-[#11131e] shadow-sm'
                          : 'font-medium text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      {t(d.labelKey)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Book scope */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-on-surface-variant">
                  {t('createRoom.bookScope', 'Sách Kinh Thánh')}
                </label>
                <select
                  value={formData.bookScope}
                  onChange={(e) => setFormData(prev => ({ ...prev, bookScope: e.target.value }))}
                  className="w-full bg-surface-container-highest border border-transparent rounded-lg py-2.5 px-4 text-sm text-on-surface appearance-none outline-none focus:ring-1 focus:ring-secondary/50 cursor-pointer"
                >
                  {BOOK_SCOPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Advanced settings (collapsible) */}
          <div className="pt-4 border-t border-outline-variant/10">
            <details className="group">
              <summary className="flex items-center gap-2 cursor-pointer list-none text-sm text-on-surface-variant/80 hover:text-on-surface transition-colors select-none">
                <span className="material-symbols-outlined text-base transition-transform group-open:rotate-180">expand_more</span>
                <span>⚙️ {t('createRoom.advanced', 'Nâng cao')}</span>
              </summary>

              <div className="pt-6 space-y-6">
                {/* Max players slider */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-on-surface-variant">{t('createRoom.maxPlayers')}</label>
                    <span className="px-3 py-1 bg-secondary/10 text-secondary rounded-full text-xs font-bold">{formData.maxPlayers}</span>
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={20}
                    value={formData.maxPlayers}
                    onChange={(e) => setFormData(prev => ({ ...prev, maxPlayers: parseInt(e.target.value) }))}
                    className="w-full accent-[#e8a832] h-2 rounded-full appearance-none bg-surface-container-highest cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-on-surface-variant/40">
                    <span>2</span>
                    <span>20</span>
                  </div>
                </div>

                {/* Visibility toggle */}
                <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-on-surface">
                      {formData.isPublic ? t('createRoom.isPublic') : t('createRoom.isPrivate')}
                    </p>
                    <p className="text-xs text-on-surface-variant/60">
                      {formData.isPublic ? t('createRoom.publicDesc') : t('createRoom.privateDesc')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, isPublic: !prev.isPublic }))}
                    className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${formData.isPublic ? 'bg-secondary' : 'bg-surface-container-highest'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white shadow-md absolute top-1 transition-transform ${formData.isPublic ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>
              </div>
            </details>
          </div>

          {/* Error */}
          {error && (
            <div className="p-4 rounded-xl bg-error/10 border border-error/20 flex items-center gap-3">
              <span className="material-symbols-outlined text-error">error</span>
              <p className="text-sm text-error">{error}</p>
            </div>
          )}

          {/* CTA */}
          <div className="space-y-4 pt-2">
            <button
              data-testid="create-room-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full h-12 gold-gradient rounded-xl font-bold text-[#11131e] flex items-center justify-center gap-2 shadow-[0_8px_30px_rgba(248,189,69,0.2)] hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
                  {t('createRoom.creating')}
                </>
              ) : (
                <>
                  <span>{t('createRoom.create')}</span>
                  <span className="material-symbols-outlined text-xl" style={FILL_1}>play_circle</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
