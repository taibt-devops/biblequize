import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useQuery } from '@tanstack/react-query'
import SearchableSelect from '../components/ui/SearchableSelect'
import QuizLanguageSelect from '../components/QuizLanguageSelect'
import { getQuizLanguage, type QuizLanguage } from '../utils/quizLanguage'
import { getChapterCount, getVerseCount } from '../data/bibleData'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/authStore'
import MemorizeEntryCard from '../components/memorize/MemorizeEntryCard'

interface Book {
  id: string
  name: string
  nameVi: string
  testament: string
  orderIndex: number
}

const DIFFICULTY_OPTIONS = [
  { key: 'all',    labelKey: 'practice.difficultyAll', icon: 'category',       color: '#6C6A62' },
  { key: 'easy',   labelKey: 'practice.easy',          icon: 'sentiment_satisfied', color: '#0E8A6B' },
  { key: 'medium', labelKey: 'practice.medium',        icon: 'speed',          color: '#D97F06' },
  { key: 'hard',   labelKey: 'practice.hard',          icon: 'local_fire_department', color: '#E0354B' },
]

const COUNT_OPTIONS = [5, 10, 20, 50]
const MIN_TIME = 5
const MAX_TIME = 120
const DEFAULT_TIME = 30

interface RecentSession {
  sessionId: string
  createdAt: string | null
  status: string | null
  totalQuestions: number
  correctAnswers: number
  accuracy: number
  book: string | null
}

function relativeDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const now = Date.now()
  const diffMs = now - d.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'vừa xong'
  if (mins < 60) return `${mins} phút trước`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} giờ trước`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Hôm qua'
  if (days < 7) return `${days} ngày trước`
  return d.toLocaleDateString()
}

const TIP_KEYS = ['practice.tips.tip1', 'practice.tips.tip2', 'practice.tips.tip3']

const FILL_1: React.CSSProperties = { fontVariationSettings: "'FILL' 1" }

function clampInt(v: number, min: number, max: number): number {
  if (Number.isNaN(v)) return min
  return Math.max(min, Math.min(max, Math.floor(v)))
}

export default function Practice() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  const [books, setBooks] = useState<Book[]>([])
  const [selectedBook, setSelectedBook] = useState('')
  const [selectedDifficulty, setSelectedDifficulty] = useState('all')
  const [questionCount, setQuestionCount] = useState(10)
  const [showExplanation, setShowExplanation] = useState(true)
  const [quizLang, setQuizLang] = useState<QuizLanguage>(getQuizLanguage)
  const [timePerQuestion, setTimePerQuestion] = useState(DEFAULT_TIME)
  const [chapterFrom, setChapterFrom] = useState<number | ''>('')
  const [chapterTo, setChapterTo] = useState<number | ''>('')
  const [verseFrom, setVerseFrom] = useState<number | ''>('')
  const [verseTo, setVerseTo] = useState<number | ''>('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string>('')

  const { data: booksData, isLoading: isBooksLoading } = useQuery({
    queryKey: ['books'],
    queryFn: async () => {
      const res = await api.get('/api/books')
      return res.data as Book[]
    },
  })

  // Recent sessions + wrong-question retry are logged-in-only (per-user history).
  // Gate the queries on auth so guests don't fire requests that 401 — guest
  // practice is a fresh client-side run with no server history.
  const { data: recentSessions } = useQuery({
    queryKey: ['practice-recent'],
    queryFn: async () => {
      const res = await api.get('/api/sessions/practice/recent', { params: { limit: 3 } })
      return res.data as RecentSession[]
    },
    enabled: isAuthenticated,
  })

  const { data: wrongCount } = useQuery({
    queryKey: ['practice-wrong-count'],
    queryFn: async () => {
      const res = await api.get('/api/sessions/practice/wrong-questions/count')
      return (res.data as { count: number }).count
    },
    enabled: isAuthenticated,
  })

  useEffect(() => {
    if (booksData) setBooks(booksData)
  }, [booksData])

  // Reset chapter/verse when book changes — bounds are book-specific
  useEffect(() => {
    setChapterFrom('')
    setChapterTo('')
    setVerseFrom('')
    setVerseTo('')
  }, [selectedBook])

  // Reset verse when chapters span more than 1 (verse range only valid in single chapter)
  const singleChapterSelected = chapterFrom !== '' && chapterTo !== '' && chapterFrom === chapterTo
  useEffect(() => {
    if (!singleChapterSelected) {
      setVerseFrom('')
      setVerseTo('')
    }
  }, [singleChapterSelected])

  const maxChapter = useMemo(() => selectedBook ? getChapterCount(selectedBook) : 0, [selectedBook])
  const maxVerse = useMemo(
    () => (selectedBook && singleChapterSelected && chapterFrom !== '')
      ? getVerseCount(selectedBook, chapterFrom)
      : 0,
    [selectedBook, singleChapterSelected, chapterFrom]
  )

  // Validation
  const rangeError = useMemo<string | null>(() => {
    if (!selectedBook) return null
    const cf = chapterFrom === '' ? null : chapterFrom
    const ct = chapterTo === '' ? null : chapterTo
    const vf = verseFrom === '' ? null : verseFrom
    const vt = verseTo === '' ? null : verseTo
    if (cf == null && ct == null && vf == null && vt == null) return null
    if (cf != null && (cf < 1 || cf > maxChapter)) return t('practice.rangeError')
    if (ct != null && (ct < 1 || ct > maxChapter)) return t('practice.rangeError')
    if (cf != null && ct != null && cf > ct) return t('practice.rangeError')
    if ((vf != null || vt != null)) {
      if (cf == null || ct == null || cf !== ct) return t('practice.rangeError')
      if (vf != null && (vf < 1 || vf > maxVerse)) return t('practice.rangeError')
      if (vt != null && (vt < 1 || vt > maxVerse)) return t('practice.rangeError')
      if (vf != null && vt != null && vf > vt) return t('practice.rangeError')
    }
    return null
  }, [selectedBook, chapterFrom, chapterTo, verseFrom, verseTo, maxChapter, maxVerse, t])

  const startQuiz = async () => {
    try {
      setIsLoading(true)
      setErrorMsg('')

      // Guest (not logged in): SPEC_USER §5.1 — Luyện Tập is "mixed (guest có
      // thể chơi, không lưu tier)". Run a local, no-session quiz: pull questions
      // from the public /api/questions endpoint and let Quiz.tsx score them
      // client-side (its sessionId-less path already handles scoring, skips the
      // answer/complete POSTs, and disables the lifeline). This avoids the 401
      // that POST /api/sessions returns for anonymous users.
      if (!isAuthenticated) {
        const params: Record<string, unknown> = { language: quizLang, limit: questionCount }
        if (selectedBook) params.book = selectedBook
        if (selectedDifficulty && selectedDifficulty !== 'all') params.difficulty = selectedDifficulty
        if (chapterFrom !== '') params.chapterFrom = chapterFrom
        if (chapterTo !== '')   params.chapterTo   = chapterTo
        if (verseFrom !== '')   params.verseFrom   = verseFrom
        if (verseTo !== '')     params.verseTo     = verseTo

        const res = await api.get('/api/questions', { params })
        const questions = res.data
        if (!Array.isArray(questions) || questions.length === 0) {
          setErrorMsg(t('practice.errorCreate'))
          return
        }
        navigate('/quiz', {
          state: {
            questions,
            mode: 'practice',
            book: selectedBook,
            difficulty: selectedDifficulty,
            questionCount,
            showExplanation,
            timePerQuestion,
          },
        })
        return
      }

      const payload: Record<string, unknown> = {
        mode: 'practice',
        book: selectedBook,
        difficulty: selectedDifficulty,
        questionCount,
        showExplanation,
        language: quizLang,
        timePerQuestion,
      }
      if (chapterFrom !== '') payload.chapterFrom = chapterFrom
      if (chapterTo !== '')   payload.chapterTo   = chapterTo
      if (verseFrom !== '')   payload.verseFrom   = verseFrom
      if (verseTo !== '')     payload.verseTo     = verseTo

      const res = await api.post('/api/sessions', payload)
      const { sessionId, questions } = res.data
      navigate('/quiz', {
        state: {
          sessionId,
          questions,
          book: selectedBook,
          difficulty: selectedDifficulty,
          questionCount,
          showExplanation,
          timePerQuestion,
        },
      })
    } catch (err: unknown) {
      // Surface the server's explicit message (e.g. range/validation/no-questions)
      // instead of a generic "thử lại" so the failure is tường minh. BE error
      // shape is { code, message, ... } or { error: ... }.
      const data = (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data
      const serverMsg = data?.message ?? data?.error
      setErrorMsg(serverMsg && serverMsg.trim() ? serverMsg : t('practice.errorCreate'))
    } finally {
      setIsLoading(false)
    }
  }

  const estimatedMins = Math.max(1, Math.round((questionCount * timePerQuestion) / 60))
  const bookCount = selectedBook ? 1 : books.length || 66
  const isDisabled = isLoading || isBooksLoading || rangeError != null
  const tipOfTheDay = t(TIP_KEYS[new Date().getDate() % TIP_KEYS.length])

  return (
    <div data-testid="practice-page" className="space-y-8">

      {/* ── Compact Header ─────────────────────────────────── */}
      <section className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-bq-amber/15 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-bq-amberd text-xl" style={FILL_1}>menu_book</span>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-bq-amberd/90 mb-1">
            {t('practice.modeBadge')}
          </p>
          <h1 className="font-display text-2xl font-bold text-bq-ink leading-tight mb-1">
            {t('practice.heroTitle')}{t('practice.heroAccent')}
          </h1>
          <p className="text-sm text-bq-ink2">{t('practice.heroDesc')}</p>
        </div>
      </section>

      <MemorizeEntryCard isAuthenticated={isAuthenticated} />

      {/* ── Error ─────────────────────────────────────────── */}
      {errorMsg && (
        <div className="bg-bq-ruby/10 border border-bq-ruby/25 rounded-xl p-4 flex items-center gap-3">
          <span className="material-symbols-outlined text-bq-ruby text-xl">warning</span>
          <span className="text-bq-ruby text-sm font-semibold">{errorMsg}</span>
        </div>
      )}

      {/* ── Filter Card (compact, single panel) ──────────── */}
      <form
        className="bg-bq-white border border-bq-hair shadow-bq-soft rounded-2xl overflow-hidden"
        onSubmit={e => { e.preventDefault(); if (!isDisabled) startQuiz() }}
      >
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">

            {/* ── Left Column ──────────────────────────── */}
            <div className="space-y-5">
              {/* Quiz Language */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-bq-ink2 mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-bq-amberd">translate</span>
                  {t('practice.quizLanguage')}
                </label>
                <QuizLanguageSelect onChange={setQuizLang} />
              </div>

              {/* Book Selector */}
              <div data-testid="practice-book-select">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-bq-ink2 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-bq-amberd">auto_stories</span>
                    {t('practice.selectBook')}
                  </label>
                  <span className="text-[10px] font-bold text-bq-amberd/70 tracking-wider">
                    {t('practice.bookCount', { current: books.length || 66, total: 66 })}
                  </span>
                </div>
                <SearchableSelect
                  options={books.map(b => ({ value: b.name, label: `${b.nameVi} (${b.name})` }))}
                  value={selectedBook}
                  onChange={setSelectedBook}
                  placeholder={t('practice.searchBook')}
                  allLabel={t('practice.allBooks')}
                />
                <p className="text-bq-ink3 text-[11px] mt-1.5">{t('practice.bookHint')}</p>
              </div>

              {/* Question Count */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-bq-ink2 mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-bq-amberd">quiz</span>
                  {t('practice.questionCount')}
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {COUNT_OPTIONS.map(num => (
                    <button
                      key={num}
                      data-testid={`practice-count-${num}`}
                      type="button"
                      onClick={() => setQuestionCount(num)}
                      className={`py-2.5 rounded-lg text-sm font-semibold transition-all
                        ${questionCount === num
                          ? 'bg-bq-action text-white shadow-bq-action'
                          : 'bg-bq-inset text-bq-ink2 hover:bg-bq-hair'
                        }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time per Question (slider) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-bq-ink2 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-bq-amberd">timer</span>
                    {t('practice.timePerQuestion')}
                  </label>
                  <span className="text-sm font-bold text-bq-amberd tabular-nums">
                    {t('practice.timePerQuestionValue', { seconds: timePerQuestion })}
                  </span>
                </div>
                <input
                  data-testid="practice-time-slider"
                  type="range"
                  min={MIN_TIME}
                  max={MAX_TIME}
                  step={5}
                  value={timePerQuestion}
                  onChange={e => setTimePerQuestion(Number(e.target.value))}
                  className="w-full accent-bq-amberd"
                  aria-label={t('practice.timePerQuestion')}
                />
                <p className="text-bq-ink3 text-[11px] mt-1">{t('practice.timePerQuestionHint')}</p>
              </div>
            </div>

            {/* ── Right Column ─────────────────────────── */}
            <div className="space-y-5">
              {/* Difficulty */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-bq-ink2 mb-2 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-bq-amberd">tune</span>
                  {t('practice.difficulty')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {DIFFICULTY_OPTIONS.map(d => {
                    const active = selectedDifficulty === d.key
                    return (
                      <button
                        key={d.key}
                        data-testid={`practice-difficulty-${d.key}`}
                        type="button"
                        onClick={() => setSelectedDifficulty(d.key)}
                        className={`flex items-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all
                          ${active
                            ? 'bg-bq-inset ring-1 ring-bq-sapphire/40 text-bq-ink'
                            : 'bg-bq-inset text-bq-ink2 hover:bg-bq-hair'
                          }`}
                      >
                        <span
                          className="material-symbols-outlined text-lg"
                          style={{ color: d.color, ...(active ? FILL_1 : {}) }}
                        >
                          {d.icon}
                        </span>
                        <span>{t(d.labelKey)}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Chapter Range (enabled only when book selected) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-bq-ink2 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-bq-amberd">format_list_numbered</span>
                    {t('practice.chapterRange')}
                  </label>
                  {selectedBook && (
                    <span className="text-[10px] font-bold text-bq-ink3">
                      {t('practice.chapterMaxHint', { max: maxChapter })}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    data-testid="practice-chapter-from"
                    type="number"
                    min={1}
                    max={maxChapter || undefined}
                    placeholder={t('practice.chapterFromLabel')}
                    value={chapterFrom}
                    disabled={!selectedBook}
                    onChange={e => {
                      const v = e.target.value
                      setChapterFrom(v === '' ? '' : clampInt(Number(v), 1, maxChapter))
                    }}
                    className="px-3 py-2.5 rounded-lg bg-bq-inset border border-bq-hair text-bq-ink text-sm font-semibold disabled:opacity-40 placeholder:text-bq-ink3 focus:outline-none focus:ring-1 focus:ring-bq-sapphire"
                  />
                  <input
                    data-testid="practice-chapter-to"
                    type="number"
                    min={1}
                    max={maxChapter || undefined}
                    placeholder={t('practice.chapterToLabel')}
                    value={chapterTo}
                    disabled={!selectedBook}
                    onChange={e => {
                      const v = e.target.value
                      setChapterTo(v === '' ? '' : clampInt(Number(v), 1, maxChapter))
                    }}
                    className="px-3 py-2.5 rounded-lg bg-bq-inset border border-bq-hair text-bq-ink text-sm font-semibold disabled:opacity-40 placeholder:text-bq-ink3 focus:outline-none focus:ring-1 focus:ring-bq-sapphire"
                  />
                </div>
                <p className="text-bq-ink3 text-[11px] mt-1">
                  {selectedBook ? t('practice.chapterRangeHint') : t('practice.chapterRangeHint')}
                </p>
              </div>

              {/* Verse Range (enabled only when single chapter selected) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-bq-ink2 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-bq-amberd">subject</span>
                    {singleChapterSelected
                      ? t('practice.verseRange', { chapter: chapterFrom })
                      : t('practice.verseRange', { chapter: '—' })}
                  </label>
                  {singleChapterSelected && maxVerse > 0 && (
                    <span className="text-[10px] font-bold text-bq-ink3">
                      {t('practice.verseMaxHint', { max: maxVerse })}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    data-testid="practice-verse-from"
                    type="number"
                    min={1}
                    max={maxVerse || undefined}
                    placeholder={t('practice.verseFromLabel')}
                    value={verseFrom}
                    disabled={!singleChapterSelected}
                    onChange={e => {
                      const v = e.target.value
                      setVerseFrom(v === '' ? '' : clampInt(Number(v), 1, maxVerse))
                    }}
                    className="px-3 py-2.5 rounded-lg bg-bq-inset border border-bq-hair text-bq-ink text-sm font-semibold disabled:opacity-40 placeholder:text-bq-ink3 focus:outline-none focus:ring-1 focus:ring-bq-sapphire"
                  />
                  <input
                    data-testid="practice-verse-to"
                    type="number"
                    min={1}
                    max={maxVerse || undefined}
                    placeholder={t('practice.verseToLabel')}
                    value={verseTo}
                    disabled={!singleChapterSelected}
                    onChange={e => {
                      const v = e.target.value
                      setVerseTo(v === '' ? '' : clampInt(Number(v), 1, maxVerse))
                    }}
                    className="px-3 py-2.5 rounded-lg bg-bq-inset border border-bq-hair text-bq-ink text-sm font-semibold disabled:opacity-40 placeholder:text-bq-ink3 focus:outline-none focus:ring-1 focus:ring-bq-sapphire"
                  />
                </div>
                <p className="text-bq-ink3 text-[11px] mt-1">{t('practice.verseRangeHint')}</p>
              </div>
            </div>
          </div>

          {/* Range error inline */}
          {rangeError && (
            <div data-testid="practice-range-error" className="bg-bq-ruby/10 border border-bq-ruby/30 rounded-lg p-3 text-bq-ruby text-xs font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-base">error</span>
              {rangeError}
            </div>
          )}
        </div>

        {/* ── Footer: Show Explanation Toggle + CTA ─────── */}
        <div className="border-t border-bq-hair px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 bg-bq-paper">
          <button
            data-testid="practice-show-explanation-toggle"
            type="button"
            onClick={() => setShowExplanation(p => !p)}
            className="flex items-center gap-3 text-sm text-bq-ink2 hover:text-bq-ink transition-colors"
          >
            <span className="material-symbols-outlined text-base text-bq-amberd" style={FILL_1}>lightbulb</span>
            <span className="font-semibold">{t('practice.showExplanation')}</span>
            <div
              className={`w-10 h-6 rounded-full p-0.5 transition-colors ${
                showExplanation ? 'bg-bq-amberd' : 'bg-bq-inset'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  showExplanation ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </div>
          </button>

          <button
            data-testid="practice-start-btn"
            type="submit"
            disabled={isDisabled}
            className={`bg-bq-action text-white font-bold py-3 px-7 rounded-xl text-sm shadow-bq-action transition-all
              ${isDisabled
                ? 'opacity-60 cursor-not-allowed'
                : 'hover:scale-[1.02] active:scale-95'
              }`}
          >
            {isLoading || isBooksLoading ? (
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                {t('practice.starting')}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base" style={FILL_1}>play_arrow</span>
                {t('practice.start')}
              </span>
            )}
          </button>
        </div>

        {/* Mini stats line */}
        <div className="text-center text-[11px] text-bq-ink3 pb-3">
          {questionCount} · ~{estimatedMins} {t('practice.stats.minutes').toLowerCase()} · {bookCount} {t('practice.stats.books').toLowerCase()}
        </div>
      </form>

      {/* ── Retry Wrong Questions (real count) ──────────── */}
      {wrongCount != null && wrongCount > 0 && (
        <div data-testid="practice-retry-wrong" className="bg-gradient-to-r from-bq-ember/10 to-bq-white border border-bq-ember/25 rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-bq-ember/15 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-bq-ember text-lg" style={FILL_1}>replay</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-bq-ink text-sm">{t('practice.retryWrongTitle')}</p>
              <span className="px-2 py-0.5 rounded-full bg-bq-ember/20 text-bq-ember text-[10px] font-bold">
                {wrongCount}
              </span>
            </div>
            <p className="text-xs text-bq-ink2">{t('practice.retryWrongDesc')}</p>
          </div>
          <button
            data-testid="practice-retry-wrong-btn"
            onClick={() => {
              api.post('/api/sessions/practice/retry-wrong')
                .then(res => navigate('/quiz', {
                  state: {
                    sessionId: res.data.sessionId,
                    questions: res.data.questions,
                    mode: 'practice',
                  },
                }))
                .catch(() => setErrorMsg(t('practice.errorCreate')))
            }}
            className="px-4 py-2 rounded-lg bg-bq-ember/15 border border-bq-ember/35 text-bq-ember font-semibold text-xs hover:bg-bq-ember/20 transition-all active:scale-95"
          >
            {t('practice.retryButton')} →
          </button>
        </div>
      )}

      {/* ── Recent Sessions (real) ─────────────────────────── */}
      {recentSessions && recentSessions.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-bq-amberd text-base" style={FILL_1}>history</span>
            <h2 className="text-sm font-bold text-bq-ink">{t('practice.recentSessions')}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {recentSessions.map(session => (
              <div
                key={session.sessionId}
                className="bg-bq-white border border-bq-hair shadow-bq-soft rounded-xl p-4 hover:border-bq-amber/40 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-bq-ink3">{relativeDate(session.createdAt)}</span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    session.accuracy >= 80
                      ? 'bg-bq-emerald/10 text-bq-emerald'
                      : session.accuracy >= 60
                        ? 'bg-bq-amber/10 text-bq-amberd'
                        : 'bg-bq-ruby/10 text-bq-ruby'
                  }`}>
                    {session.accuracy}%
                  </span>
                </div>
                <p className="text-sm font-semibold text-bq-ink mb-2">
                  {session.book || t('practice.allBooks')}
                </p>
                <div className="h-1 rounded-full bg-bq-inset overflow-hidden mb-1">
                  <div className="h-full bg-bq-action" style={{ width: `${session.accuracy}%` }} />
                </div>
                <span className="text-[11px] text-bq-ink3">
                  {session.correctAnswers}/{session.totalQuestions}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Tips Section ──────────────────────────────────── */}
      <div className="bg-bq-sapphire/8 border border-bq-sapphire/20 rounded-xl p-3 flex items-center gap-3">
        <span className="material-symbols-outlined text-bq-sapphire text-lg" style={FILL_1}>tips_and_updates</span>
        <div className="flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-bq-sapphire mb-0.5">{t('practice.tipsBadge')}</p>
          <p className="text-xs text-bq-ink2">{tipOfTheDay}</p>
        </div>
      </div>

      {/* ── Back Link ─────────────────────────────────────── */}
      <div className="pb-2">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-bq-ink3 hover:text-bq-amberd transition-colors"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          {t('practice.backToHome')}
        </Link>
      </div>
    </div>
  )
}
