import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api/client'
import { queryKeys } from '../../api/queryKeys'
import { QuestionType } from './questionTypes'

interface ReviewItem {
  id: string
  book: string
  chapter: number
  verseStart: number
  verseEnd: number
  difficulty: 'easy' | 'medium' | 'hard'
  type: string
  content: string
  options: string[]
  correctAnswer: number[]
  explanation: string
  approvalsCount: number
  approvalsRequired: number
  createdAt: string
  reviews: { adminEmail: string; action: 'APPROVE' | 'REJECT'; comment: string; createdAt: string }[]
}

interface Stats {
  pendingForMe: number; totalPending: number; active: number; rejected: number
  myActionsToday: number; approvalsRequired: number
}

interface HistoryItem {
  id: string; questionId: string; action: 'APPROVE' | 'REJECT'
  comment: string; createdAt: string; questionContent?: string; questionBook?: string
}

interface ApproveResult { approvalsCount: number; approvalsRequired: number; activated: boolean }

const DIFF_LABEL_KEY: Record<string, string> = {
  easy: 'admin.reviewQueue.difficulty.easy',
  medium: 'admin.reviewQueue.difficulty.medium',
  hard: 'admin.reviewQueue.difficulty.hard',
}
const DIFF_COLOR: Record<string, string> = {
  easy: 'bg-emerald-500/10 text-[#2E7D4F]',
  medium: 'bg-yellow-500/10 text-[#8A5A12]',
  hard: 'bg-red-500/10 text-[#B3452F]',
}

async function fetchPending(): Promise<ReviewItem[]> {
  const res = await api.get<{ questions?: ReviewItem[] }>('/api/admin/review/pending?size=50')
  return res.data.questions ?? []
}
async function fetchStats(): Promise<Stats> {
  const res = await api.get<Stats>('/api/admin/review/stats')
  return res.data
}
async function fetchHistory(): Promise<HistoryItem[]> {
  const res = await api.get<{ content?: HistoryItem[] }>('/api/admin/review/my-history?size=20')
  return res.data.content ?? []
}

export default function ReviewQueue() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  // refetchOnMount:'always' so opening the tab shows freshly-saved questions
  // (e.g. just sent from the AI generator) without a full page reload.
  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: queryKeys.reviewQueue.pending(),
    queryFn: fetchPending,
    refetchOnMount: 'always',
  })
  const { data: stats } = useQuery({
    queryKey: queryKeys.reviewQueue.stats(),
    queryFn: fetchStats,
    refetchOnMount: 'always',
  })
  const { data: history = [] } = useQuery({
    queryKey: queryKeys.reviewQueue.history(),
    queryFn: fetchHistory,
    refetchOnMount: 'always',
  })

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [rejectComment, setRejectComment] = useState('')
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const invalidateAll = () => queryClient.invalidateQueries({ queryKey: queryKeys.reviewQueue.all })

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post<ApproveResult>(`/api/admin/review/${id}/approve`).then(r => r.data),
    onSuccess: (data) => {
      if (data.activated) {
        showToast(t('admin.reviewQueue.toast.activated'))
      } else {
        showToast(t('admin.reviewQueue.toast.approvedPartial', {
          current: data.approvalsCount,
          total: data.approvalsRequired,
          remaining: data.approvalsRequired - data.approvalsCount,
        }))
      }
      invalidateAll()
    },
    onError: (e: { response?: { data?: { error?: string } } }) => {
      showToast(e.response?.data?.error ?? t('admin.reviewQueue.toast.approveError'), 'error')
    },
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, comment }: { id: string; comment: string }) =>
      api.post(`/api/admin/review/${id}/reject`, { comment }),
    onSuccess: () => {
      showToast(t('admin.reviewQueue.toast.rejected'))
      setRejectingId(null)
      setRejectComment('')
      invalidateAll()
    },
    onError: (e: { response?: { data?: { error?: string } } }) => {
      showToast(e.response?.data?.error ?? t('admin.reviewQueue.toast.rejectError'), 'error')
    },
  })

  const actioningId =
    approveMutation.isPending ? (approveMutation.variables as string | undefined) ?? null
    : rejectMutation.isPending ? rejectMutation.variables?.id ?? null
    : null

  return (
    <div data-testid="review-queue-page" className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-bold ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-500 text-white'
        }`}>{toast.msg}</div>
      )}

      {/* Header */}
      <div>
        <h2 className="text-2xl font-black text-[#1D2B22]">
          {t('admin.reviewQueue.title')}
        </h2>
        <p className="text-[#4D3A1F]/60 text-sm mt-0.5">{t('admin.reviewQueue.subtitle', { count: stats?.approvalsRequired ?? 1 })}</p>
      </div>

      {/* Personalized Stats */}
      {stats && (
        <div data-testid="review-queue-stats" className="grid grid-cols-3 gap-4">
          <div className="bg-[#FFF8E7] rounded-lg p-4 border bg-yellow-500/10 border-yellow-500/20">
            <div data-testid="review-queue-pending-count" className="text-3xl font-black text-[#8A5A12]">{stats.pendingForMe}</div>
            <div className="text-xs text-[#8A5A12]/80 font-bold uppercase tracking-wider mt-1">{t('admin.reviewQueue.stats.pendingForMe')}</div>
          </div>
          <div className="bg-[#FFF8E7] rounded-lg p-4 border bg-blue-500/10 border-blue-500/20">
            <div className="text-3xl font-black text-[#2F6FB0]">{stats.totalPending}</div>
            <div className="text-xs text-[#2F6FB0]/80 font-bold uppercase tracking-wider mt-1">{t('admin.reviewQueue.stats.totalPending')}</div>
            {stats.totalPending > stats.pendingForMe && (
              <div className="text-xs text-[#2F6FB0]/50 mt-1">{t('admin.reviewQueue.stats.processedHint', { count: stats.totalPending - stats.pendingForMe })}</div>
            )}
          </div>
          <div className="bg-[#FFF8E7] rounded-lg p-4 border bg-emerald-500/10 border-emerald-500/20">
            <div className="text-3xl font-black text-[#2E7D4F]">{stats.myActionsToday}</div>
            <div className="text-xs text-[#2E7D4F]/80 font-bold uppercase tracking-wider mt-1">{t('admin.reviewQueue.stats.actionsToday')}</div>
          </div>
        </div>
      )}

      {/* List */}
      {itemsLoading ? (
        <div className="bg-[#FFF8E7] rounded-lg border border-[#1D2B22]/10 p-12 text-center text-[#4D3A1F]/60">{t('admin.reviewQueue.loading')}</div>
      ) : items.length === 0 ? (
        <div className="bg-gradient-to-br from-emerald-500/10 to-blue-500/10 border border-emerald-500/30 rounded-2xl p-12 text-center">
          <span className="text-6xl mb-4 block">🎉</span>
          <h3 className="text-2xl font-bold text-[#1D2B22] mb-2">{t('admin.reviewQueue.emptyTitle')}</h3>
          <p className="text-[#4D3A1F]/60">{t('admin.reviewQueue.emptyLine1')}</p>
          <p className="text-[#4D3A1F]/40 text-sm mt-4">{t('admin.reviewQueue.emptyLine2')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map(q => (
            <div data-testid="review-queue-item" key={q.id} className="bg-[#FFF8E7] rounded-lg p-5 border border-[#1D2B22]/20">
              {/* Header row */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${DIFF_COLOR[q.difficulty] ?? 'bg-[#1D2B22]/[0.04]'}`}>
                  {DIFF_LABEL_KEY[q.difficulty] ? t(DIFF_LABEL_KEY[q.difficulty]) : q.difficulty}
                </span>
                <span className="text-xs text-[#4D3A1F]/60 font-medium">
                  {q.book} {q.chapter}:{q.verseStart}–{q.verseEnd}
                </span>
                {/* Approval progress */}
                <span className="ml-auto flex items-center gap-1.5">
                  {Array.from({ length: q.approvalsRequired }).map((_, i) => (
                    <span key={i} className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                      i < q.approvalsCount
                        ? 'bg-emerald-500 text-white'
                        : 'bg-[#1D2B22]/30 text-[#4D3A1F]/50'
                    }`}>✓</span>
                  ))}
                  <span className="text-xs text-[#4D3A1F]/60 font-medium ml-1">
                    {t('admin.reviewQueue.approvalsCount', { current: q.approvalsCount, total: q.approvalsRequired })}
                  </span>
                </span>
              </div>

              {/* Question content */}
              <p className="font-bold text-[#8A5A12] mb-3 leading-snug">{q.content}</p>

              {/* Options */}
              <div className="grid grid-cols-2 gap-1.5 mb-3">
                {q.options.map((opt, i) => (
                  <div key={i} className={`text-sm px-3 py-1.5 rounded-lg ${
                    (q.correctAnswer ?? []).includes(i)
                      ? 'bg-emerald-500/10 border border-emerald-500/20 text-[#2E7D4F] font-bold'
                      : 'bg-[#1D2B22]/[0.04] text-[#4D3A1F]'
                  }`}>
                    <span className="font-black mr-1">{String.fromCharCode(65 + i)}.</span> {opt}
                  </div>
                ))}
              </div>

              {/* Explanation toggle */}
              <button onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}
                className="text-xs text-[#2E7D4F] font-bold mb-3">
                {expandedId === q.id ? t('admin.reviewQueue.hideExplanation') : t('admin.reviewQueue.showExplanation')}
              </button>
              {expandedId === q.id && q.explanation && (
                <p className="text-xs text-[#4D3A1F] italic bg-[#1D2B22]/[0.04] px-3 py-2 rounded-lg mb-3">{q.explanation}</p>
              )}

              {/* Reviewer badges */}
              {q.reviews.length > 0 && (
                <div className="flex gap-2 flex-wrap mb-3">
                  {q.reviews.map((r, i) => (
                    <span key={i} className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                      r.action === 'APPROVE'
                        ? 'bg-emerald-500/10 text-[#2E7D4F]'
                        : 'bg-red-500/10 text-[#B3452F]'
                    }`}>
                      {r.action === 'APPROVE' ? '✓' : '✗'} {r.adminEmail}
                    </span>
                  ))}
                </div>
              )}

              {/* Reject comment input */}
              {rejectingId === q.id && (
                <div className="mb-3">
                  <textarea
                    data-testid="review-reject-comment"
                    rows={2}
                    value={rejectComment}
                    onChange={e => setRejectComment(e.target.value)}
                    placeholder={t('admin.reviewQueue.rejectPlaceholder')}
                    className="w-full bg-[#F9ECC8] border-none rounded text-sm text-[#1D2B22] p-3 focus:ring-1 focus:ring-[#8A5A12] resize-none mb-2"
                  />
                  <div className="flex gap-2">
                    <button data-testid="review-reject-confirm-btn" onClick={() => rejectMutation.mutate({ id: q.id, comment: rejectComment })} disabled={actioningId === q.id}
                      className="px-4 py-1.5 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 disabled:opacity-50">
                      {t('admin.reviewQueue.rejectConfirmButton')}
                    </button>
                    <button onClick={() => { setRejectingId(null); setRejectComment('') }}
                      className="px-4 py-1.5 bg-[#F0DFB8] text-[#4D3A1F] text-xs font-bold rounded-lg">
                      {t('admin.reviewQueue.rejectCancelButton')}
                    </button>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              {rejectingId !== q.id && (
                <div className="flex gap-2">
                  <span data-testid="review-queue-approve-btn" className="inline-flex">
                    <button data-testid="review-approve-btn" onClick={() => approveMutation.mutate(q.id)} disabled={actioningId === q.id}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50">
                      {actioningId === q.id ? t('admin.reviewQueue.approving') : t('admin.reviewQueue.approveButton')}
                    </button>
                  </span>
                  <button data-testid="review-reject-btn" onClick={() => setRejectingId(q.id)} disabled={actioningId === q.id}
                    className="px-5 py-2 bg-red-500/10 hover:bg-red-500/20 text-[#B3452F] text-sm font-bold rounded-xl transition-colors disabled:opacity-50">
                    {t('admin.reviewQueue.rejectButton')}
                  </button>
                  <button data-testid="review-edit-btn"
                    onClick={() => navigate(`/admin/questions/${q.id}/edit?from=review`, { state: { question: { ...q, type: q.type as QuestionType, reviewStatus: 'PENDING' } } })}
                    disabled={actioningId === q.id}
                    className="ml-auto px-5 py-2 bg-[#1D2B22]/[0.04] hover:bg-[#1D2B22]/[0.06] text-[#4D3A1F] text-sm font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base">edit</span>
                    {t('admin.reviewQueue.editButton')}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* My Review History */}
      <div className="mt-12">
        <button onClick={() => setShowHistory(!showHistory)} className="text-lg font-semibold text-[#1D2B22] flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-secondary">history</span>
          {t('admin.reviewQueue.historyTitle')}
          <span className="text-xs text-[#4D3A1F]/50 ml-2">({history.length})</span>
        </button>
        {showHistory && (
          <div className="space-y-2">
            {history.length === 0 ? (
              <p className="text-[#4D3A1F]/40 text-center py-8">{t('admin.reviewQueue.historyEmpty')}</p>
            ) : history.map(item => (
              <div key={item.id} className="bg-[#FFF8E7] rounded-lg p-4 flex items-center justify-between border border-[#1D2B22]/10">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#1D2B22]/80 truncate">{item.questionContent ?? item.questionId}</p>
                  <p className="text-xs text-[#4D3A1F]/50 mt-1">{item.questionBook} · {new Date(item.createdAt).toLocaleString()}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ml-3 ${
                  item.action === 'APPROVE' ? 'bg-emerald-500/20 text-[#2E7D4F]' : 'bg-red-500/20 text-[#B3452F]'
                }`}>
                  {item.action === 'APPROVE' ? t('admin.reviewQueue.historyApproved') : t('admin.reviewQueue.historyRejected')}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
