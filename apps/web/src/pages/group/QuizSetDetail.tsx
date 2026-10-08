import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  archiveQuizSet, cloneQuizSet, createLiveRoomFromQuizSet, deleteQuizSet,
  getMyMastery, getQuizSet, MODE_LABELS,
  publishQuizSet, type QuizSet, type QuizSetMastery,
  type RoomMode, unarchiveQuizSet,
} from '../../api/quizSets'
import ModePickerModal from '../../components/group/ModePickerModal'

const STATUS_BADGE: Record<string, { vi: string; cls: string }> = {
  DRAFT:        { vi: 'Bản nháp',     cls: 'qs-badge-draft' },
  PUBLISHED:    { vi: '✓ Đã xuất bản', cls: 'qs-badge-published' },
  ARCHIVED:     { vi: 'Đã lưu trữ',   cls: 'qs-badge-archived' },
  SOFT_DELETED: { vi: 'Đã xóa',       cls: 'qs-badge-deleted' },
}

const DIFFICULTY: Record<string, { vi: string; short: string; cls: string; emoji: string }> = {
  EASY:   { vi: 'Dễ',         short: 'Dễ',  cls: 'qs-difficulty-easy',   emoji: '🟢' },
  MEDIUM: { vi: 'Trung bình', short: 'TB',  cls: 'qs-difficulty-medium', emoji: '⚡' },
  HARD:   { vi: 'Khó',        short: 'Khó', cls: 'qs-difficulty-hard',   emoji: '🔥' },
  MIXED:  { vi: 'Tổng hợp',   short: 'Mix', cls: 'qs-difficulty-mixed',  emoji: '🎲' },
}

export default function QuizSetDetail() {
  const { t } = useTranslation()
  const { id: groupId, setId } = useParams<{ id: string; setId: string }>()
  const navigate = useNavigate()

  const [quizSet, setQuizSet] = useState<QuizSet | null>(null)
  const [mastery, setMastery] = useState<QuizSetMastery | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModePicker, setShowModePicker] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!groupId || !setId) return
    setLoading(true)
    Promise.all([
      getQuizSet(groupId, setId),
      getMyMastery(groupId, setId).catch(() => null),
    ])
      .then(([qs, m]) => { setQuizSet(qs); setMastery(m) })
      .catch(err => setError(err?.response?.data?.message || err.message))
      .finally(() => setLoading(false))
  }, [groupId, setId])

  if (loading) return (
    <div className="bg-bq-paper min-h-screen flex items-center justify-center text-bq-ink2">{t('quizSet.detail.loading')}</div>
  )
  if (error || !quizSet) return (
    <div className="bg-bq-paper min-h-screen flex items-center justify-center text-bq-ruby p-6 text-center">
      {error || t('quizSet.detail.notFound')}
    </div>
  )

  const cover = quizSet.coverImageUrl?.startsWith('emoji:') ? quizSet.coverImageUrl.slice(6) : '📖'
  const badge = STATUS_BADGE[quizSet.publishStatus]
  const diff = quizSet.difficulty ? DIFFICULTY[quizSet.difficulty] : null
  const masteryPct = quizSet.totalQuestions > 0 && mastery
    ? Math.round((mastery.questionsLearned / quizSet.totalQuestions) * 100)
    : 0
  const hasMastery = mastery && mastery.id != null && mastery.totalAttempts > 0

  const action = async (fn: () => Promise<QuizSet>, navigateTo?: string) => {
    setBusy(true); setError(null)
    try {
      const updated = await fn()
      setQuizSet(updated)
      if (navigateTo) navigate(navigateTo)
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message)
    } finally { setBusy(false) }
  }

  const startMode = async (mode: RoomMode) => {
    if (!groupId) return
    setBusy(true)
    try {
      const room = await createLiveRoomFromQuizSet(groupId, { quizSetId: quizSet.id, mode })
      navigate(`/room/${room.id}/lobby`, { state: { fromGroupId: groupId } })
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message)
    } finally { setBusy(false); setShowModePicker(false) }
  }

  return (
    <div className="bg-bq-paper min-h-screen md:flex">
      {/* Main column (mobile + desktop LEFT) */}
      <div className="flex-1 md:overflow-y-auto qs-scroll-thin qs-fade-in">
        {/* Desktop breadcrumb */}
        <div className="hidden md:flex px-8 py-4 border-b border-bq-hair items-center gap-2 text-xs">
          <Link to={`/groups/${groupId}`} className="text-bq-ink3 hover:text-bq-ink">← Nhóm</Link>
          <span className="text-bq-ink3">/</span>
          <Link to={`/groups/${groupId}/quiz-sets`} className="text-bq-ink3 hover:text-bq-ink">Bộ câu hỏi</Link>
          <span className="text-bq-ink3">/</span>
          <span className="text-bq-ink2 truncate">{quizSet.name}</span>
        </div>

        {/* Hero — h-44 mobile, h-64 desktop */}
        <div className="relative h-44 lg:h-64">
          <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, #FFE08A 0%, #F59E0B 100%)' }} />
          <div className="absolute inset-0 flex items-center justify-center text-7xl lg:text-9xl opacity-30 lg:opacity-20">{cover}</div>
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to bottom, transparent, transparent, var(--bq-paper))' }}
          />

          {/* Mobile back button */}
          <button
            onClick={() => navigate(`/groups/${groupId}/quiz-sets`)}
            className="md:hidden absolute top-3 left-3 w-9 h-9 rounded-full bg-black/40 backdrop-blur flex items-center justify-center text-white"
            aria-label={t('quizSet.detail.back')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="absolute bottom-3 lg:bottom-6 left-4 lg:left-8 right-4 lg:right-8">
            <div className="flex flex-wrap gap-1.5 lg:gap-2 mb-1.5 lg:mb-3">
              <span className={`qs-badge-status ${badge.cls}`}>{badge.vi}</span>
              {quizSet.averageRating != null && (
                <span className="px-2 lg:px-2.5 py-0.5 lg:py-1 rounded-full bg-black/40 backdrop-blur text-[9px] lg:text-[10px] font-bold text-bq-amber">
                  {t('quizSet.detail.rating', { rating: Number(quizSet.averageRating).toFixed(1), count: quizSet.totalRatings })}
                </span>
              )}
              <span className="hidden lg:inline-block px-2.5 py-1 rounded-full bg-black/40 backdrop-blur text-[10px] font-bold text-white">
                ▶ Đã chơi {quizSet.playCount} lần
              </span>
            </div>
            <h1 className="font-display font-extrabold text-bq-ink text-xl lg:text-3xl leading-tight">{quizSet.name}</h1>
            {quizSet.coverScripture && (
              <div className="hidden md:flex items-center gap-2 mt-2 text-sm text-bq-ink2">
                <span>📍</span>
                <span>{quizSet.coverScripture}</span>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="px-4 lg:px-8 py-3 lg:py-6 space-y-4 lg:space-y-6">
          {/* Tags */}
          {quizSet.tags && quizSet.tags.length > 0 && (
            <div className="flex gap-1.5 lg:gap-2 overflow-x-auto qs-scroll-thin">
              {quizSet.tags.map(tag => (
                <span key={tag} className="shrink-0 px-2 lg:px-3 py-0.5 lg:py-1 rounded-full bg-bq-amber/15 text-bq-amberd text-[10px] lg:text-xs font-semibold">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Description */}
          {quizSet.description && (
            <div>
              <div className="hidden md:block text-[12.5px] font-semibold text-bq-ink2 mb-2">Mô tả</div>
              <p className="text-xs lg:text-sm text-bq-ink2 leading-relaxed">{quizSet.description}</p>
            </div>
          )}

          {/* Author note */}
          {quizSet.authorNote && (
            <div className="bg-bq-inset rounded-xl p-3 lg:p-4 border-l-4 border-bq-amber">
              <div className="text-[12px] font-semibold text-bq-amberd mb-1 lg:mb-1.5">{t('quizSet.detail.authorNote')}</div>
              <div className="text-xs lg:text-sm text-bq-ink2 whitespace-pre-wrap">{quizSet.authorNote}</div>
            </div>
          )}

          {/* Mobile: 4-stat grid + mastery + suggested mode + actions */}
          <div className="md:hidden space-y-4">
            <div className="grid grid-cols-4 gap-1.5">
              <Stat label={t('quizSet.detail.statQuestions')} value={String(quizSet.totalQuestions)} />
              <StatDifficulty label={t('quizSet.detail.statDifficulty')} diff={diff} />
              <Stat
                label={t('quizSet.detail.statTime')}
                value={quizSet.estimatedDurationMin ? String(quizSet.estimatedDurationMin) : '—'}
                suffix={quizSet.estimatedDurationMin ? 'm' : undefined}
              />
              <Stat label={t('quizSet.detail.statPlays')} value={String(quizSet.playCount)} valueClass="text-bq-amberd" />
            </div>

            {hasMastery && <MasteryCard t={t} mastery={mastery!} totalQuestions={quizSet.totalQuestions} masteryPct={masteryPct} />}

            {quizSet.suggestedMode && (
              <div className="text-[12px] font-semibold text-bq-ink2">
                {t('quizSet.detail.suggestedMode', { mode: MODE_LABELS[quizSet.suggestedMode].vi })}
              </div>
            )}

            <PrimaryActions
              quizSet={quizSet} busy={busy} t={t}
              onPlayNow={() => setShowModePicker(true)}
              onPublish={() => action(() => publishQuizSet(groupId!, setId!))}
              onUnarchive={() => action(() => unarchiveQuizSet(groupId!, setId!))}
            />

            {quizSet.publishStatus === 'PUBLISHED' && (
              <button
                onClick={() => navigate(`/groups/${groupId}/scheduled-quizzes/new?quizSetId=${quizSet.id}`)}
                className="w-full py-2.5 rounded-xl bg-bq-white border border-bq-hair shadow-bq-soft text-bq-ink font-semibold text-xs flex items-center justify-center gap-1.5"
              ><span>📅</span><span>{t('quizSet.detail.schedule')}</span></button>
            )}

            <LeaderActionsRow
              t={t} groupId={groupId!} quizSet={quizSet} busy={busy}
              onClone={() => action(() => cloneQuizSet(groupId!, setId!), `/groups/${groupId}/quiz-sets`)}
              onArchive={() => action(() => archiveQuizSet(groupId!, setId!))}
              onDelete={() => {
                if (confirm(t('quizSet.detail.deleteConfirm')))
                  action(() => deleteQuizSet(groupId!, setId!), `/groups/${groupId}/quiz-sets`)
              }}
              navigate={navigate}
            />
          </div>
        </div>
      </div>

      {/* DESKTOP: Right stats sidebar 340px */}
      <aside className="hidden md:block w-[340px] shrink-0 border-l border-bq-hair overflow-y-auto qs-scroll-thin bg-bq-inset">
        <div className="p-5 space-y-5">
          <div>
            <PrimaryActions
              quizSet={quizSet} busy={busy} t={t}
              onPlayNow={() => setShowModePicker(true)}
              onPublish={() => action(() => publishQuizSet(groupId!, setId!))}
              onUnarchive={() => action(() => unarchiveQuizSet(groupId!, setId!))}
            />
            {quizSet.publishStatus === 'PUBLISHED' && (
              <button
                onClick={() => navigate(`/groups/${groupId}/scheduled-quizzes/new?quizSetId=${quizSet.id}`)}
                className="w-full mt-2 py-2.5 rounded-xl bg-bq-white border border-bq-hair shadow-bq-soft text-bq-ink font-semibold text-xs flex items-center justify-center gap-1.5"
              ><span>📅</span><span>{t('quizSet.detail.schedule')}</span></button>
            )}
          </div>

          {/* 2x2 stats grid */}
          <div className="grid grid-cols-2 gap-2">
            <DesktopStat label={t('quizSet.detail.statQuestions')} value={String(quizSet.totalQuestions)} />
            <DesktopStat
              label={t('quizSet.detail.statDifficulty')}
              value={diff ? `${diff.emoji} ${diff.vi}` : '—'}
              valueClass={diff?.cls ?? 'text-bq-ink3'}
              small
            />
            <DesktopStat
              label={t('quizSet.detail.statTime')}
              value={quizSet.estimatedDurationMin ? String(quizSet.estimatedDurationMin) : '—'}
              suffix={quizSet.estimatedDurationMin ? 'phút' : undefined}
            />
            <DesktopStat label={t('quizSet.detail.statPlays')} value={`${quizSet.playCount}x`} valueClass="text-bq-amberd" />
          </div>

          {hasMastery && <MasteryCard t={t} mastery={mastery!} totalQuestions={quizSet.totalQuestions} masteryPct={masteryPct} />}

          {quizSet.suggestedMode && (
            <div>
              <div className="text-[12px] font-semibold text-bq-ink2 mb-2">💡 Mode đề xuất</div>
              <div className="bg-bq-white border border-bq-emerald/30 shadow-bq-soft rounded-xl p-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg ${MODE_LABELS[quizSet.suggestedMode].cssClass} flex items-center justify-center text-xl shrink-0`}>
                    {MODE_LABELS[quizSet.suggestedMode].emoji}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-bq-ink">{MODE_LABELS[quizSet.suggestedMode].vi}</div>
                    <div className="text-[10px] text-bq-ink2">{MODE_LABELS[quizSet.suggestedMode].tagline}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Leader actions stacked */}
          <div className="rounded-xl p-3 border border-bq-hair bg-bq-white shadow-bq-soft">
            <div className="text-[12px] font-semibold text-bq-amberd mb-2 flex items-center gap-1.5">
              <span>👑</span><span>{t('quizSet.detail.leaderActions')}</span>
            </div>
            <div className="space-y-1.5">
              <DesktopLeaderButton
                icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>}
                label={`${t('quizSet.detail.edit')} bộ câu hỏi`}
                onClick={() => navigate(`/groups/${groupId}/quiz-sets/${quizSet.id}/edit`)}
              />
              <DesktopLeaderButton
                icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>}
                label={`${t('quizSet.detail.clone')} bộ này`}
                onClick={() => action(() => cloneQuizSet(groupId!, setId!), `/groups/${groupId}/quiz-sets`)}
                disabled={busy}
              />
              {quizSet.publishStatus === 'PUBLISHED' && (
                <DesktopLeaderButton
                  icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <rect x="3" y="3" width="18" height="4" rx="1" />
                    <path d="M5 7v13a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7M10 12h4" />
                  </svg>}
                  label={t('quizSet.detail.archive')}
                  onClick={() => action(() => archiveQuizSet(groupId!, setId!))}
                  disabled={busy}
                />
              )}
              <DesktopLeaderButton
                icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-2 14H7L5 6" />
                </svg>}
                label={t('quizSet.detail.delete')}
                danger
                onClick={() => {
                  if (confirm(t('quizSet.detail.deleteConfirm')))
                    action(() => deleteQuizSet(groupId!, setId!), `/groups/${groupId}/quiz-sets`)
                }}
                disabled={busy}
              />
            </div>
          </div>
        </div>
      </aside>

      {/* Mode picker — bottom sheet mobile / centered modal desktop */}
      {showModePicker && (
        <ModePickerModal
          quizSet={quizSet} busy={busy} groupId={groupId!}
          onPick={startMode}
          onSolo={null}
          onClose={() => setShowModePicker(false)}
        />
      )}
    </div>
  )
}

function PrimaryActions({
  quizSet, busy, t, onPlayNow, onPublish, onUnarchive,
}: {
  quizSet: QuizSet; busy: boolean; t: any;
  onPlayNow: () => void; onPublish: () => void; onUnarchive: () => void;
}) {
  if (quizSet.publishStatus === 'PUBLISHED') {
    return (
      <button
        onClick={onPlayNow} disabled={busy}
        className="w-full py-3 rounded-xl bg-bq-action shadow-bq-action font-display font-extrabold text-bq-ink text-sm flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <span>▶</span><span>{t('quizSet.detail.ctaPlayNow')}</span>
      </button>
    )
  }
  if (quizSet.publishStatus === 'DRAFT') {
    return (
      <button
        onClick={onPublish} disabled={busy || quizSet.totalQuestions < 5}
        className="w-full py-3 rounded-xl bg-bq-action shadow-bq-action font-display font-extrabold text-bq-ink text-sm flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <span>✓</span><span>{quizSet.totalQuestions < 5 ? t('quizSet.detail.ctaNeedQuestions', { count: quizSet.totalQuestions }) : t('quizSet.detail.ctaPublish')}</span>
      </button>
    )
  }
  if (quizSet.publishStatus === 'ARCHIVED') {
    return (
      <button
        onClick={onUnarchive} disabled={busy}
        className="w-full py-3 rounded-xl bg-bq-white border border-bq-amber/30 text-bq-amberd font-bold text-sm"
      >{t('quizSet.detail.ctaUnarchive')}</button>
    )
  }
  return null
}

function MasteryCard({
  t, mastery, totalQuestions, masteryPct,
}: {
  t: any; mastery: QuizSetMastery; totalQuestions: number; masteryPct: number;
}) {
  return (
    <div className="rounded-xl p-3 lg:p-4 border border-bq-emerald/30 bg-bq-emerald/[0.06]">
      <div className="text-[12px] font-bold text-bq-emerald mb-2 flex items-center gap-1.5">
        <span>🎯</span><span>{t('quizSet.detail.masteryHeader').replace('🎯 ', '')}</span>
      </div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs lg:text-sm text-bq-ink font-semibold">{t('quizSet.detail.masteryLearned')}</span>
        <span className="text-xs lg:text-sm font-extrabold text-bq-emerald">
          {mastery.questionsLearned}/{totalQuestions} câu
        </span>
      </div>
      <div className="bg-bq-inset rounded-full overflow-hidden h-2 mb-3">
        <div className="bg-bq-emerald h-2" style={{ width: `${masteryPct}%` }} />
      </div>
      <div className="flex items-center justify-between text-xs text-bq-ink2 mb-3">
        <span>{masteryPct}% hoàn thành</span>
        {totalQuestions - mastery.questionsLearned > 0 && (
          <span className="text-bq-emerald">Còn {totalQuestions - mastery.questionsLearned} câu</span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-bq-emerald/15 text-center">
        <MiniStat label={t('quizSet.detail.masteryAttempts')} value={t('quizSet.detail.masteryAttemptsValue', { count: mastery.totalAttempts })} />
        <MiniStat
          label={t('quizSet.detail.masteryBest')}
          value={mastery.bestAccuracy != null ? `${Number(mastery.bestAccuracy).toFixed(0)}%` : `${mastery.bestScore}đ`}
          valueClass="text-bq-amberd"
        />
        <MiniStat
          label={t('quizSet.detail.masteryLast')}
          value={mastery.lastPracticedAt ? relativeShort(mastery.lastPracticedAt) : '—'}
        />
      </div>
      {mastery.completedMastery && (
        <div className="mt-2 text-center text-[10px] text-bq-emerald font-bold">{t('quizSet.detail.masteryCompleted')}</div>
      )}
    </div>
  )
}

function Stat({ label, value, suffix, valueClass }: { label: string; value: string; suffix?: string; valueClass?: string }) {
  return (
    <div className="bg-bq-white border border-bq-hair shadow-bq-soft rounded-xl p-2 text-center">
      <div className="text-[11.5px] text-bq-ink2 font-semibold">{label}</div>
      <div className={`font-display font-bold text-base ${valueClass || 'text-bq-ink'}`}>
        {value}{suffix && <span className="text-[10px] text-bq-ink3">{suffix}</span>}
      </div>
    </div>
  )
}

function StatDifficulty({ label, diff }: { label: string; diff: { vi: string; short: string; cls: string; emoji: string } | null }) {
  return (
    <div className="bg-bq-white border border-bq-hair shadow-bq-soft rounded-xl p-2 text-center">
      <div className="text-[11.5px] text-bq-ink2 font-semibold">{label}</div>
      <div className={`text-xs font-bold mt-0.5 ${diff?.cls ?? 'text-bq-ink3'}`}>
        {diff ? `${diff.emoji} ${diff.short}` : '—'}
      </div>
    </div>
  )
}

function DesktopStat({
  label, value, suffix, valueClass, small,
}: {
  label: string; value: string; suffix?: string; valueClass?: string; small?: boolean;
}) {
  return (
    <div className="bg-bq-white border border-bq-hair shadow-bq-soft rounded-xl p-3">
      <div className="text-[12px] text-bq-ink2 font-semibold">{label}</div>
      <div className={`font-extrabold mt-0.5 ${small ? 'text-sm' : 'text-xl'} ${valueClass || 'text-bq-ink'}`}>
        {value}{suffix && <span className="text-xs text-bq-ink3 ml-1">{suffix}</span>}
      </div>
    </div>
  )
}

function MiniStat({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div>
      <div className="text-[11.5px] lg:text-[10px] text-bq-ink2">{label}</div>
      <div className={`text-sm font-bold ${valueClass ?? 'text-bq-ink'}`}>{value}</div>
    </div>
  )
}

function LeaderActionsRow({
  t, groupId, quizSet, busy, onClone, onArchive, onDelete, navigate,
}: {
  t: any; groupId: string; quizSet: QuizSet; busy: boolean;
  onClone: () => void; onArchive: () => void; onDelete: () => void;
  navigate: (p: string) => void;
}) {
  return (
    <div className="rounded-xl p-2 border border-bq-hair bg-bq-white shadow-bq-soft flex items-center justify-between">
      <span className="text-[10px] text-bq-ink2">{t('quizSet.detail.leaderActions')}</span>
      <div className="flex gap-1">
        <IconButton
          title={t('quizSet.detail.edit')}
          onClick={() => navigate(`/groups/${groupId}/quiz-sets/${quizSet.id}/edit`)}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </IconButton>
        <IconButton title={t('quizSet.detail.clone')} onClick={onClone} disabled={busy}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </IconButton>
        {quizSet.publishStatus === 'PUBLISHED' && (
          <IconButton title={t('quizSet.detail.archive')} onClick={onArchive} disabled={busy}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x="3" y="3" width="18" height="4" rx="1" />
              <path d="M5 7v13a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7M10 12h4" />
            </svg>
          </IconButton>
        )}
        <IconButton title={t('quizSet.detail.delete')} onClick={onDelete} disabled={busy} className="text-bq-ruby">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-2 14H7L5 6" />
          </svg>
        </IconButton>
      </div>
    </div>
  )
}

function DesktopLeaderButton({
  icon, label, onClick, disabled, danger,
}: {
  icon: React.ReactNode; label: string; onClick: () => void;
  disabled?: boolean; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full px-3 py-2 rounded-lg flex items-center gap-2 text-xs disabled:opacity-50 ${
        danger ? 'text-bq-ruby hover:bg-bq-ruby/10' : 'text-bq-ink2 hover:bg-bq-inset'
      }`}
    >
      {icon}<span>{label}</span>
    </button>
  )
}

function IconButton({
  children, onClick, title, disabled, className,
}: {
  children: React.ReactNode; onClick: () => void; title: string;
  disabled?: boolean; className?: string;
}) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`w-7 h-7 rounded-lg bg-bq-inset border border-bq-hair flex items-center justify-center text-bq-ink2 disabled:opacity-50 ${className ?? ''}`}
    >{children}</button>
  )
}

function relativeShort(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const day = Math.floor(ms / 86400000)
  if (day === 0) return 'hôm nay'
  if (day === 1) return 'hôm qua'
  if (day < 7) return `${day} ngày`
  if (day < 30) return `${Math.floor(day / 7)} tuần`
  return new Date(iso).toLocaleDateString('vi-VN')
}
