import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { Question } from './questionTypes'
import { useBookName } from '../../hooks/useBookName'
import AdminSelect from '../../components/ui/AdminSelect'

// ── Types ─────────────────────────────────────────────────────────────────────
// Question + shared editor types/helpers now live in ./questionTypes (QED-1).

interface ApiPage { questions: Question[]; total: number; page: number; size: number; totalPages: number }

// Import & duplicate-check API shapes (POST /api/admin/questions/import?dryRun=… and 409 POSSIBLE_DUPLICATE).
interface ImportError {
  line?: number
  index?: number
  error: string
}
interface ImportDryResult {
  willImport: number
  errors?: ImportError[]
}
interface ImportResult {
  imported: number
  errors?: ImportError[]
}

// ── Constants ──────────────────────────────────────────────────────────────────

const TYPE_LABEL_KEYS: Record<string, string> = {
  multiple_choice_single: 'admin.questions.filter.mcSingle',
  multiple_choice_multi:  'admin.questions.filter.mcMulti',
  true_false:             'admin.questions.filter.trueFalse',
  fill_in_blank:          'admin.questions.filter.fillBlank',
}

function typeLabel(type: string | undefined, t: TFunction): string {
  if (!type) return '—'
  const key = TYPE_LABEL_KEYS[type]
  return key ? (t(key) as string) : type
}

const DIFF_COLOR: Record<string, string> = {
  easy:   'bg-emerald-600/20 text-[#2E7D4F] border-emerald-500/30',
  medium: 'bg-amber-600/20 text-[#8A5A12] border-amber-500/30',
  hard:   'bg-rose-600/20 text-[#B3452F] border-rose-500/30',
}

const STATUS_COLOR: Record<string, string> = {
  ACTIVE:   'bg-emerald-600/20 text-[#2E7D4F] border-emerald-500/30',
  PENDING:  'bg-yellow-600/20 text-[#8A5A12] border-yellow-500/30',
  REJECTED: 'bg-red-600/20 text-[#B3452F] border-red-500/30',
}

// ── Badges ────────────────────────────────────────────────────────────────────

const Badge: React.FC<{ label: string; color: string }> = ({ label, color }) => (
  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${color}`}>{label}</span>
)

// ── Main Component ─────────────────────────────────────────────────────────────

export default function QuestionsAdmin() {
  const { t, i18n } = useTranslation()
  const getBookName = useBookName()
  const lang = i18n.language === 'en' ? 'en' : 'vi'
  // ── list state
  const [data, setData]         = useState<ApiPage | null>(null)
  const [isLoading, setLoading] = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [page, setPage]         = useState(0)
  const [pageSize, setPageSize] = useState(25)

  // ── filter state
  const [search,       setSearch]       = useState('')
  const [book,         setBook]         = useState('')
  const [difficulty,   setDifficulty]   = useState('')
  const [qType,        setQType]        = useState('')
  const [reviewStatus, setReviewStatus] = useState('')
  const [category,     setCategory]     = useState('')
  const [language,     setLanguage]     = useState('')

  // ── selection
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({})

  const navigate = useNavigate()

  // ── import modal
  const [importOpen,      setImportOpen]      = useState(false)
  const [importFile,      setImportFile]      = useState<File | null>(null)
  const [importDryResult, setImportDryResult] = useState<ImportDryResult | null>(null)
  const [importResult,    setImportResult]    = useState<ImportResult | null>(null)
  const [importLoading,   setImportLoading]   = useState(false)

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchParams = useMemo(() => {
    const p = new URLSearchParams()
    p.set('page', String(page))
    p.set('size', String(pageSize))
    if (book)         p.set('book', book)
    if (difficulty)   p.set('difficulty', difficulty)
    if (qType)        p.set('type', qType)
    if (reviewStatus) p.set('reviewStatus', reviewStatus)
    if (category)     p.set('category', category)
    if (language)     p.set('language', language)
    if (search.trim()) p.set('search', search.trim())
    return p.toString()
  }, [page, pageSize, book, difficulty, qType, reviewStatus, category, language, search])

  const refresh = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await api.get<ApiPage>(`/api/admin/questions?${fetchParams}`)
      setData(res.data)
    } catch (e: any) {
      setError(e?.response?.data?.error ?? e?.message ?? t('admin.questions.error.loading'))
    } finally {
      setLoading(false)
    }
  }, [fetchParams])

  useEffect(() => { refresh() }, [refresh])

  // Reset to page 0 when filters change
  useEffect(() => { setPage(0) }, [search, book, difficulty, qType, reviewStatus, category, language, pageSize])

  // ── Selection ──────────────────────────────────────────────────────────────

  const questions = data?.questions ?? []
  const allChecked = questions.length > 0 && questions.every(q => selectedIds[q.id])
  const anyChecked = questions.some(q => selectedIds[q.id])
  const toggleAll  = (v: boolean) => {
    const m: Record<string, boolean> = {}
    questions.forEach(q => (m[q.id] = v))
    setSelectedIds(prev => ({ ...prev, ...m }))
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  const openCreate = () => navigate('/admin/questions/new')
  const openEdit   = (q: Question) => navigate(`/admin/questions/${q.id}/edit`, { state: { question: q } })

  const duplicate = async (q: Question) => {
    try {
      const { id: _id, createdAt: _c, ...body } = q as any
      await api.post('/api/admin/questions', body)
      await refresh()
    } catch {}
  }

  const deleteOne = async (id: string) => {
    if (!confirm(t('admin.questions.confirm.deleteOne'))) return
    await api.delete(`/api/admin/questions/${id}`)
    await refresh()
  }

  const bulkDelete = async () => {
    const ids = Object.keys(selectedIds).filter(id => selectedIds[id])
    if (!ids.length) return
    if (!confirm(t('admin.questions.confirm.deleteBulk', { count: ids.length }))) return
    await api.delete('/api/admin/questions', { data: { ids } })
    setSelectedIds({})
    await refresh()
  }

  // ── Import ─────────────────────────────────────────────────────────────────

  const runImport = async (dryRun: boolean) => {
    if (!importFile) return
    setImportLoading(true)
    try {
      const form = new FormData()
      form.append('file', importFile)
      const res = await api.post(`/api/admin/questions/import?dryRun=${dryRun}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      if (dryRun) setImportDryResult(res.data)
      else { setImportResult(res.data); await refresh() }
    } catch (e: any) {
      alert(t('admin.questions.error.importAlert', { message: e?.response?.data?.error || e?.message || 'Unknown error' }))
    } finally { setImportLoading(false) }
  }

  const closeImport = () => { setImportOpen(false); setImportFile(null); setImportDryResult(null); setImportResult(null) }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
    <div data-testid="admin-questions-page" className="space-y-4">


      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-extrabold text-[#1D2B22] tracking-tight">{t('admin.questions.title')}</h1>
          <p className="text-[#4D3A1F] text-sm">
            {data ? t('admin.questions.countSuffix', { count: (data.total ?? 0).toLocaleString() }) : t('admin.questions.loading')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span data-testid="admin-questions-add-btn" className="inline-flex">
            <button data-testid="admin-questions-create-btn" onClick={openCreate}
              className="h-9 px-4 rounded-md bg-emerald-600 hover:bg-emerald-500 text-sm font-medium">
              {t('admin.questions.createButton')}
            </button>
          </span>
          <button onClick={() => { setImportOpen(true); setImportDryResult(null); setImportResult(null) }}
            className="h-9 px-4 rounded-md bg-[#1D2B22]/[0.06] border border-[#1D2B22]/15 hover:bg-[#1D2B22]/10 text-sm">
            {t('admin.questions.importButton')}
          </button>
          <button onClick={refresh}
            className="h-9 px-3 rounded-md bg-[#1D2B22]/[0.06] border border-[#1D2B22]/15 hover:bg-[#1D2B22]/10 text-sm">
            ↻
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="block text-xs text-[#6B5530] mb-1">{t('admin.questions.filter.contentLabel')}</label>
          <input data-testid="admin-questions-search-input" value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('admin.questions.filter.contentPlaceholder')}
            className="h-9 px-3 rounded-md bg-[#1D2B22]/[0.06] border border-[#1D2B22]/15 text-sm w-52" />
        </div>
        <div>
          <label className="block text-xs text-[#6B5530] mb-1">{t('admin.questions.filter.bookLabel')}</label>
          <input data-testid="admin-questions-book-filter" value={book} onChange={e => setBook(e.target.value)} placeholder={t('admin.questions.filter.bookPlaceholder')}
            className="h-9 px-3 rounded-md bg-[#1D2B22]/[0.06] border border-[#1D2B22]/15 text-sm w-32" />
        </div>
        <div>
          <label className="block text-xs text-[#6B5530] mb-1">{t('admin.questions.filter.difficultyLabel')}</label>
          <AdminSelect className="w-36" value={difficulty} onChange={setDifficulty} options={[
            { value: '', label: t('admin.questions.filter.difficultyAll') },
            { value: 'easy', label: t('admin.questions.filter.easy') },
            { value: 'medium', label: t('admin.questions.filter.medium') },
            { value: 'hard', label: t('admin.questions.filter.hard') },
          ]} />
        </div>
        <div>
          <label className="block text-xs text-[#6B5530] mb-1">{t('admin.questions.filter.typeLabel')}</label>
          <AdminSelect className="w-40" value={qType} onChange={setQType} options={[
            { value: '', label: t('admin.questions.filter.typeAll') },
            { value: 'multiple_choice_single', label: t('admin.questions.filter.mcSingle') },
            { value: 'multiple_choice_multi', label: t('admin.questions.filter.mcMulti') },
            { value: 'true_false', label: t('admin.questions.filter.trueFalse') },
            { value: 'fill_in_blank', label: t('admin.questions.filter.fillBlank') },
          ]} />
        </div>
        <div>
          <label className="block text-xs text-[#6B5530] mb-1">{t('admin.questions.filter.statusLabel')}</label>
          <AdminSelect className="w-36" value={reviewStatus} onChange={setReviewStatus} options={[
            { value: '', label: t('admin.questions.filter.statusAll') },
            { value: 'ACTIVE', label: 'Active' },
            { value: 'PENDING', label: 'Pending' },
            { value: 'REJECTED', label: 'Rejected' },
          ]} />
        </div>
        <div>
          <label className="block text-xs text-[#6B5530] mb-1">{t('admin.questions.filter.categoryLabel')}</label>
          <AdminSelect testId="admin-questions-category-filter" className="w-40" value={category} onChange={setCategory} options={[
            { value: '', label: t('admin.questions.filter.categoryAll') },
            { value: 'bible_basics', label: t('admin.questions.filter.categoryBibleBasics') },
          ]} />
        </div>
        <div>
          <label className="block text-xs text-[#6B5530] mb-1">{t('admin.questions.filter.languageLabel')}</label>
          <AdminSelect testId="admin-questions-language-filter" className="w-36" value={language} onChange={setLanguage} options={[
            { value: '', label: t('admin.questions.filter.languageAll') },
            { value: 'vi', label: t('admin.questions.modal.langVi') },
            { value: 'en', label: t('admin.questions.modal.langEn') },
          ]} />
        </div>
        <div>
          <label className="block text-xs text-[#6B5530] mb-1">{t('admin.questions.filter.pageSizeLabel')}</label>
          <AdminSelect className="w-20" value={String(pageSize)} onChange={v => setPageSize(Number(v))} options={[
            { value: '25', label: '25' },
            { value: '50', label: '50' },
            { value: '100', label: '100' },
          ]} />
        </div>
      </div>

      {/* Table */}
      <div data-testid="admin-questions-table" className="rounded-lg border border-[#1D2B22]/15 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[#1D2B22]/[0.04] text-[#4D3A1F]">
              <tr>
                <th className="px-3 py-2 w-10">
                  <input type="checkbox" checked={allChecked} onChange={e => toggleAll(e.target.checked)} />
                </th>
                <th className="px-3 py-2 text-left whitespace-nowrap">{t('admin.questions.column.book')}</th>
                <th className="px-3 py-2 text-center whitespace-nowrap">{t('admin.questions.column.type')}</th>
                <th className="px-3 py-2 text-center whitespace-nowrap">{t('admin.questions.column.difficulty')}</th>
                <th className="px-3 py-2 text-center whitespace-nowrap">{t('admin.questions.column.status')}</th>
                <th className="px-3 py-2 text-left">{t('admin.questions.column.content')}</th>
                <th className="px-3 py-2 text-center whitespace-nowrap">{t('admin.questions.column.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-[#6B5530]">{t('admin.questions.loading')}</td></tr>
              ) : error ? (
                <tr><td colSpan={7} className="px-4 py-4 text-[#B3452F]">{error}</td></tr>
              ) : questions.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-[#6B5530]">{t('admin.questions.empty')}</td></tr>
              ) : questions.map(q => (
                <tr data-testid="admin-question-row" key={q.id} className="odd:bg-[#1D2B22]/[0.04] hover:bg-[#1D2B22]/[0.04]">
                  <td className="px-3 py-2 text-center">
                    <input type="checkbox"
                      checked={!!selectedIds[q.id]}
                      onChange={e => setSelectedIds(p => ({ ...p, [q.id]: e.target.checked }))} />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="font-medium">{q.book ? getBookName(q.book, lang) : '—'}</div>
                    {q.chapter && (
                      <div className="text-xs text-[#6B5530]">
                        {q.chapter}:{q.verseStart ?? '?'}{q.verseEnd && q.verseEnd !== q.verseStart ? `–${q.verseEnd}` : ''}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Badge label={typeLabel(q.type, t)} color="bg-[#1D2B22]/[0.06] text-[#4D3A1F] border-[#1D2B22]/15" />
                  </td>
                  <td className="px-3 py-2 text-center">
                    {q.difficulty
                      ? <Badge label={q.difficulty} color={DIFF_COLOR[q.difficulty]} />
                      : <span className="text-[#6B5530]">—</span>}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {q.reviewStatus
                      ? <Badge label={q.reviewStatus} color={STATUS_COLOR[q.reviewStatus]} />
                      : <span className="text-[#6B5530]">—</span>}
                  </td>
                  <td className="px-3 py-2 max-w-[480px]">
                    {q.category === 'bible_basics' && (
                      <div className="mb-1">
                        <span
                          data-testid="admin-question-bible-basics-badge"
                          className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border bg-amber-600/20 text-[#8A5A12] border-amber-500/30"
                        >
                          {t('admin.questions.filter.categoryBibleBasics')}
                        </span>
                      </div>
                    )}
                    <div className="line-clamp-2 text-[#4D3A1F]">{q.content}</div>
                    {q.options && q.options.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {q.options.map((opt, i) => (
                          <span key={i} className={`text-xs px-1.5 py-0.5 rounded ${(q.correctAnswer ?? []).includes(i) ? 'bg-emerald-600/30 text-[#2E7D4F]' : 'bg-[#1D2B22]/[0.04] text-[#6B5530]'}`}>
                            {String.fromCharCode(65 + i)}. {opt}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center whitespace-nowrap">
                    <button data-testid="admin-question-edit-btn" onClick={() => openEdit(q)}
                      className="mx-0.5 px-2 py-1 rounded bg-[#1D2B22]/[0.06] hover:bg-[#1D2B22]/10 text-xs" title={t('admin.questions.row.editTitle')}>✏️</button>
                    <button onClick={() => duplicate(q)}
                      className="mx-0.5 px-2 py-1 rounded bg-[#1D2B22]/[0.06] hover:bg-[#1D2B22]/10 text-xs" title={t('admin.questions.row.duplicateTitle')}>📄</button>
                    <button data-testid="admin-question-delete-btn" onClick={() => deleteOne(q.id)}
                      className="mx-0.5 px-2 py-1 rounded bg-rose-600/20 text-[#B3452F] hover:bg-rose-600/30 text-xs" title={t('admin.questions.row.deleteTitle')}>🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination & Bulk Actions */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {anyChecked && (
            <button onClick={bulkDelete}
              className="px-3 py-2 rounded-md bg-rose-600/80 hover:bg-rose-600 text-sm">
              {t('admin.questions.bulkDelete', { count: Object.values(selectedIds).filter(Boolean).length })}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[#6B5530]">
            {data ? `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, data.total)} / ${data.total}` : ''}
          </span>
          <button disabled={page <= 0} onClick={() => setPage(p => p - 1)}
            className="px-3 py-1.5 rounded bg-[#1D2B22]/[0.06] hover:bg-[#1D2B22]/10 disabled:opacity-30">{t('admin.questions.paginationPrev')}</button>
          <span className="text-[#4D3A1F]">
            {t('admin.questions.paginationPage', { current: (data?.page ?? 0) + 1, total: data?.totalPages ?? 1 })}
          </span>
          <button disabled={!data || page >= data.totalPages - 1} onClick={() => setPage(p => p + 1)}
            className="px-3 py-1.5 rounded bg-[#1D2B22]/[0.06] hover:bg-[#1D2B22]/10 disabled:opacity-30">{t('admin.questions.paginationNext')}</button>
        </div>
      </div>
    </div>

    {/* Edit/Create now happens on a dedicated page (/admin/questions/:id/edit · /new). */}

    {/* ── Import Modal ─────────────────────────────────────────────────────── */}
    {importOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
        <div className="w-full max-w-lg rounded-xl border border-[#1D2B22]/15 bg-[#EFE3C3] p-6 shadow-2xl mx-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">{t('admin.questions.import.title')}</h3>
            <button onClick={closeImport} className="px-2 py-1 rounded bg-[#1D2B22]/[0.06] hover:bg-[#1D2B22]/10">✕</button>
          </div>

          {!importResult ? (
            <>
              <p className="text-sm text-[#4D3A1F] mb-4" dangerouslySetInnerHTML={{ __html: t('admin.questions.import.formatsLine') + '<br />' + t('admin.questions.import.csvHeaderPrefix') + ' <code class="text-xs bg-[#1D2B22]/[0.06] px-1 rounded">book, chapter, type, text, optionA–D, correctAnswer, difficulty, explanation</code>' }} />
              <div className="mb-4">
                <label className="block text-xs text-[#4D3A1F] mb-1">{t('admin.questions.import.chooseFile')}</label>
                <input type="file" accept=".csv,.json"
                  onChange={e => { setImportFile(e.target.files?.[0] ?? null); setImportDryResult(null) }}
                  className="text-sm text-[#4D3A1F] file:mr-3 file:px-3 file:py-1.5 file:rounded file:bg-[#1D2B22]/[0.06] file:border-0 file:text-sm file:text-[#4D3A1F] file:cursor-pointer" />
              </div>

              {importDryResult && (
                <div className="mb-4 p-3 rounded-lg border border-[#1D2B22]/15 bg-[#1D2B22]/[0.04] text-sm space-y-2">
                  <div className="font-medium text-[#4D3A1F]">{t('admin.questions.import.dryRunTitle')}</div>
                  <div className="flex gap-4">
                    <span className="text-[#2E7D4F]">{t('admin.questions.import.willImport')} <strong>{importDryResult.willImport}</strong></span>
                    {importDryResult.errors && importDryResult.errors.length > 0 && (
                      <span className="text-[#B3452F]">{t('admin.questions.import.errorCount')} <strong>{importDryResult.errors.length}</strong></span>
                    )}
                  </div>
                  {importDryResult.errors && importDryResult.errors.length > 0 && (
                    <div className="mt-2 max-h-28 overflow-y-auto space-y-1">
                      {importDryResult.errors.map((e, i) => (
                        <div key={i} className="text-xs text-[#B3452F]">
                          {e.line ? t('admin.questions.import.linePrefix', { line: e.line }) : e.index ? t('admin.questions.import.indexPrefix', { index: e.index }) : ''}: {e.error}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-2">
                <button onClick={closeImport} className="px-3 py-2 rounded bg-[#1D2B22]/[0.06] text-sm">{t('admin.questions.import.cancelButton')}</button>
                <button disabled={!importFile || importLoading} onClick={() => runImport(true)}
                  className="px-3 py-2 rounded bg-blue-600/80 hover:bg-blue-600 disabled:opacity-50 text-sm">
                  {importLoading ? t('admin.questions.import.processing') : t('admin.questions.import.dryRunButton')}
                </button>
                {importDryResult && (importDryResult.willImport ?? 0) > 0 && (
                  <button disabled={importLoading} onClick={() => runImport(false)}
                    className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-sm font-medium">
                    {importLoading ? t('admin.questions.import.importing') : t('admin.questions.import.importCount', { count: importDryResult.willImport })}
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="text-4xl mb-3">✅</div>
              <div className="text-lg font-semibold text-[#2E7D4F] mb-1">{t('admin.questions.import.successTitle')}</div>
              <div className="text-sm text-[#4D3A1F]">
                <span dangerouslySetInnerHTML={{ __html: t('admin.questions.import.addedCount', { count: importResult.imported }) }} />
                {importResult.errors && importResult.errors.length > 0 && (
                  <span className="text-[#B3452F] ml-2">{t('admin.questions.import.errorsCount', { count: importResult.errors.length })}</span>
                )}
              </div>
              <button onClick={closeImport} className="mt-4 px-4 py-2 rounded bg-[#1D2B22]/[0.06] hover:bg-[#1D2B22]/10 text-sm">{t('admin.questions.import.closeButton')}</button>
            </div>
          )}
        </div>
      </div>
    )}
    </>
  )
}
