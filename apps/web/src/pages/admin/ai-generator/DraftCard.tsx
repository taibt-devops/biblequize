import React from 'react'
import { useTranslation } from 'react-i18next'
import { DraftQuestion, DraftStatus, CLAUDE_MODELS } from './types'

interface DraftCardProps {
  draft: DraftQuestion
  isEditing: boolean
  isSaving: boolean
  editData: Partial<DraftQuestion>
  onEdit: () => void
  onChange: (field: string, val: any) => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onApprove: () => void
  onReject: () => void
  onRestore: () => void
  onRemove: () => void
}

const OPT_LABELS = ['A', 'B', 'C', 'D', 'E']
const DIFF_STYLE: Record<string, string> = { easy: 'bg-emerald-500/10 text-[#2E7D4F]', medium: 'bg-yellow-500/10 text-[#8A5A12]', hard: 'bg-red-500/10 text-[#B3452F]' }
const DIFF_LABEL_KEY: Record<string, string> = {
  easy: 'admin.aiGenerator.draftCard.difficultyEasy',
  medium: 'admin.aiGenerator.draftCard.difficultyMedium',
  hard: 'admin.aiGenerator.draftCard.difficultyHard',
}
const STATUS_STYLE: Record<DraftStatus, string> = { pending: 'bg-yellow-500/10 text-[#8A5A12]', approved: 'bg-emerald-500/10 text-[#2E7D4F]', rejected: 'bg-[#1D2B22]/[0.04] text-[#4D3A1F]/40' }
const STATUS_LABEL_KEY: Record<DraftStatus, string> = {
  pending: 'admin.aiGenerator.draftCard.statusPending',
  approved: 'admin.aiGenerator.draftCard.statusApproved',
  rejected: 'admin.aiGenerator.draftCard.statusRejected',
}

export default function DraftCard({ draft, isEditing, isSaving, editData, onEdit, onChange, onSaveEdit, onCancelEdit, onApprove, onReject, onRestore, onRemove }: DraftCardProps) {
  const { t } = useTranslation()
  const cur = isEditing ? { ...draft, ...editData } as DraftQuestion : draft
  const opts = Array.isArray(cur.options) ? cur.options : []
  const isCorrect = (i: number) => Array.isArray(cur.correctAnswer) ? cur.correctAnswer.includes(i) : cur.correctAnswer === i
  // AEQ: distractor error-type metadata + quality gate.
  const metaByIndex = new Map((cur.distractors ?? []).map(d => [d.index, d]))
  const approveBlocked = draft.quality?.valid === false

  return (
    <div data-testid="ai-draft-card" data-status={draft.status} className={`bg-[#FFF8E7] rounded-lg p-5 border-2 transition-all duration-200 ${
      draft.status === 'approved' ? 'border-emerald-500/30 opacity-80' :
      draft.status === 'rejected' ? 'border-transparent opacity-50' :
      isEditing ? 'border-[#8A5A12]/50 shadow-lg' : 'border-[#1D2B22]/10 hover:border-[#1D2B22]/30'
    }`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_STYLE[draft.status]}`}>{t(STATUS_LABEL_KEY[draft.status])}</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${DIFF_STYLE[cur.difficulty] || 'bg-[#1D2B22]/[0.04] text-[#4D3A1F]/60'}`}>{DIFF_LABEL_KEY[cur.difficulty] ? t(DIFF_LABEL_KEY[cur.difficulty]) : cur.difficulty}</span>
        <span className="text-xs text-[#4D3A1F]/60 font-medium">
          {cur.book} {cur.chapter}{(cur.verseStart || cur.verseEnd) ? `:${cur.verseStart || '?'}–${cur.verseEnd || '?'}` : ''}
        </span>
        {draft.generatedBy && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#FFC93C]/10 text-[#8A5A12] border border-[#8A5A12]/20">
            {CLAUDE_MODELS.find(m => m.id === draft.generatedBy)?.label ?? draft.generatedBy}
          </span>
        )}
        {draft.status !== 'approved' && (
          <button onClick={onRemove} className="ml-auto text-[#4D3A1F]/40 hover:text-[#B3452F] transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* View mode */}
      {!isEditing && (
        <div className="space-y-3">
          <p className="text-[#1D2B22] font-semibold text-sm leading-snug">{cur.content}</p>
          {opts.length > 0 && (
            <div className="space-y-1.5">
              {opts.map((opt, i) => (
                <div key={i} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm border ${
                  isCorrect(i) ? 'bg-emerald-500/10 border-emerald-500/40 text-[#2E7D4F] font-semibold' : 'bg-[#EFE3C3] border-[#1D2B22]/20 text-[#4D3A1F]'
                }`}>
                  <span className={`w-5 h-5 rounded-full text-xs font-black flex items-center justify-center flex-shrink-0 ${
                    isCorrect(i) ? 'bg-[#FFC93C] text-[#1D2B22]' : 'bg-[#F0DFB8] text-[#4D3A1F]'
                  }`}>{OPT_LABELS[i]}</span>
                  <span className="flex-1">{opt}</span>
                  {!isCorrect(i) && metaByIndex.get(i) && (
                    <span className="flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#1D2B22]/[0.04] border border-[#1D2B22]/15 text-[#4D3A1F]/70">
                      {t(`admin.aiGenerator.draftCard.errorType.${metaByIndex.get(i)!.errorType}`)}
                      {metaByIndex.get(i)!.almostRight && (
                        <span className="text-[#8A5A12]">★ {t('admin.aiGenerator.draftCard.almostRightTag')}</span>
                      )}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          {cur.quality && !cur.quality.valid && (
            <div className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs">
              <p className="font-bold text-[#8A5A12] mb-1">⚠ {t('admin.aiGenerator.draftCard.qualityWarningTitle')}</p>
              <ul className="list-disc list-inside text-amber-200/80 space-y-0.5">
                {cur.quality.reasons.map(r => (
                  <li key={r}>{t(`admin.aiGenerator.draftCard.reason.${r}`)}</li>
                ))}
              </ul>
            </div>
          )}
          {cur.explanation && (
            <div className="px-3 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-200/90 leading-relaxed">
              <span className="font-bold text-[#8A5A12]">{t('admin.aiGenerator.draftCard.explanationPrefix')}</span>{cur.explanation}
            </div>
          )}
        </div>
      )}

      {/* Edit mode */}
      {isEditing && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-[#4D3A1F] uppercase tracking-wider mb-1.5">{t('admin.aiGenerator.draftCard.questionLabel')}</label>
            <textarea rows={2} value={cur.content} onChange={e => onChange('content', e.target.value)} className="form-input resize-none text-sm w-full" />
          </div>
          {opts.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-[#4D3A1F] uppercase tracking-wider mb-1.5">{t('admin.aiGenerator.draftCard.optionsLabel')}</label>
              {opts.map((opt, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <span className={`w-6 h-6 rounded-full text-xs font-black flex items-center justify-center flex-shrink-0 ${
                    isCorrect(i) ? 'bg-[#FFC93C] text-[#1D2B22]' : 'bg-[#F0DFB8] text-[#4D3A1F]'
                  }`}>{OPT_LABELS[i]}</span>
                  <input type="text" value={opt} onChange={e => { const n = [...opts]; n[i] = e.target.value; onChange('options', n) }} className="form-input text-sm py-2 flex-1" />
                  <button onClick={() => onChange('correctAnswer', i)} className={`w-8 h-8 rounded-lg text-sm font-black transition-all flex-shrink-0 ${
                    isCorrect(i) ? 'bg-[#FFC93C] text-[#1D2B22]' : 'bg-[#F0DFB8] text-[#4D3A1F]/60 hover:bg-[#F0DFB8]'
                  }`}>✓</button>
                </div>
              ))}
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-[#4D3A1F] uppercase tracking-wider mb-1.5">{t('admin.aiGenerator.draftCard.explanationLabel')}</label>
            <textarea rows={2} value={cur.explanation || ''} onChange={e => onChange('explanation', e.target.value)} className="form-input resize-none text-sm w-full" />
          </div>
          <div className="flex gap-2">
            <button onClick={onSaveEdit} className="flex-1 bg-[#FFC93C] text-[#1D2B22] text-sm font-bold py-2.5 rounded-xl hover:brightness-110 transition-colors">{t('admin.aiGenerator.draftCard.saveEditButton')}</button>
            <button onClick={onCancelEdit} className="px-5 text-sm font-bold text-[#4D3A1F] bg-[#F0DFB8] py-2.5 rounded-xl hover:bg-[#F0DFB8] transition-colors">{t('admin.aiGenerator.draftCard.cancelEditButton')}</button>
          </div>
        </div>
      )}

      {/* Save error */}
      {draft.saveError && (
        <div className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30">
          <p className="text-[#B3452F] text-xs font-semibold leading-snug">{draft.saveError}</p>
        </div>
      )}

      {/* Actions */}
      {draft.status === 'pending' && !isEditing && (
        <div className="flex gap-2 mt-4 pt-4 border-t border-[#1D2B22]/20">
          <button data-testid="ai-draft-approve-btn" onClick={onApprove} disabled={isSaving || approveBlocked}
            title={approveBlocked ? t('admin.aiGenerator.draftCard.approveBlocked') : undefined}
            className="flex-1 bg-[#FFC93C] text-[#1D2B22] text-sm font-bold py-2.5 rounded-xl hover:brightness-110 transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
            {isSaving ? t('admin.aiGenerator.draftCard.approveSaving') : t('admin.aiGenerator.draftCard.approveButton')}
          </button>
          <button onClick={onEdit} className="px-4 text-sm font-bold text-[#4D3A1F] bg-[#F0DFB8] py-2.5 rounded-xl hover:bg-[#F0DFB8] transition-colors">{t('admin.aiGenerator.draftCard.editButton')}</button>
          <button data-testid="ai-draft-reject-btn" onClick={onReject} className="w-10 flex items-center justify-center text-[#4D3A1F]/60 bg-[#F0DFB8] rounded-xl hover:bg-red-500/10 hover:text-[#B3452F] transition-colors" title={t('admin.aiGenerator.draftCard.rejectTitle')}>✕</button>
        </div>
      )}

      {draft.status === 'rejected' && (
        <div className="mt-3 pt-3 border-t border-[#1D2B22]/20">
          <button onClick={onRestore} className="text-xs text-[#4D3A1F]/60 hover:text-[#8A5A12] transition-colors font-semibold">{t('admin.aiGenerator.draftCard.restoreButton')}</button>
        </div>
      )}

      {draft.status === 'approved' && (
        <div className="mt-3 pt-3 border-t border-emerald-500/20 flex items-center gap-1.5 text-xs text-[#2E7D4F] font-semibold">
          {t('admin.aiGenerator.draftCard.approvedFooter')}
          {draft.approvedId && <span className="text-[#2E7D4F] font-normal ml-1">#{draft.approvedId.slice(0, 8)}</span>}
        </div>
      )}
    </div>
  )
}
