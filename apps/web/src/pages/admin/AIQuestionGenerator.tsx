import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { api, aiApi } from '../../api/client'
import { getChapterCount, getVerseCount } from '../../data/bibleData'
import { useBookName } from '../../hooks/useBookName'
import DraftCard from './ai-generator/DraftCard'
import {
  type Difficulty, type QuestionType, type DraftQuestion,
  type DistractorMeta, type QualityFlags,
  normalizeType, CLAUDE_MODELS, loadDraftsFromStorage, saveDraftsToStorage,
} from './ai-generator/types'

const BOOKS = [
  'Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth',
  '1 Samuel','2 Samuel','1 Kings','2 Kings','1 Chronicles','2 Chronicles',
  'Ezra','Nehemiah','Esther','Job','Psalms','Proverbs','Ecclesiastes',
  'Song of Songs','Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel',
  'Hosea','Joel','Amos','Obadiah','Jonah','Micah','Nahum','Habakkuk',
  'Zephaniah','Haggai','Zechariah','Malachi',
  'Matthew','Mark','Luke','John','Acts','Romans','1 Corinthians','2 Corinthians',
  'Galatians','Ephesians','Philippians','Colossians','1 Thessalonians',
  '2 Thessalonians','1 Timothy','2 Timothy','Titus','Philemon','Hebrews',
  'James','1 Peter','2 Peter','1 John','2 John','3 John','Jude','Revelation',
]

// Sentinel for the "all books" option: AI draws from the whole Bible (topic-driven),
// each generated question self-declares its own book/chapter/verse.
const ALL_BOOKS = 'ALL'

const DEFAULT_PROMPT =
`Tạo {count} câu hỏi trắc nghiệm ({type}) về đoạn Kinh Thánh sau:
Sách: {book}, Chương {chapter}, Câu {verseStart}-{verseEnd}
Nội dung: {scriptureText}
Độ khó: {difficulty} | Ngôn ngữ: {language}

Yêu cầu:
- Mỗi câu có 4 lựa chọn (A–D), chỉ 1 đáp án đúng
- Có giải thích chi tiết dựa trên Kinh Thánh
- Đúng với nội dung Kinh Thánh, không thêm thần học bên ngoài`

// ─────────────────────────────────────────────────────────────────────────────

export default function AIQuestionGenerator() {
  const { t, i18n } = useTranslation()
  const getBookName = useBookName()
  const bookLang = i18n.language === 'en' ? 'en' : 'vi'
  // Form
  const [book, setBook]               = useState('')
  const [chapter, setChapter]         = useState(1)
  const [chapterEnd, setChapterEnd]   = useState(1)
  const [verseStart, setVerseStart]   = useState(1)
  const [verseEnd, setVerseEnd]       = useState(1)
  const [scriptureText, setText]      = useState('')
  const [difficulty, setDifficulty]   = useState<Difficulty>('easy')
  const [qType, setQType]             = useState<QuestionType>('multiple_choice_single')
  const [language, setLanguage]       = useState('vi')
  const [count, setCount]             = useState(3)
  const [provider, setProvider]       = useState<'deepseek' | 'gemini' | 'claude'>('deepseek')
  const [claudeModels, setClaudeModels] = useState<string[]>(['auto'])
  const [claudeAutoMode, setClaudeAutoMode] = useState(true)
  const [prompt, setPrompt]           = useState(DEFAULT_PROMPT)
  const [showPrompt, setShowPrompt]   = useState(false)

  // AI info
  const [aiInfo, setAiInfo] = useState<{
    providers: {
      deepseek: { configured: boolean; model: string }
      gemini: { configured: boolean; model: string }
      claude: { configured: boolean; model: string }
    }
    defaultProvider?: string
  } | null>(null)
  useEffect(() => {
    api.get('/api/admin/ai/info').then(r => setAiInfo(r.data)).catch(() => {})
  }, [])

  // State
  const [isGenerating, setIsGenerating]   = useState(false)
  const [isSavingAll, setIsSavingAll]     = useState(false)
  const [error, setError]                 = useState<string | null>(null)
  const [drafts, setDrafts]               = useState<DraftQuestion[]>(loadDraftsFromStorage)
  const [editingId, setEditingId]         = useState<string | null>(null)
  const [editData, setEditData]           = useState<Partial<DraftQuestion>>({})
  const [savingId, setSavingId]           = useState<string | null>(null)

  // Persist drafts to sessionStorage whenever they change
  useEffect(() => {
    saveDraftsToStorage(drafts)
  }, [drafts])

  const isAllBooks    = book === ALL_BOOKS
  const totalChapters = book && !isAllBooks ? getChapterCount(book) : 0
  const maxVerseStart = book && !isAllBooks && chapter    ? getVerseCount(book, chapter)    : 30
  const maxVerseEnd   = book && !isAllBooks && chapterEnd ? getVerseCount(book, chapterEnd) : 30
  const isRange       = !isAllBooks && chapterEnd > chapter

  const onBookChange = (b: string) => {
    setBook(b); setChapter(1); setChapterEnd(1); setVerseStart(1); setVerseEnd(1)
  }
  const onChapterChange = (c: number) => {
    setChapter(c)
    if (chapterEnd < c) setChapterEnd(c)
    setVerseStart(1)
    setVerseEnd(getVerseCount(book, c))
  }
  const onChapterEndChange = (c: number) => {
    setChapterEnd(c)
    setVerseEnd(getVerseCount(book, c))
  }

  const scriptureRef = isRange
    ? `${book} ${chapter}-${chapterEnd}`
    : `${book} ${chapter}:${verseStart}-${verseEnd}`

  // Only send custom prompt when the user has actually edited it
  const customPromptToSend = prompt !== DEFAULT_PROMPT ? prompt
    .replace('{count}', String(count))
    .replace('{type}', qType)
    .replace('{book}', book)
    .replace('{chapter}', String(chapter))
    .replace('{verseStart}', String(verseStart))
    .replace('{verseEnd}', String(verseEnd))
    .replace('{scriptureText}', scriptureText || t('admin.aiGenerator.promptNoText'))
    .replace('{difficulty}', difficulty)
    .replace('{language}', language)
    : undefined

  const handleGenerate = async () => {
    if (!book) { setError(t('admin.aiGenerator.errorBookRequired')); return }
    if (!chapter) { setError(t('admin.aiGenerator.errorChapterRequired')); return }
    setError(null)
    setIsGenerating(true)
    try {
      const res = await aiApi.post('/api/admin/ai/generate', {
        scripture: {
          book,
          chapter:    isAllBooks ? 1 : chapter,
          chapterEnd: (!isAllBooks && isRange) ? chapterEnd : undefined,
          verseStart: isAllBooks ? 1 : (isRange ? 1 : verseStart),
          verseEnd:   isAllBooks ? 1 : (isRange ? maxVerseEnd : verseEnd),
          text: scriptureText || undefined,
        },
        prompt: customPromptToSend,
        difficulty,
        type: qType,
        language,
        count,
        provider,
        claudeModels: provider === 'claude' ? (claudeAutoMode ? ['auto'] : claudeModels) : undefined,
      })
      const raw: any[] = res.data.questions ?? []
      const newDrafts: DraftQuestion[] = raw.map((q, i) => ({
        id:            `draft-${Date.now()}-${i}`,
        status:        'pending',
        // In all-books mode each question self-declares its reference — trust the
        // AI's per-question book/chapter/verse instead of the (placeholder) form values.
        book:          isAllBooks ? (q.book ?? '') : book,
        chapter:       isAllBooks ? (Number(q.chapter) || 1) : chapter,
        verseStart:    isAllBooks ? (Number(q.verseStart) || 1) : verseStart,
        verseEnd:      isAllBooks ? (Number(q.verseEnd ?? q.verseStart) || 1) : verseEnd,
        difficulty:    (q.difficulty ?? difficulty) as Difficulty,
        type:          normalizeType(q.type ?? qType),
        language:      q.language ?? language,
        content:       q.content ?? q.question ?? '',
        options:       Array.isArray(q.options) ? q.options : [],
        correctAnswer: Array.isArray(q.correctAnswer)
          ? q.correctAnswer
          : typeof q.correctAnswer === 'number'
            ? q.correctAnswer
            : Array.isArray(q.options) ? q.options.indexOf(q.answer) : 0,
        explanation:   q.explanation ?? '',
        tags:          Array.isArray(q.tags) ? q.tags : [],
        source:        q.source ?? t('admin.aiGenerator.sourceFallback'),
        generatedBy:   q._generatedBy,
        distractors:   Array.isArray(q.distractors) ? (q.distractors as DistractorMeta[]) : undefined,
        quality:       (q._quality ?? undefined) as QualityFlags | undefined,
      }))
      setDrafts(prev => [...newDrafts, ...prev])
    } catch (e: any) {
      setError(e.response?.data?.message ?? t('admin.aiGenerator.errorGenerate'))
    } finally {
      setIsGenerating(false)
    }
  }

  const startEdit = (d: DraftQuestion) => { setEditingId(d.id); setEditData({ ...d }) }
  const cancelEdit = () => { setEditingId(null); setEditData({}) }

  const saveEdit = () => {
    // Editing is an admin override: clear the AI quality flag so a manually-fixed
    // draft is no longer gated by the (now-stale) distractor checks.
    setDrafts(prev => prev.map(d => d.id === editingId ? { ...d, ...editData, quality: undefined } as DraftQuestion : d))
    cancelEdit()
  }

  const buildSavePayload = (d: DraftQuestion) => {
    const correctAnswerList = Array.isArray(d.correctAnswer)
      ? d.correctAnswer
      : [d.correctAnswer as number]
    return {
      book: d.book, chapter: d.chapter,
      verseStart: d.verseStart, verseEnd: d.verseEnd,
      difficulty: d.difficulty, type: normalizeType(d.type), language: d.language,
      content: d.content, options: d.options ?? [],
      correctAnswer: correctAnswerList,
      explanation: d.explanation,
      tags: JSON.stringify(Array.isArray(d.tags) ? d.tags : (d.tags ? [d.tags] : [])),
      source: d.source,
      isActive: true,
    }
  }

  const approveDraft = async (draft: DraftQuestion) => {
    const d = editingId === draft.id ? { ...draft, ...editData } as DraftQuestion : draft
    setSavingId(d.id)
    // Clear any previous save error on this draft
    setDrafts(prev => prev.map(x => x.id === d.id ? { ...x, saveError: undefined } : x))
    try {
      const res = await api.post('/api/admin/questions?pending=true', buildSavePayload(d))
      setDrafts(prev => prev.map(x => x.id === d.id
        ? { ...x, ...d, status: 'approved', approvedId: res.data?.id, saveError: undefined } : x))
      if (editingId === d.id) cancelEdit()
    } catch (e: any) {
      const msg = e.response?.data?.message ?? t('admin.aiGenerator.errorSave')
      setDrafts(prev => prev.map(x => x.id === d.id ? { ...x, saveError: msg } : x))
    } finally {
      setSavingId(null)
    }
  }

  const saveAllPending = async () => {
    const pending = drafts.filter(d => d.status === 'pending')
    if (pending.length === 0) return
    setIsSavingAll(true)
    for (const draft of pending) {
      setSavingId(draft.id)
      setDrafts(prev => prev.map(x => x.id === draft.id ? { ...x, saveError: undefined } : x))
      try {
        const res = await api.post('/api/admin/questions?pending=true', buildSavePayload(draft))
        setDrafts(prev => prev.map(x => x.id === draft.id
          ? { ...x, status: 'approved', approvedId: res.data?.id, saveError: undefined } : x))
      } catch (e: any) {
        const msg = e.response?.data?.message ?? t('admin.aiGenerator.errorSave')
        setDrafts(prev => prev.map(x => x.id === draft.id ? { ...x, saveError: msg } : x))
      }
    }
    setSavingId(null)
    setIsSavingAll(false)
  }

  const rejectDraft  = (id: string) => setDrafts(prev => prev.map(d => d.id === id ? { ...d, status: 'rejected' } : d))
  const restoreDraft = (id: string) => setDrafts(prev => prev.map(d => d.id === id ? { ...d, status: 'pending'  } : d))
  const removeDraft  = (id: string) => setDrafts(prev => prev.filter(d => d.id !== id))

  const pendingCount  = drafts.filter(d => d.status === 'pending').length
  const approvedCount = drafts.filter(d => d.status === 'approved').length

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div data-testid="ai-generator-page" className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-extrabold text-[#1D2B22] tracking-tight flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[#8A5A12] text-2xl">psychology</span>
            {t('admin.aiGenerator.title')}
          </h2>
          <p className="text-[#4D3A1F]/60 text-sm mt-1">{t('admin.aiGenerator.subtitle')}</p>
          {aiInfo && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {(['deepseek', 'gemini', 'claude'] as const).map(p => {
                const info = aiInfo.providers[p]
                if (!info) return null
                const label = p === 'deepseek' ? 'DeepSeek' : p === 'gemini' ? 'Gemini' : 'Claude'
                return (
                  <span key={p} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#1D2B22]/[0.04] border border-[#1D2B22]/15 text-[#4D3A1F]/70">
                    <span className={`w-1.5 h-1.5 rounded-full ${info.configured ? 'bg-emerald-400' : 'bg-red-400/70'}`} />
                    {label} {info.configured ? info.model : t('admin.aiGenerator.notConfigured')}
                  </span>
                )
              })}
            </div>
          )}
        </div>
        {drafts.length > 0 && (
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <span className="px-3 py-1 rounded-full bg-yellow-500/20 text-[#8A5A12] font-bold border border-yellow-500/30">
              {t('admin.aiGenerator.pendingChip', { count: pendingCount })}
            </span>
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-[#2E7D4F] font-bold border border-emerald-500/30">
              {t('admin.aiGenerator.approvedChip', { count: approvedCount })}
            </span>
            {pendingCount > 1 && (
              <button
                onClick={saveAllPending}
                disabled={isSavingAll}
                className="px-3 py-1 rounded-full bg-[#2E7D4F]/20 text-[#8A5A12] font-bold border border-[#2E7D4F]/30 hover:bg-[#2E7D4F]/30 transition-colors disabled:opacity-50">
                {isSavingAll ? t('admin.aiGenerator.saveAllSaving') : t('admin.aiGenerator.saveAllButton', { count: pendingCount })}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">

        {/* ══════════════════ FORM PANEL ══════════════════ */}
        <div className="bg-[#FFF8E7] rounded-lg border border-[#1D2B22]/10 p-5 space-y-5">

          {/* Scripture ref */}
          <div data-testid="ai-scripture-selector">
            <h3 className="text-xs font-bold text-[#4D3A1F]/70 uppercase tracking-wider mb-3">
              {t('admin.aiGenerator.scriptureSectionTitle')}
            </h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-bold text-[#4D3A1F] uppercase tracking-wider mb-1.5">{t('admin.aiGenerator.bookLabel')}</label>
                <select value={book} onChange={e => onBookChange(e.target.value)} className="form-select">
                  <option value="">{t('admin.aiGenerator.bookPlaceholder')}</option>
                  <option value={ALL_BOOKS}>{t('admin.aiGenerator.allBooksOption')}</option>
                  <optgroup label={t('admin.aiGenerator.oldTestament')}>
                    {BOOKS.slice(0, 39).map(b => <option key={b} value={b}>{getBookName(b, bookLang)}</option>)}
                  </optgroup>
                  <optgroup label={t('admin.aiGenerator.newTestament')}>
                    {BOOKS.slice(39).map(b => <option key={b} value={b}>{getBookName(b, bookLang)}</option>)}
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#4D3A1F] uppercase tracking-wider mb-1.5">
                  {t('admin.aiGenerator.chapterLabel')} {totalChapters > 0 && <span className="text-[#4D3A1F]/50 normal-case font-normal">{t('admin.aiGenerator.chaptersCount', { count: totalChapters })}</span>}
                </label>
                <div className="flex items-center gap-1.5">
                  <select value={chapter} onChange={e => onChapterChange(Number(e.target.value))}
                    disabled={!book || isAllBooks} className="form-select flex-1">
                    {Array.from({length: totalChapters}, (_, i) => i + 1).map(c =>
                      <option key={c} value={c}>{c}</option>)}
                  </select>
                  <span className="text-[#4D3A1F] text-xs font-bold">{t('admin.aiGenerator.chapterTo')}</span>
                  <select value={chapterEnd} onChange={e => onChapterEndChange(Number(e.target.value))}
                    disabled={!book || isAllBooks} className="form-select flex-1">
                    {Array.from({length: totalChapters}, (_, i) => i + 1)
                      .filter(c => c >= chapter)
                      .map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </div>
            {isAllBooks && (
              <p className="text-xs text-[#8A5A12]/80 mb-3 -mt-1">{t('admin.aiGenerator.allBooksHint')}</p>
            )}
            {!isRange && (
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-bold text-[#4D3A1F] uppercase tracking-wider mb-1.5">
                  {t('admin.aiGenerator.verseStartLabel')} <span className="text-[#4D3A1F]/50 normal-case font-normal">{t('admin.aiGenerator.verseStartMax', { count: maxVerseStart })}</span>
                </label>
                <select value={verseStart} onChange={e => { const v = Number(e.target.value); setVerseStart(v); if (verseEnd < v) setVerseEnd(v) }}
                  disabled={!book || isAllBooks} className="form-select">
                  {Array.from({length: maxVerseStart}, (_, i) => i + 1).map(v =>
                    <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#4D3A1F] uppercase tracking-wider mb-1.5">
                  {t('admin.aiGenerator.verseEndLabel')} <span className="text-[#4D3A1F]/50 normal-case font-normal">{t('admin.aiGenerator.verseStartMax', { count: maxVerseEnd })}</span>
                </label>
                <select value={verseEnd} onChange={e => setVerseEnd(Number(e.target.value))}
                  disabled={!book || isAllBooks} className="form-select">
                  {Array.from({length: maxVerseEnd}, (_, i) => i + 1)
                    .filter(v => v >= verseStart)
                    .map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>
            )}
            <div>
              <label className="block text-xs font-bold text-[#4D3A1F] uppercase tracking-wider mb-1.5">
                {t('admin.aiGenerator.scriptureTextLabel')} <span className="text-[#4D3A1F]/50 normal-case font-normal">{t('admin.aiGenerator.scriptureTextHint')}</span>
              </label>
              <textarea rows={3} value={scriptureText} onChange={e => setText(e.target.value)}
                placeholder={t('admin.aiGenerator.scriptureTextPlaceholder')}
                className="form-input resize-none text-sm" />
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-[#1D2B22]/30" />
            <span className="text-xs text-[#4D3A1F]/50 font-bold tracking-wider">{t('admin.aiGenerator.settingsDivider')}</span>
            <div className="flex-1 h-px bg-[#1D2B22]/30" />
          </div>

          {/* Difficulty */}
          <div data-testid="ai-settings-panel">
            <label className="block text-xs font-bold text-[#4D3A1F] uppercase tracking-wider mb-1.5">{t('admin.aiGenerator.difficultyLabel')}</label>
            <div className="segmented-control">
              {(['easy','medium','hard'] as Difficulty[]).map(d => (
                <button key={d} onClick={() => setDifficulty(d)}
                  className={`segmented-control-item flex-1 cursor-pointer${difficulty === d ? ' active' : ''}`}>
                  {d === 'easy' ? t('admin.aiGenerator.difficultyEasy') : d === 'medium' ? t('admin.aiGenerator.difficultyMedium') : t('admin.aiGenerator.difficultyHard')}
                </button>
              ))}
            </div>
          </div>

          {/* Type + Language */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#4D3A1F] uppercase tracking-wider mb-1.5">{t('admin.aiGenerator.typeLabel')}</label>
              <select value={qType} onChange={e => setQType(e.target.value as QuestionType)} className="form-select text-sm">
                <option value="multiple_choice_single">{t('admin.aiGenerator.typeMcSingle')}</option>
                <option value="multiple_choice_multi">{t('admin.aiGenerator.typeMcMulti')}</option>
                <option value="true_false">{t('admin.aiGenerator.typeTrueFalse')}</option>
                <option value="fill_in_blank">{t('admin.aiGenerator.typeFillBlank')}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#4D3A1F] uppercase tracking-wider mb-1.5">{t('admin.aiGenerator.languageLabel')}</label>
              <div className="segmented-control">
                {['vi','en'].map(l => (
                  <button key={l} onClick={() => setLanguage(l)}
                    className={`segmented-control-item flex-1 cursor-pointer${language === l ? ' active' : ''}`}>
                    {l === 'vi' ? t('admin.aiGenerator.languageVi') : t('admin.aiGenerator.languageEn')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Count slider */}
          <div>
            <label className="block text-xs font-bold text-[#4D3A1F] uppercase tracking-wider mb-2">
              {t('admin.aiGenerator.countLabel')} <span className="text-[#8A5A12] font-black text-sm">{count}</span>
            </label>
            <div className="flex items-center gap-3">
              <span className="text-xs text-[#4D3A1F]/50">1</span>
              <input type="range" min={1} max={10} value={count} onChange={e => setCount(Number(e.target.value))}
                className="flex-1 accent-[#2E7D4F] cursor-pointer" />
              <span className="text-xs text-[#4D3A1F]/50">10</span>
            </div>
          </div>

          {/* Provider selector */}
          <div>
            <label className="block text-xs font-bold text-[#4D3A1F] uppercase tracking-wider mb-1.5">{t('admin.aiGenerator.providerLabel')}</label>
            <div data-testid="ai-provider-select" className="segmented-control">
              {(['deepseek', 'gemini', 'claude'] as const).map(p => {
                const info = aiInfo?.providers[p]
                const configured = info?.configured ?? false
                // Gemini & Claude tạm khoá — chưa dùng đến, sẽ làm sau.
                const locked = p === 'gemini' || p === 'claude'
                const labelText = p === 'deepseek' ? '★ DeepSeek' : p === 'gemini' ? '✦ Gemini' : '◆ Claude'
                const isDefault = p === 'deepseek'
                return (
                  <button key={p} data-testid={`ai-provider-${p}`}
                    onClick={() => { if (!locked) setProvider(p) }}
                    disabled={locked} aria-disabled={locked}
                    title={locked ? t('admin.aiGenerator.providerLocked') : undefined}
                    className={`segmented-control-item flex-1${locked ? ' opacity-50 cursor-not-allowed' : ' cursor-pointer'}${provider === p ? ' active' : ''}`}>
                    {labelText}
                    {isDefault && (
                      <span data-testid="ai-provider-default-badge"
                        className="ml-1 text-[9px] font-black tracking-wider bg-[#FFC93C] text-[#1D2B22] px-1 py-0.5 rounded">
                        DEFAULT
                      </span>
                    )}
                    {locked
                      ? <span className="material-symbols-outlined ml-1 text-[13px] align-middle leading-none">lock</span>
                      : (!configured && <span className="ml-1 text-[10px]">⚠</span>)}
                  </button>
                )
              })}
            </div>
            {aiInfo && !aiInfo.providers[provider]?.configured && (
              <p className="text-xs text-yellow-600 mt-1.5">
                {provider === 'claude' ? t('admin.aiGenerator.missingClaudeKey')
                  : provider === 'gemini' ? t('admin.aiGenerator.missingGeminiKey')
                  : t('admin.aiGenerator.missingDeepseekKey')}
              </p>
            )}
          </div>

          {/* Claude model selector */}
          {provider === 'claude' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-[#4D3A1F] uppercase tracking-wider">{t('admin.aiGenerator.claudeModelsLabel')}</label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={claudeAutoMode} onChange={e => setClaudeAutoMode(e.target.checked)}
                    className="accent-[#8A5A12] w-3.5 h-3.5" />
                  <span className="text-xs font-bold text-[#8A5A12]">{t('admin.aiGenerator.claudeAutoLabel')}</span>
                </label>
              </div>

              {claudeAutoMode ? (
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { diffKey: 'easy', label: t('admin.aiGenerator.difficultyEasy'), model: 'Haiku 4.5', note: t('admin.aiGenerator.claudeAutoNoteFast') },
                    { diffKey: 'medium', label: t('admin.aiGenerator.difficultyMedium'), model: 'Sonnet 4.5', note: t('admin.aiGenerator.claudeAutoNoteBalanced') },
                    { diffKey: 'hard', label: t('admin.aiGenerator.difficultyHard'), model: 'Sonnet 4.6', note: t('admin.aiGenerator.claudeAutoNoteLatest') },
                  ].map(item => (
                    <div key={item.diffKey} className={`px-2.5 py-2 rounded-lg border text-center transition-all ${
                      difficulty === item.diffKey
                        ? 'bg-[#FFC93C]/10 border-[#8A5A12]/30'
                        : 'bg-[#EFE3C3] border-[#1D2B22]/20 opacity-50'
                    }`}>
                      <div className="text-[10px] font-bold text-[#4D3A1F]">{item.label}</div>
                      <div className="text-xs font-black text-[#8A5A12]">{item.model}</div>
                      <div className="text-[9px] text-[#4D3A1F]/50">{item.note}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {CLAUDE_MODELS.map(m => {
                      const checked = claudeModels.includes(m.id)
                      return (
                        <label key={m.id} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${
                          checked
                            ? 'bg-[#FFC93C]/10 border-[#8A5A12]/30 text-[#8A5A12]'
                            : 'bg-[#EFE3C3] border-[#1D2B22]/20 text-[#4D3A1F]/60 hover:border-[#4D3A1F]/40'
                        }`}>
                          <input type="checkbox" checked={checked} onChange={e => {
                            if (e.target.checked) {
                              setClaudeModels(prev => [...prev.filter(id => id !== 'auto'), m.id])
                            } else {
                              const next = claudeModels.filter(id => id !== m.id)
                              setClaudeModels(next.length === 0 ? [m.id] : next)
                            }
                          }} className="accent-[#8A5A12] w-3.5 h-3.5 flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="text-xs font-bold truncate">{m.label}</div>
                            <div className="text-[10px] text-[#4D3A1F]/50">{t(m.noteKey)}</div>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                  {claudeModels.filter(id => id !== 'auto').length > 1 && (
                    <p className="text-xs text-[#8A5A12] mt-1.5 font-medium">
                      {t('admin.aiGenerator.claudeModelsMultiplier', { models: claudeModels.length, count, total: claudeModels.length * count })}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Prompt toggle */}
          <div>
            <button onClick={() => setShowPrompt(p => !p)}
              className="flex items-center gap-1.5 text-xs font-bold text-[#8A5A12] hover:text-[#8A5A12]/80 transition-colors">
              <svg className={`w-3.5 h-3.5 transition-transform ${showPrompt ? 'rotate-90' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
              {showPrompt ? t('admin.aiGenerator.hidePrompt') : t('admin.aiGenerator.showPrompt')}
            </button>
            {showPrompt && (
              <div className="mt-2 space-y-1.5">
                <p className="text-xs text-[#4D3A1F]/60">
                  {t('admin.aiGenerator.promptDesc')}
                </p>
                <textarea rows={7} value={prompt} onChange={e => setPrompt(e.target.value)}
                  className="form-input resize-none text-xs font-mono leading-relaxed" />
                <button onClick={() => setPrompt(DEFAULT_PROMPT)}
                  className="text-xs text-[#4D3A1F]/40 hover:text-[#8A5A12] transition-colors">
                  {t('admin.aiGenerator.resetPromptButton')}
                </button>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 px-4 py-3 rounded bg-red-500/10 border border-red-500/30">
              <span className="material-symbols-outlined text-[#B3452F] text-sm mt-0.5">error</span>
              <p className="text-[#B3452F] text-sm font-semibold leading-snug">{error}</p>
            </div>
          )}

          {/* Generate button */}
          <button data-testid="ai-generate-btn" onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full py-4 gold-gradient text-[#1D2B22] font-black uppercase tracking-[0.2em] rounded-lg flex items-center justify-center gap-3 transition-transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed">
            {isGenerating ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {t('admin.aiGenerator.generating')}
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {t('admin.aiGenerator.generateButton', { count })}
              </>
            )}
          </button>
        </div>

        {/* ══════════════════ DRAFTS PANEL ══════════════════ */}
        <div className="space-y-4">
          {drafts.length === 0 ? (
            <div className="bg-[#FFF8E7] rounded-lg border border-[#1D2B22]/10 p-12 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-full bg-[#FFF8E7] flex items-center justify-center mb-4">
                <svg className="w-10 h-10 text-[#4D3A1F]/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <p className="text-[#4D3A1F]/60 font-bold text-base">{t('admin.aiGenerator.draftsEmptyTitle')}</p>
              <p className="text-[#4D3A1F]/50 text-sm mt-1 max-w-xs">
                {t('admin.aiGenerator.draftsEmptyHint')}
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-[#4D3A1F]/60 uppercase tracking-widest">
                  {t('admin.aiGenerator.draftsHeader', { count: drafts.length })}
                </span>
                <button onClick={() => setDrafts([])}
                  className="text-xs text-[#4D3A1F]/60 hover:text-[#B3452F] transition-colors font-medium">
                  {t('admin.aiGenerator.clearAllButton')}
                </button>
              </div>

              {drafts.map(draft => (
                <DraftCard
                  key={draft.id}
                  draft={draft}
                  isEditing={editingId === draft.id}
                  isSaving={savingId === draft.id}
                  editData={editData}
                  onEdit={() => startEdit(draft)}
                  onChange={(field, val) => setEditData(p => ({ ...p, [field]: val }))}
                  onSaveEdit={saveEdit}
                  onCancelEdit={cancelEdit}
                  onApprove={() => approveDraft(draft)}
                  onReject={() => rejectDraft(draft.id)}
                  onRestore={() => restoreDraft(draft.id)}
                  onRemove={() => removeDraft(draft.id)}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// DraftCard component extracted to ./ai-generator/DraftCard.tsx
