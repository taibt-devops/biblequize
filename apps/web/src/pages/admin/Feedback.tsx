import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../../api/client'
import AdminSelect from '../../components/ui/AdminSelect'

type FeedbackItem = {
  id: string
  type: string
  status: string
  content: string
  createdAt: string
  updatedAt: string
  userId?: string
  userName?: string
  userEmail?: string
  question?: { id: string; content: string; book: string }
  handledBy?: string
}

type Stats = Record<string, number>

export default function FeedbackAdmin() {
  const { t } = useTranslation()
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [stats, setStats] = useState<Stats>({})
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [selected, setSelected] = useState<FeedbackItem | null>(null)
  const [note, setNote] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const fetchData = async (p = page) => {
    setIsLoading(true)
    try {
      const params: Record<string, any> = { page: p, size: 20 }
      if (statusFilter) params.status = statusFilter
      if (typeFilter) params.type = typeFilter
      const res = await api.get('/api/admin/feedback', { params })
      setItems(res.data.items ?? [])
      setTotal(res.data.total ?? 0)
      setTotalPages(res.data.totalPages ?? 1)
      setStats(res.data.stats ?? {})
    } catch (e) {
      console.error('Failed to load feedback', e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    setPage(0)
    fetchData(0)
  }, [statusFilter, typeFilter])

  const updateStatus = async (status: string) => {
    if (!selected) return
    setIsSaving(true)
    try {
      const body: Record<string, string> = { status }
      if (note.trim()) body.note = note.trim()
      const res = await api.patch(`/api/admin/feedback/${selected.id}`, body)
      setSelected(res.data)
      setNote('')
      await fetchData()
    } finally {
      setIsSaving(false)
    }
  }

  const statusBadge = (status: string) => {
    const base = 'inline-block px-2 py-0.5 rounded text-xs font-medium'
    switch (status) {
      case 'pending':     return <span className={`${base} bg-yellow-500/20 text-[#8A5A12] border border-yellow-500/30`}>{t('admin.feedback.filter.pending')}</span>
      case 'in_progress': return <span className={`${base} bg-blue-500/20 text-[#2F6FB0] border border-blue-500/30`}>{t('admin.feedback.filter.inProgress')}</span>
      case 'resolved':    return <span className={`${base} bg-emerald-500/20 text-[#2E7D4F] border border-emerald-500/30`}>{t('admin.feedback.filter.resolved')}</span>
      case 'rejected':    return <span className={`${base} bg-rose-500/20 text-[#B3452F] border border-rose-500/30`}>{t('admin.feedback.filter.rejected')}</span>
      default: return <span className={`${base} bg-[#1D2B22]/[0.06] text-[#4D3A1F]/60`}>{status}</span>
    }
  }

  const typeBadge = (type: string) => {
    const base = 'inline-block px-2 py-0.5 rounded text-xs font-medium'
    switch (type) {
      case 'report':   return <span className={`${base} bg-rose-500/20 text-[#B3452F]`}>{t('admin.feedback.filter.report')}</span>
      case 'question': return <span className={`${base} bg-purple-500/20 text-[#6B3FA0]`}>{t('admin.feedback.filter.question')}</span>
      case 'general':  return <span className={`${base} bg-sky-500/20 text-[#2F6FB0]`}>{t('admin.feedback.filter.general')}</span>
      default: return <span className={`${base} bg-[#1D2B22]/[0.06] text-[#4D3A1F]/60`}>{type}</span>
    }
  }

  const statCards = [
    { key: 'pending',     color: 'yellow' },
    { key: 'in_progress', color: 'blue'   },
    { key: 'resolved',    color: 'emerald' },
    { key: 'rejected',    color: 'rose'   },
  ] as const

  const colorMap = {
    yellow:  'border-yellow-500/40 bg-yellow-500/15 text-yellow-200',
    blue:    'border-blue-500/40 bg-blue-500/15 text-blue-200',
    emerald: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200',
    rose:    'border-rose-500/40 bg-rose-500/15 text-rose-200',
  }

  return (
    <>
      <div data-testid="admin-feedback-page" className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">{t('admin.feedback.title')}</h2>
            <p className="text-[#4D3A1F]/60 text-sm mt-0.5">{t('admin.feedback.subtitle', { count: total })}</p>
          </div>
        </div>

        {/* Stats cards */}
        <div data-testid="feedback-stats-cards" className="grid grid-cols-4 gap-3">
          {statCards.map(({ key, color }) => (
            <button
              key={key}
              data-testid={`feedback-stat-${key}`}
              onClick={() => setStatusFilter(statusFilter === key ? '' : key)}
              className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                statusFilter === key ? colorMap[color] : 'border-[#4D3A1F]/10 bg-[#FFF8E7] hover:bg-[#1D2B22]/[0.06]'
              }`}
            >
              <div className="text-2xl font-bold">{stats[key] ?? 0}</div>
              <div className="text-xs text-[#4D3A1F]/60 mt-0.5">{t(`admin.feedback.stats.${key}`)}</div>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <AdminSelect testId="feedback-status-filter" className="w-44" value={statusFilter} onChange={setStatusFilter} options={[
            { value: '', label: t('admin.feedback.filter.allStatus') },
            { value: 'pending', label: t('admin.feedback.filter.pending') },
            { value: 'in_progress', label: t('admin.feedback.filter.inProgress') },
            { value: 'resolved', label: t('admin.feedback.filter.resolved') },
            { value: 'rejected', label: t('admin.feedback.filter.rejected') },
          ]} />
          <AdminSelect className="w-40" value={typeFilter} onChange={setTypeFilter} options={[
            { value: '', label: t('admin.feedback.filter.allTypes') },
            { value: 'report', label: t('admin.feedback.filter.report') },
            { value: 'question', label: t('admin.feedback.filter.question') },
            { value: 'general', label: t('admin.feedback.filter.general') },
          ]} />
          <button
            onClick={() => fetchData()}
            className="px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-sm"
          >
            {t('admin.feedback.filter.refresh')}
          </button>
        </div>

        {/* Table */}
        <div data-testid="feedback-table" className="rounded-lg border border-[#4D3A1F]/10 overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-[#FFF8E7] text-[#4D3A1F]/70">
              <tr>
                <th className="px-3 py-2 text-left">{t('admin.feedback.columnUser')}</th>
                <th className="px-3 py-2 text-left">{t('admin.feedback.columnType')}</th>
                <th className="px-3 py-2 text-left">{t('admin.feedback.columnContent')}</th>
                <th className="px-3 py-2 text-left">{t('admin.feedback.columnQuestion')}</th>
                <th className="px-3 py-2 text-center">{t('admin.feedback.columnStatus')}</th>
                <th className="px-3 py-2 text-left">{t('admin.feedback.columnDate')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="px-3 py-6 text-[#6B5530] text-center">{t('admin.feedback.loading')}</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-6 text-[#6B5530] text-center">{t('admin.feedback.empty')}</td></tr>
              ) : items.map(item => (
                <tr
                  data-testid="feedback-row"
                  key={item.id}
                  className="odd:bg-[#1D2B22]/[0.04] hover:bg-[#1D2B22]/[0.04] cursor-pointer"
                  onClick={() => { setSelected(item); setNote('') }}
                >
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="font-medium">{item.userName || '—'}</div>
                    <div className="text-xs text-[#4D3A1F]/40">{item.userEmail || ''}</div>
                  </td>
                  <td className="px-3 py-2">{typeBadge(item.type)}</td>
                  <td className="px-3 py-2 max-w-xs">
                    <div className="truncate text-[#4D3A1F]" title={item.content}>{item.content}</div>
                  </td>
                  <td className="px-3 py-2 text-xs text-[#6B5530] max-w-[200px]">
                    {item.question
                      ? <span title={item.question.content}>[{item.question.book}] {item.question.content?.slice(0, 45)}…</span>
                      : '—'
                    }
                  </td>
                  <td className="px-3 py-2 text-center">{statusBadge(item.status)}</td>
                  <td className="px-3 py-2 text-xs text-[#6B5530] whitespace-nowrap">
                    {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-end gap-2">
          <span className="text-sm text-[#6B5530]">{t('admin.feedback.paginationSummary', { page: page + 1, totalPages })}</span>
          <button
            disabled={page <= 0}
            onClick={() => { const p = page - 1; setPage(p); fetchData(p) }}
            className="px-2 py-1 rounded bg-[#1D2B22]/[0.06] disabled:opacity-40 text-sm"
          >{t('admin.feedback.paginationPrev')}</button>
          <button
            disabled={page >= totalPages - 1}
            onClick={() => { const p = page + 1; setPage(p); fetchData(p) }}
            className="px-2 py-1 rounded bg-[#1D2B22]/[0.06] disabled:opacity-40 text-sm"
          >{t('admin.feedback.paginationNext')}</button>
        </div>
      </div>

      {/* Detail Modal */}
      {selected && (
        <div data-testid="feedback-detail-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-xl rounded-xl border border-[#4D3A1F]/10 bg-[#EFE3C3] p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="text-lg font-semibold">{t('admin.feedback.detailTitle')}</div>
              <button onClick={() => setSelected(null)} className="px-2 py-1 rounded bg-[#1D2B22]/[0.06] hover:bg-[#1D2B22]/10">✕</button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                {typeBadge(selected.type)}
                {statusBadge(selected.status)}
                {selected.handledBy && (
                  <span className="text-xs text-[#4D3A1F]/40">{t('admin.feedback.handledBy', { name: selected.handledBy })}</span>
                )}
              </div>

              <div>
                <div className="text-xs text-[#4D3A1F]/40 mb-1">{t('admin.feedback.sender')}</div>
                <div className="font-medium">{selected.userName}
                  <span className="text-[#6B5530] font-normal ml-2 text-xs">({selected.userEmail})</span>
                </div>
              </div>

              {selected.question && (
                <div>
                  <div className="text-xs text-[#4D3A1F]/40 mb-1">{t('admin.feedback.relatedQuestion')}</div>
                  <div className="px-3 py-2 rounded bg-[#FFF8E7] border border-[#4D3A1F]/10 text-xs text-[#4D3A1F]">
                    [{selected.question.book}] {selected.question.content}
                  </div>
                </div>
              )}

              <div>
                <div className="text-xs text-[#4D3A1F]/40 mb-1">{t('admin.feedback.contentLabel')}</div>
                <div className="px-3 py-2 rounded bg-[#FFF8E7] border border-[#4D3A1F]/10 whitespace-pre-wrap text-[#4D3A1F] max-h-40 overflow-y-auto">
                  {selected.content}
                </div>
              </div>

              <div>
                <div className="text-xs text-[#4D3A1F]/40 mb-1">{t('admin.feedback.adminNoteLabel')}</div>
                <textarea
                  rows={2}
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder={t('admin.feedback.adminNotePlaceholder')}
                  className="w-full px-3 py-2 rounded bg-[#1D2B22]/[0.06] border border-[#4D3A1F]/10 text-sm resize-none"
                />
              </div>
            </div>

            <div data-testid="feedback-status-select" className="flex items-center justify-end gap-2 mt-5 flex-wrap">
              <button onClick={() => setSelected(null)} className="px-3 py-2 rounded bg-[#1D2B22]/[0.06] hover:bg-[#1D2B22]/10 text-sm">
                {t('admin.feedback.closeButton')}
              </button>
              <button
                disabled={isSaving}
                onClick={() => updateStatus('in_progress')}
                className="px-3 py-2 rounded bg-blue-600/80 hover:bg-blue-600 disabled:opacity-50 text-sm"
              >
                {t('admin.feedback.moveInProgress')}
              </button>
              <button
                disabled={isSaving}
                onClick={() => updateStatus('rejected')}
                className="px-3 py-2 rounded bg-rose-600/80 hover:bg-rose-600 disabled:opacity-50 text-sm"
              >
                {t('admin.feedback.rejectButton')}
              </button>
              <button
                data-testid="feedback-update-btn"
                disabled={isSaving}
                onClick={() => updateStatus('resolved')}
                className="px-3 py-2 rounded bg-emerald-600/80 hover:bg-emerald-600 disabled:opacity-50 text-sm"
              >
                {t('admin.feedback.resolveButton')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
