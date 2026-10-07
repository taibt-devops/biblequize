import React from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

interface QueueData {
  pendingReview: number
}

export default function QuestionQueue({ data }: { data: QueueData | null }) {
  const { t } = useTranslation()
  const pending = data?.pendingReview ?? 0
  const hasPending = pending > 0

  return (
    <div className="bg-[#FFF8E7] rounded-xl border border-[#1D2B22]/10 p-6 flex flex-col">
      <div className="flex items-center gap-2 mb-5">
        <span className="material-symbols-outlined text-[#8A5A12] text-lg">inbox</span>
        <h3 className="text-[11px] uppercase tracking-[0.2em] text-[#4D3A1F]/60 font-semibold">{t('admin.dashboard.questionQueue.title')}</h3>
      </div>

      {/* Big pending stat */}
      <div className="flex flex-col items-center justify-center py-6">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-3 ${
          hasPending ? 'bg-[#FFC93C]/15 text-[#8A5A12]' : 'bg-emerald-500/10 text-[#2E7D4F]'
        }`}>
          <span className="material-symbols-outlined text-3xl">{hasPending ? 'rate_review' : 'task_alt'}</span>
        </div>
        <span className={`text-4xl font-bold font-mono leading-none ${hasPending ? 'text-[#1D2B22]' : 'text-[#2E7D4F]'}`}>
          {pending.toLocaleString()}
        </span>
        <span className="text-[11px] uppercase tracking-[0.15em] text-[#4D3A1F]/55 font-semibold mt-2">
          {t('admin.dashboard.questionQueue.pendingReview')}
        </span>
      </div>

      <Link to="/admin/review-queue"
        className={`mt-auto block w-full py-2.5 text-center text-xs uppercase tracking-wider font-bold rounded-lg transition-all ${
          hasPending
            ? 'gold-gradient text-[#1D2B22] hover:brightness-110'
            : 'text-[#4D3A1F]/60 border border-[#1D2B22]/15 hover:text-[#8A5A12] hover:border-[#8A5A12]/30'
        }`}>
        {t('admin.dashboard.questionQueue.processNext')}
      </Link>
    </div>
  )
}
