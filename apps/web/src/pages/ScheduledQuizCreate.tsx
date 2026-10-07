import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { createScheduledQuiz, listScheduledQuizzes } from '../api/scheduledQuiz'

interface QuizSetItem {
  id: string
  name: string
  questionCount: number
  createdAt?: string
}

const fmtDateVi = (iso: string): string => {
  try {
    const d = new Date(iso)
    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']
    const dd = d.getDate().toString().padStart(2, '0')
    const mm = (d.getMonth() + 1).toString().padStart(2, '0')
    const yyyy = d.getFullYear()
    const hh = d.getHours().toString().padStart(2, '0')
    const min = d.getMinutes().toString().padStart(2, '0')
    return `${days[d.getDay()]}, ${dd}/${mm}/${yyyy} · ${hh}:${min}`
  } catch { return iso }
}

const relTime = (iso?: string): string => {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  const days = Math.floor(ms / 86400000)
  if (days < 1) return 'hôm nay'
  if (days === 1) return 'hôm qua'
  if (days < 7) return `${days} ngày trước`
  return `${Math.floor(days / 7)} tuần trước`
}

type DeadlinePreset = '24h' | '7d' | '14d' | 'custom'

const computeDeadline = (preset: DeadlinePreset, customIso?: string): string => {
  const now = new Date()
  if (preset === '24h') return new Date(now.getTime() + 24 * 3600 * 1000).toISOString().slice(0, 19)
  if (preset === '7d') return new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 19)
  if (preset === '14d') return new Date(now.getTime() + 14 * 24 * 3600 * 1000).toISOString().slice(0, 19)
  return customIso ?? new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 19)
}

const ScheduledQuizCreate: React.FC = () => {
  const { t } = useTranslation()
  const { id: groupId } = useParams()
  const navigate = useNavigate()

  const [quizSets, setQuizSets] = useState<QuizSetItem[]>([])
  const [selectedSetId, setSelectedSetId] = useState<string>('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [preset, setPreset] = useState<DeadlinePreset>('7d')
  const [customDeadline, setCustomDeadline] = useState('')
  const [maxAttempts, setMaxAttempts] = useState(3)
  const [isLeaderboardPublic, setIsLeaderboardPublic] = useState(true)
  const [sendNotifications, setSendNotifications] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeCount, setActiveCount] = useState(0)

  const atMaxActive = activeCount >= 3

  const [showQuizSetPicker, setShowQuizSetPicker] = useState(false)

  useEffect(() => {
    if (!groupId) return
    api.get(`/api/groups/${groupId}/quiz-sets`).then(res => {
      if (res.data.success) {
        setQuizSets(res.data.quizSets.map((qs: any) => ({
          id: qs.id, name: qs.name,
          questionCount: Array.isArray(qs.questionIds) ? qs.questionIds.length : 0,
          createdAt: qs.createdAt,
        })))
        if (res.data.quizSets.length > 0) setSelectedSetId(res.data.quizSets[0].id)
      }
    }).catch(() => {})
    listScheduledQuizzes(groupId, 'ACTIVE').then(qs => setActiveCount(qs.length)).catch(() => {})
  }, [groupId])

  const deadline = useMemo(() => computeDeadline(preset, customDeadline), [preset, customDeadline])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!groupId || !selectedSetId || atMaxActive) return
    setSubmitting(true)
    setError(null)
    try {
      const created = await createScheduledQuiz(groupId, {
        quizSetId: selectedSetId,
        name: name.trim() || undefined,
        description: description.trim() || undefined,
        deadline,
        maxAttempts,
        isLeaderboardPublic,
        sendNotifications,
      })
      navigate(`/groups/${groupId}/scheduled-quizzes/${created.id}`, { replace: true })
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Không thể tạo quiz'
      const code = err?.response?.data?.code
      setError(code === 'MAX_ACTIVE_QUIZZES_REACHED' ? t('scheduledQuiz.maxActiveError') : msg)
      setSubmitting(false)
    }
  }

  if (!groupId) return null

  return (
    <div className="min-h-screen bg-bq-paper text-bq-ink px-4 py-6 max-w-3xl mx-auto" data-testid="scheduled-quiz-create">
      <div className="mb-5 flex items-center gap-3">
        <button onClick={() => navigate(`/groups/${groupId}`)} className="text-bq-ink2 hover:text-bq-ink" aria-label="Back">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div>
          <h1 className="text-xl font-bold font-display flex items-center gap-2">
            <span className="material-symbols-outlined text-bq-sapphire">schedule</span>
            {t('scheduledQuiz.createTitle')}
          </h1>
          <p className="text-bq-ink2 text-xs">{t('scheduledQuiz.createSubtitle')}</p>
        </div>
      </div>

      {atMaxActive && (
        <div data-testid="max-active-banner" className="mb-4 px-4 py-3 rounded-xl bg-error/10 border border-error/30 text-error text-sm">
          {t('scheduledQuiz.maxActiveBanner')}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-bq-white border border-bq-hair shadow-bq-soft rounded-2xl p-5 space-y-4">
        <div>
          <label className="flex items-center gap-1.5 text-xs font-bold mb-1.5">
            {t('scheduledQuiz.fieldName')} <span className="text-error">*</span>
            <span className="ml-auto font-normal text-bq-ink3 text-[11px]">Ngắn gọn, dễ nhớ</span>
          </label>
          <input
            value={name} onChange={e => setName(e.target.value)} required
            className="w-full bg-bq-white border border-bq-hair text-bq-ink placeholder:text-bq-ink3 rounded-lg px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-bq-sapphire outline-none"
            placeholder={t('scheduledQuiz.fieldNamePlaceholder')}
          />
        </div>
        <div>
          <label className="flex items-center gap-1.5 text-xs font-bold mb-1.5">
            {t('scheduledQuiz.fieldDescription')}
            <span className="ml-auto font-normal text-bq-ink3 text-[11px]">Tùy chọn</span>
          </label>
          <textarea
            value={description} onChange={e => setDescription(e.target.value)} rows={2}
            className="w-full bg-bq-white border border-bq-hair text-bq-ink placeholder:text-bq-ink3 rounded-lg px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-bq-sapphire outline-none resize-vertical"
            placeholder="Vd: Ôn lại bài Chúa Nhật về Áp-ra-ham..."
          />
        </div>
        <div>
          <label className="block text-xs font-bold mb-1.5">{t('scheduledQuiz.fieldQuizSet')} <span className="text-error">*</span></label>
          {/* Custom card selector matching mockup */}
          <button type="button" onClick={() => setShowQuizSetPicker(p => !p)}
            className="w-full rounded-lg px-3.5 py-3 flex items-center gap-3 bg-bq-inset border border-bq-hair hover:brightness-95 transition">
            <div className="w-9 h-9 rounded-lg grid place-items-center flex-shrink-0 bg-bq-sapphire/10 border border-bq-sapphire/25">
              <span className="material-symbols-outlined text-[18px] text-bq-sapphire">collections_bookmark</span>
            </div>
            <div className="flex-1 text-left min-w-0">
              {(() => {
                const sel = quizSets.find(q => q.id === selectedSetId)
                if (!sel) return <div className="text-[13px] text-bq-ink2">{t('scheduledQuiz.noQuizSets')}</div>
                return (
                  <>
                    <div className="text-[13px] font-bold truncate">{sel.name}</div>
                    <div className="text-[11px] text-bq-ink2 mt-0.5">
                      {sel.questionCount} câu · {relTime(sel.createdAt)}
                    </div>
                  </>
                )
              })()}
            </div>
            <span className="material-symbols-outlined text-bq-ink2 text-[18px]">{showQuizSetPicker ? 'expand_less' : 'expand_more'}</span>
          </button>
          {showQuizSetPicker && quizSets.length > 1 && (
            <div className="mt-1.5 rounded-lg overflow-hidden bg-bq-white border border-bq-hair">
              {quizSets.map(qs => (
                <button key={qs.id} type="button"
                  onClick={() => { setSelectedSetId(qs.id); setShowQuizSetPicker(false) }}
                  className={`w-full text-left px-3.5 py-2.5 hover:bg-bq-inset transition ${qs.id === selectedSetId ? 'bg-bq-amber/10' : ''}`}>
                  <div className="text-[12px] font-semibold truncate">{qs.name}</div>
                  <div className="text-[10px] text-bq-ink2 mt-0.5">{qs.questionCount} câu · {relTime(qs.createdAt)}</div>
                </button>
              ))}
            </div>
          )}
          <div className="text-[11px] text-bq-ink2 mt-1.5">
            Chỉ chọn được Quiz Set của nhóm.{' '}
            <button type="button" onClick={() => navigate(`/groups/${groupId}?tab=quizsets`)} className="text-bq-amberd hover:underline">
              Tạo Quiz Set mới →
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold mb-1.5">{t('scheduledQuiz.fieldDeadline')} <span className="text-error">*</span></label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {(['24h', '7d', '14d', 'custom'] as DeadlinePreset[]).map(p => (
              <button
                key={p} type="button" onClick={() => setPreset(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                  preset === p
                    ? 'bg-bq-amber/15 text-bq-amberd border border-bq-amber/40'
                    : 'bg-bq-inset text-bq-ink2 border border-bq-hair'
                }`}
              >
                {t(`scheduledQuiz.deadline_${p}`)}
              </button>
            ))}
          </div>
          {preset === 'custom' ? (
            <input
              type="datetime-local" value={customDeadline}
              onChange={e => setCustomDeadline(e.target.value)}
              className="w-full bg-bq-white border border-bq-hair text-bq-ink rounded-lg px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-bq-sapphire outline-none"
            />
          ) : (
            <input readOnly value={fmtDateVi(deadline)}
              className="w-full rounded-lg px-3.5 py-2.5 text-sm cursor-default tabular-nums bg-bq-inset border border-bq-hair text-bq-ink2"
            />
          )}
          <p className="text-bq-ink2 text-[11px] mt-1.5 leading-relaxed">
            Sau hạn chót, leaderboard tự động đóng và công bố winner. Không cho chơi sau deadline.
          </p>
        </div>
        <div className="bg-bq-inset rounded-xl p-3 space-y-3">
          <ToggleRow label={t('scheduledQuiz.toggle3Attempts')} desc={t('scheduledQuiz.toggle3AttemptsDesc')}
            value={maxAttempts === 3} onChange={v => setMaxAttempts(v ? 3 : 1)} />
          <ToggleRow label={t('scheduledQuiz.togglePush')} desc={t('scheduledQuiz.togglePushDesc')}
            value={sendNotifications} onChange={setSendNotifications} />
          <ToggleRow label={t('scheduledQuiz.togglePublicLb')} desc={t('scheduledQuiz.togglePublicLbDesc')}
            value={isLeaderboardPublic} onChange={setIsLeaderboardPublic} />
        </div>

        {error && <div className="text-error text-sm">{error}</div>}

        <div className="flex gap-2.5">
          <button type="button" onClick={() => navigate(`/groups/${groupId}`)}
            className="rounded-xl px-5 py-3.5 text-sm font-bold bg-bq-inset text-bq-ink2 border border-bq-hair">
            Hủy
          </button>
          <button
            type="submit" disabled={submitting || atMaxActive || !selectedSetId}
            data-testid="submit-create"
            className="flex-1 py-3.5 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed bg-bq-action text-bq-ink shadow-bq-action"
          >
            <span className="material-symbols-outlined text-base">schedule</span>
            {submitting ? '...' : t('scheduledQuiz.submitCta')}
          </button>
        </div>
      </form>
    </div>
  )
}

const ToggleRow: React.FC<{ label: string; desc?: string; value: boolean; onChange: (v: boolean) => void }> = ({ label, desc, value, onChange }) => (
  <div className="flex items-center gap-3">
    <div className="flex-1">
      <div className="text-sm font-medium">{label}</div>
      {desc && <div className="text-bq-ink2 text-[11px]">{desc}</div>}
    </div>
    <button type="button" onClick={() => onChange(!value)}
      className={`w-10 h-6 rounded-full relative transition ${value ? 'bg-bq-amber' : 'bg-bq-hair'}`}
      aria-pressed={value}
    >
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition ${value ? 'left-[18px]' : 'left-0.5'}`} />
    </button>
  </div>
)

export default ScheduledQuizCreate
