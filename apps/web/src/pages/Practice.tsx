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
import { PlaceBackdrop, Plaque, ScrollPanel, lkClass } from '../components/lk/Place'

interface Book {
  id: string
  name: string
  nameVi: string
  testament: string
  orderIndex: number
}

const DIFFICULTY_OPTIONS = [
  { key: 'all',    labelKey: 'practice.difficultyAll', icon: 'category',       color: '#4D3A1F' },
  { key: 'easy',   labelKey: 'practice.easy',          icon: 'sentiment_satisfied', color: '#2E7D4F' },
  { key: 'medium', labelKey: 'practice.medium',        icon: 'speed',          color: '#D97F06' },
  { key: 'hard',   labelKey: 'practice.hard',          icon: 'local_fire_department', color: '#B3452F' },
]

const COUNT_OPTIONS = [5, 10, 20, 50]
const MIN_TIME = 5
const MAX_TIME = 120
const DEFAULT_TIME = 30

// A core story from /api/public/stories. Titles and refs come in the chosen quiz language; a story
// with no questions in that language comes back with questionCount 0.
interface Story {
  id: string
  order: number
  title: string
  ref: string
  testament: 'OT' | 'NT'
  questionCount: number
}

type PracticeScope = 'book' | 'story'

const SCOPES: { key: PracticeScope; labelKey: string; icon: string }[] = [
  { key: 'book',  labelKey: 'practice.byBook',  icon: '/images/lk/scroll.webp' },
  { key: 'story', labelKey: 'practice.byStory', icon: '/images/lk/icon-map.webp' },
]

// Familiar stories offered as one-tap picks beside the story picker.
const SUGGESTED_STORIES = [
  'sang-tao', 'no-e-va-tran-lut', 'da-vit-va-go-li-at',
  'gio-na-va-con-ca-lon', 'chua-jesus-giang-sinh', 'nguoi-con-hoang-dang',
]

interface RecentSession {
  sessionId: string
  createdAt: string | null
  status: string | null
  totalQuestions: number
  correctAnswers: number
  accuracy: number
  book: string | null
  story?: string | null
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

function clampInt(v: number, min: number, max: number): number {
  if (Number.isNaN(v)) return min
  return Math.max(min, Math.min(max, Math.floor(v)))
}

export default function Practice() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  const [books, setBooks] = useState<Book[]>([])
  const [scope, setScope] = useState<PracticeScope>('book')
  const [selectedStory, setSelectedStory] = useState('')
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

  // Always loaded (guests too): the story picker needs it, and so do the titles of
  // recent story sessions.
  const { data: stories } = useQuery({
    queryKey: ['practice-stories', quizLang],
    queryFn: async () => {
      const res = await api.get('/api/public/stories', { params: { language: quizLang } })
      return res.data as Story[]
    },
  })
  const playableStories = useMemo(() => (stories ?? []).filter(s => s.questionCount > 0), [stories])
  const story = playableStories.find(s => s.id === selectedStory)
  const storyTitles = useMemo(() => new Map((stories ?? []).map(s => [s.id, s.title])), [stories])
  const suggestions = useMemo(
    () => SUGGESTED_STORIES.map(id => playableStories.find(s => s.id === id)).filter((s): s is Story => !!s),
    [playableStories],
  )

  // A story the new quiz language has no questions for can't be played.
  useEffect(() => {
    if (selectedStory && stories && !story) setSelectedStory('')
  }, [stories, story, selectedStory])

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

      // "Theo câu chuyện": every question of one story, shuffled by the server. Count,
      // difficulty and chapter/verse range don't apply; time and explanations do.
      if (scope === 'story') {
        if (!story) return
        if (!isAuthenticated) {
          const res = await api.get('/api/questions', { params: { language: quizLang, story: story.id, limit: 50 } })
          const questions = res.data
          if (!Array.isArray(questions) || questions.length === 0) {
            setErrorMsg(t('practice.errorCreate'))
            return
          }
          navigate('/quiz', {
            state: { questions, mode: 'practice', questionCount: questions.length, showExplanation, timePerQuestion },
          })
          return
        }
        const res = await api.post('/api/sessions', {
          mode: 'practice',
          story: story.id,
          questionCount: Math.min(story.questionCount, 50),
          showExplanation,
          language: quizLang,
          timePerQuestion,
        })
        const { sessionId, questions } = res.data
        navigate('/quiz', {
          state: { sessionId, questions, questionCount: questions.length, showExplanation, timePerQuestion },
        })
        return
      }

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

  const plannedCount = scope === 'story' ? story?.questionCount ?? 0 : questionCount
  const estimatedMins = Math.max(1, Math.round((plannedCount * timePerQuestion) / 60))
  const bookCount = selectedBook ? 1 : books.length || 66
  const isDisabled = isLoading || (scope === 'story' ? !story : isBooksLoading || rangeError != null)
  const tipOfTheDay = t(TIP_KEYS[new Date().getDate() % TIP_KEYS.length])

  const label = 'block text-[15px] font-extrabold text-bq-ink mb-2'
  const hint = 'font-read text-[12.5px] text-bq-ink3 mt-1.5'
  const field = 'w-full px-3 py-2.5 rounded-xl bg-bq-white border-2 border-bq-ink text-bq-ink text-[15px] font-bold disabled:opacity-40 placeholder:text-bq-ink3 placeholder:font-semibold focus:outline-none focus:ring-[3px] focus:ring-bq-amber'
  const DOT: Record<string, string> = { all: 'bg-bq-ink', easy: 'bg-bq-emerald', medium: 'bg-bq-sapphire', hard: 'bg-bq-ruby' }

  // Shared by both scopes.
  const languageField = (
    <div>
      <span className={label}>{t('practice.quizLanguage')}</span>
      <QuizLanguageSelect onChange={setQuizLang} />
    </div>
  )
  const timeField = (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-[15px] font-extrabold">{t('practice.timePerQuestion')}</span>
        <span className="text-[15px] font-extrabold text-bq-amberd tabular-nums">{t('practice.timePerQuestionValue', { seconds: timePerQuestion })}</span>
      </div>
      <input
        data-testid="practice-time-slider"
        type="range"
        min={MIN_TIME}
        max={MAX_TIME}
        step={5}
        value={timePerQuestion}
        onChange={e => setTimePerQuestion(Number(e.target.value))}
        className={lkClass.range}
        aria-label={t('practice.timePerQuestion')}
      />
      <p className={hint}>{t('practice.timePerQuestionHint')}</p>
    </div>
  )

  // "Theo câu chuyện": pick one story; the right column previews it, or offers familiar ones.
  const storyFields = (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
      <div className="space-y-6">
        {languageField}

        <div data-testid="practice-story-select">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-[15px] font-extrabold">{t('practice.selectStory')}</span>
            {playableStories.length > 0 && (
              <span className="text-[13px] font-bold text-bq-ink3">{t('practice.storyCount', { count: playableStories.length })}</span>
            )}
          </div>
          {stories && playableStories.length === 0 ? (
            <p data-testid="practice-story-unavailable" className="m-0 px-3 py-2.5 bg-bq-white border-2 border-bq-ink rounded-xl font-read text-[14px] text-bq-ink2">
              {t('practice.storyOnlyVi')}
            </p>
          ) : (
            <SearchableSelect
              options={playableStories.map(s => ({ value: s.id, label: `${s.title} (${s.ref})` }))}
              value={selectedStory}
              onChange={setSelectedStory}
              placeholder={t('practice.chooseStory')}
              searchPlaceholder={t('practice.searchStory')}
              hideAll
            />
          )}
          <p className={hint}>{t('practice.storyHint')}</p>
        </div>

        {timeField}
      </div>

      <div className="space-y-6">
        {story && (
          <div data-testid="practice-story-card" className="px-5 py-4 bg-bq-cream border-[3px] border-bq-ink rounded-2xl shadow-[0_4px_0_#1D2B22]">
            <h3 className="m-0 font-display text-[24px] leading-tight font-extrabold">{story.title}</h3>
            <p className="m-0 mt-1 font-read text-[15px] text-bq-ink2">
              {story.ref} · {t(story.testament === 'OT' ? 'practice.oldTestament' : 'practice.newTestament')}
            </p>
            <p className="m-0 mt-3 text-[16px] font-extrabold">{t('practice.storyQuestions', { count: story.questionCount })}</p>
            <p className={hint}>{t('practice.storySource')}</p>
          </div>
        )}
        {suggestions.length > 0 && (
          <div>
            <span className={label}>{t('practice.storySuggest')}</span>
            <div className="flex flex-wrap gap-2">
              {suggestions.map(s => (
                <button
                  key={s.id}
                  data-testid={`practice-story-suggest-${s.id}`}
                  type="button"
                  aria-pressed={selectedStory === s.id}
                  onClick={() => setSelectedStory(s.id)}
                  className={`px-3.5 py-1.5 border-2 border-bq-ink rounded-full text-[14px] font-bold shadow-[0_3px_0_#1D2B22] transition-transform hover:-translate-y-0.5 ${
                    selectedStory === s.id ? 'bg-bq-amber' : 'bg-bq-white'
                  }`}
                >
                  {s.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )

  // The study nook (LKF-8): set up a practice run on a parchment scroll at the reading desk.
  return (
    <div data-testid="practice-page" className="relative space-y-7 max-w-[1100px] mx-auto">
      <PlaceBackdrop place="study" veil="mid" focus="30% 40%" />

      <section className="flex flex-wrap items-end gap-x-5 gap-y-3">
        <Plaque className="text-[30px] md:text-[38px]">{t('gameModes.practice')}</Plaque>
        <p className="m-0 px-3 py-1 bg-bq-white/90 border-2 border-bq-ink rounded-full font-bold text-[15px]">{t('practice.heroDesc')}</p>
      </section>

      <MemorizeEntryCard isAuthenticated={isAuthenticated} />

      {errorMsg && (
        <div role="alert" className="flex items-center gap-3 p-4 bg-bq-white border-[3px] border-bq-ruby rounded-2xl">
          <img src="/images/lk/hero-lost.webp" alt="" aria-hidden className="h-12" />
          <span className="text-bq-ruby text-[15px] font-bold">{errorMsg}</span>
        </div>
      )}

      <form onSubmit={e => { e.preventDefault(); if (!isDisabled) startQuiz() }}>
        <ScrollPanel bodyClassName="px-5 md:px-9 pt-6 pb-5">
          <div role="group" aria-label={t('practice.scopeLabel')} className="grid grid-cols-2 gap-2.5 mb-6 max-w-[560px]">
            {SCOPES.map(s => (
              <button
                key={s.key}
                data-testid={`practice-scope-${s.key}`}
                type="button"
                aria-pressed={scope === s.key}
                onClick={() => setScope(s.key)}
                className={`flex items-center justify-center gap-2.5 py-2.5 px-2 rounded-2xl border-[3px] border-bq-ink text-[15px] sm:text-[16px] font-extrabold shadow-[0_4px_0_#1D2B22] transition-transform hover:-translate-y-0.5 ${
                  scope === s.key ? 'bg-bq-amber' : 'bg-bq-white'
                }`}
              >
                <img src={s.icon} alt="" aria-hidden className="hidden sm:block h-7" />
                <span className="whitespace-nowrap">{t(s.labelKey)}</span>
              </button>
            ))}
          </div>

          {scope === 'story' ? storyFields : (<>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">
            <div className="space-y-6">
              {languageField}

              <div data-testid="practice-book-select">
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-[15px] font-extrabold">{t('practice.selectBook')}</span>
                  <span className="text-[13px] font-bold text-bq-ink3">{t('practice.bookCount', { current: books.length || 66, total: 66 })}</span>
                </div>
                <SearchableSelect
                  options={books.map(b => ({ value: b.name, label: `${b.nameVi} (${b.name})` }))}
                  value={selectedBook}
                  onChange={setSelectedBook}
                  placeholder={t('practice.searchBook')}
                  allLabel={t('practice.allBooks')}
                />
                <p className={hint}>{t('practice.bookHint')}</p>
              </div>

              <div>
                <span className={label}>{t('practice.questionCount')}</span>
                <div className="flex gap-3">
                  {COUNT_OPTIONS.map(num => (
                    <button
                      key={num}
                      data-testid={`practice-count-${num}`}
                      type="button"
                      aria-pressed={questionCount === num}
                      onClick={() => setQuestionCount(num)}
                      className={`w-14 h-14 rounded-full border-[3px] border-bq-ink font-display text-[19px] font-extrabold transition-transform hover:-translate-y-0.5 ${
                        questionCount === num ? 'bg-bq-amber shadow-[0_0_0_4px_#C68A4E,0_0_0_7px_#1D2B22,0_8px_0_rgba(29,43,34,.4)]' : 'bg-bq-white shadow-[0_4px_0_#1D2B22]'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {timeField}
            </div>

            <div className="space-y-6">
              <div>
                <span className={label}>{t('practice.difficulty')}</span>
                <div className="grid grid-cols-2 gap-2.5">
                  {DIFFICULTY_OPTIONS.map(d => {
                    const active = selectedDifficulty === d.key
                    return (
                      <button
                        key={d.key}
                        data-testid={`practice-difficulty-${d.key}`}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setSelectedDifficulty(d.key)}
                        className={`flex items-center gap-2.5 py-2.5 px-3.5 rounded-2xl border-[3px] border-bq-ink text-[15px] font-extrabold transition-transform hover:-translate-y-0.5 ${
                          active ? 'bg-bq-amber shadow-[0_4px_0_#1D2B22]' : 'bg-bq-white shadow-[0_4px_0_#1D2B22]'
                        }`}
                      >
                        <span aria-hidden className={`w-3.5 h-3.5 rounded-full border-2 border-bq-ink ${DOT[d.key] ?? 'bg-bq-ink'}`} />
                        <span>{t(d.labelKey)}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-[15px] font-extrabold">{t('practice.chapterRange')}</span>
                  {selectedBook && <span className="text-[13px] font-bold text-bq-ink3">{t('practice.chapterMaxHint', { max: maxChapter })}</span>}
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <input
                    data-testid="practice-chapter-from"
                    type="number"
                    min={1}
                    max={maxChapter || undefined}
                    placeholder={t('practice.chapterFromLabel')}
                    aria-label={t('practice.chapterFromLabel')}
                    value={chapterFrom}
                    disabled={!selectedBook}
                    onChange={e => { const v = e.target.value; setChapterFrom(v === '' ? '' : clampInt(Number(v), 1, maxChapter)) }}
                    className={field}
                  />
                  <input
                    data-testid="practice-chapter-to"
                    type="number"
                    min={1}
                    max={maxChapter || undefined}
                    placeholder={t('practice.chapterToLabel')}
                    aria-label={t('practice.chapterToLabel')}
                    value={chapterTo}
                    disabled={!selectedBook}
                    onChange={e => { const v = e.target.value; setChapterTo(v === '' ? '' : clampInt(Number(v), 1, maxChapter)) }}
                    className={field}
                  />
                </div>
                <p className={hint}>{t('practice.chapterRangeHint')}</p>
              </div>

              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-[15px] font-extrabold">
                    {t('practice.verseRange', { chapter: singleChapterSelected ? chapterFrom : '—' })}
                  </span>
                  {singleChapterSelected && maxVerse > 0 && <span className="text-[13px] font-bold text-bq-ink3">{t('practice.verseMaxHint', { max: maxVerse })}</span>}
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <input
                    data-testid="practice-verse-from"
                    type="number"
                    min={1}
                    max={maxVerse || undefined}
                    placeholder={t('practice.verseFromLabel')}
                    aria-label={t('practice.verseFromLabel')}
                    value={verseFrom}
                    disabled={!singleChapterSelected}
                    onChange={e => { const v = e.target.value; setVerseFrom(v === '' ? '' : clampInt(Number(v), 1, maxVerse)) }}
                    className={field}
                  />
                  <input
                    data-testid="practice-verse-to"
                    type="number"
                    min={1}
                    max={maxVerse || undefined}
                    placeholder={t('practice.verseToLabel')}
                    aria-label={t('practice.verseToLabel')}
                    value={verseTo}
                    disabled={!singleChapterSelected}
                    onChange={e => { const v = e.target.value; setVerseTo(v === '' ? '' : clampInt(Number(v), 1, maxVerse)) }}
                    className={field}
                  />
                </div>
                <p className={hint}>{t('practice.verseRangeHint')}</p>
              </div>
            </div>
          </div>

          {rangeError && (
            <div data-testid="practice-range-error" role="alert" className="mt-5 px-4 py-2.5 bg-bq-white border-[3px] border-bq-ruby rounded-xl text-bq-ruby text-[14px] font-bold">
              {rangeError}
            </div>
          )}
          </>)}

          <div className="mt-6 pt-5 border-t-2 border-dashed border-bq-hair flex flex-col sm:flex-row items-center justify-between gap-4">
            <button
              data-testid="practice-show-explanation-toggle"
              type="button"
              role="switch"
              aria-checked={showExplanation}
              onClick={() => setShowExplanation(p => !p)}
              className="flex items-center gap-3 text-[15px] font-extrabold"
            >
              <img src={showExplanation ? '/images/lk/lantern-on.webp' : '/images/lk/lantern-off.webp'} alt="" aria-hidden className="h-8" />
              <span>{t('practice.showExplanation')}</span>
              <span className={`w-12 h-7 p-[3px] rounded-full border-2 border-bq-ink transition-colors ${showExplanation ? 'bg-bq-amber' : 'bg-bq-track'}`}>
                <span className={`block w-[18px] h-[18px] rounded-full bg-bq-white border-2 border-bq-ink transition-transform ${showExplanation ? 'translate-x-[20px]' : ''}`} />
              </span>
            </button>
            <div className="flex flex-col items-center gap-1.5 w-full sm:w-auto">
              <button
                data-testid="practice-start-btn"
                type="submit"
                disabled={isDisabled}
                className="lk-btn w-full sm:w-auto sm:min-w-[260px] text-bq-ink text-[19px]"
              >
                {isLoading || (scope === 'book' && isBooksLoading) ? t('practice.starting') : t('practice.start')}
              </button>
              <span className="text-[13px] font-bold text-bq-ink3">
                {scope === 'story'
                  ? (story ? `${story.questionCount} · ~${estimatedMins} ${t('practice.stats.minutes').toLowerCase()}` : t('practice.chooseStory'))
                  : <>{questionCount} · ~{estimatedMins} {t('practice.stats.minutes').toLowerCase()} · {bookCount} {t('practice.stats.books').toLowerCase()}</>}
              </span>
            </div>
          </div>
        </ScrollPanel>
      </form>

      {wrongCount != null && wrongCount > 0 && (
        <div data-testid="practice-retry-wrong" className="flex flex-wrap items-center gap-3 px-4 py-3.5 bg-bq-white border-[3px] border-bq-ink rounded-bq shadow-bq-card">
          <img src="/images/lk/scroll.webp" alt="" aria-hidden className="h-10 shrink-0" />
          <div className="flex-1 min-w-[180px]">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-[16px]">{t('practice.retryWrongTitle')}</span>
              <span className="px-2 bg-bq-ruby text-bq-white border-2 border-bq-ink rounded-full text-[12px] font-extrabold">{wrongCount}</span>
            </div>
            <p className="m-0 font-read text-[13.5px] text-bq-ink2">{t('practice.retryWrongDesc')}</p>
          </div>
          <button
            data-testid="practice-retry-wrong-btn"
            onClick={() => {
              api.post('/api/sessions/practice/retry-wrong')
                .then(res => navigate('/quiz', { state: { sessionId: res.data.sessionId, questions: res.data.questions, mode: 'practice' } }))
                .catch(() => setErrorMsg(t('practice.errorCreate')))
            }}
            className="lk-btn lk-btn-2 text-bq-ink text-[15px]"
          >
            {t('practice.retryButton')}
          </button>
        </div>
      )}

      {recentSessions && recentSessions.length > 0 && (
        <section aria-labelledby="practice-recent-title">
          <Plaque as="h2" id="practice-recent-title" className="text-[20px] mb-3">{t('practice.recentSessions')}</Plaque>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recentSessions.map(session => (
              <div key={session.sessionId} className="flex items-center gap-3 px-4 py-3 bg-bq-white border-[3px] border-bq-ink rounded-bq shadow-bq-card">
                <span className={`shrink-0 w-14 h-14 grid place-items-center rounded-full border-[3px] border-bq-ink font-display font-extrabold text-[15px] shadow-[0_0_0_3px_#C68A4E,0_0_0_6px_#1D2B22] ${
                  session.accuracy >= 80 ? 'bg-bq-leaf' : session.accuracy >= 60 ? 'bg-bq-cream' : 'bg-bq-white'
                }`}>
                  {session.accuracy}%
                </span>
                <div className="min-w-0">
                  <p className="m-0 text-[15px] font-extrabold truncate">
                    {session.story
                      ? storyTitles.get(session.story) ?? t('practice.storyFallback')
                      : session.book || t('practice.allBooks')}
                  </p>
                  <p className="m-0 text-[13px] font-bold text-bq-ink3">
                    {session.correctAnswers}/{session.totalQuestions}{relativeDate(session.createdAt) ? ` · ${relativeDate(session.createdAt)}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex items-center gap-3 px-4 py-3 bg-bq-cream border-[3px] border-bq-ink rounded-2xl">
        <img src="/images/lk/lantern-on.webp" alt="" aria-hidden className="h-9 shrink-0" />
        <div>
          <p className="m-0 text-[13px] font-extrabold text-bq-amberd">{t('practice.tipsBadge')}</p>
          <p className="m-0 font-read text-[14px] text-bq-ink2">{tipOfTheDay}</p>
        </div>
      </div>

      <Link to="/" className="inline-block px-4 py-1.5 bg-bq-white/90 border-2 border-bq-ink rounded-full text-[14px] font-bold hover:bg-bq-cream">
        {t('practice.backToHome')}
      </Link>
    </div>
  )
}
