import React from 'react'
import { useTranslation } from 'react-i18next'
import { Question, QuestionType, Difficulty, ReviewStatus } from './questionTypes'
import AdminSelect from '../../components/ui/AdminSelect'

interface Props {
  draft: Partial<Question>
  setField: <K extends keyof Question>(key: K, val: Question[K]) => void
  setOption: (i: number, val: string) => void
  toggleCorrect: (i: number) => void
  handleTypeChange: (type: QuestionType) => void
}

/**
 * Presentational question form fields (QPG-3). The "evaluate / AI suggest" panel
 * lives next to this in QuestionEditPage, not inside it.
 */
export default function QuestionFields({ draft, setField, setOption, toggleCorrect, handleTypeChange }: Props) {
  const { t } = useTranslation()
  return (
    <div className="space-y-4">
      {/* Row 1: Scripture ref */}
      <div className="grid grid-cols-4 gap-3">
        <div className="col-span-2">
          <label className="block text-xs text-[#6B5530] mb-1">{t('admin.questions.modal.bookLabel')}</label>
          <input className="w-full h-9 px-3 rounded bg-[#1D2B22]/[0.06] border border-[#1D2B22]/15 text-sm"
            value={draft.book ?? ''} onChange={e => setField('book', e.target.value)} placeholder={t('admin.questions.modal.bookPlaceholder')} />
        </div>
        <div>
          <label className="block text-xs text-[#6B5530] mb-1">{t('admin.questions.modal.chapterLabel')}</label>
          <input type="number" className="w-full h-9 px-3 rounded bg-[#1D2B22]/[0.06] border border-[#1D2B22]/15 text-sm"
            value={draft.chapter ?? ''} onChange={e => setField('chapter', e.target.value ? Number(e.target.value) : undefined)} />
        </div>
        <div>
          <label className="block text-xs text-[#6B5530] mb-1">{t('admin.questions.modal.verseStartLabel')}</label>
          <input type="number" className="w-full h-9 px-3 rounded bg-[#1D2B22]/[0.06] border border-[#1D2B22]/15 text-sm"
            value={draft.verseStart ?? ''} onChange={e => setField('verseStart', e.target.value ? Number(e.target.value) : undefined)} />
        </div>
      </div>

      {/* Row 2: Meta */}
      <div className="grid grid-cols-4 gap-3">
        <div>
          <label className="block text-xs text-[#6B5530] mb-1">{t('admin.questions.modal.verseEndLabel')}</label>
          <input type="number" className="w-full h-9 px-3 rounded bg-[#1D2B22]/[0.06] border border-[#1D2B22]/15 text-sm"
            value={draft.verseEnd ?? ''} onChange={e => setField('verseEnd', e.target.value ? Number(e.target.value) : undefined)} />
        </div>
        <div>
          <label className="block text-xs text-[#6B5530] mb-1">{t('admin.questions.modal.difficultyLabel')}</label>
          <AdminSelect value={draft.difficulty ?? 'easy'} onChange={v => setField('difficulty', v as Difficulty)} options={[
            { value: 'easy', label: t('admin.questions.filter.easy') },
            { value: 'medium', label: t('admin.questions.filter.medium') },
            { value: 'hard', label: t('admin.questions.filter.hard') },
          ]} />
        </div>
        <div>
          <label className="block text-xs text-[#6B5530] mb-1">{t('admin.questions.modal.typeLabel')}</label>
          <AdminSelect value={draft.type ?? 'multiple_choice_single'} onChange={v => handleTypeChange(v as QuestionType)} options={[
            { value: 'multiple_choice_single', label: t('admin.questions.modal.mcSingleFull') },
            { value: 'multiple_choice_multi', label: t('admin.questions.modal.mcMultiFull') },
            { value: 'true_false', label: t('admin.questions.modal.trueFalseFull') },
            { value: 'fill_in_blank', label: t('admin.questions.modal.fillBlank') },
          ]} />
        </div>
        <div>
          <label className="block text-xs text-[#6B5530] mb-1">{t('admin.questions.modal.languageLabel')}</label>
          <AdminSelect value={draft.language ?? 'vi'} onChange={v => setField('language', v)} options={[
            { value: 'vi', label: t('admin.questions.modal.langVi') },
            { value: 'en', label: t('admin.questions.modal.langEn') },
          ]} />
        </div>
      </div>

      {/* Content */}
      <div>
        <label className="block text-xs text-[#6B5530] mb-1">
          {t('admin.questions.modal.contentLabel')}
          {draft.type === 'fill_in_blank' && <span className="ml-2 text-[#8A5A12]">{t('admin.questions.modal.fillBlankHint')}</span>}
        </label>
        <textarea data-testid="admin-question-content-input" rows={3} className="w-full px-3 py-2 rounded bg-[#1D2B22]/[0.06] border border-[#1D2B22]/15 text-sm resize-none"
          value={draft.content ?? ''} onChange={e => setField('content', e.target.value)} />
      </div>

      {/* Options + Correct Answer */}
      {draft.type !== 'fill_in_blank' && (
        <div>
          <label className="block text-xs text-[#6B5530] mb-2">
            {t('admin.questions.modal.optionsLabel')}
            {draft.type === 'multiple_choice_multi' && <span className="ml-2 text-[#2F6FB0]">{t('admin.questions.modal.multiHint')}</span>}
          </label>
          <div className="space-y-2">
            {(draft.options ?? []).map((opt, i) => {
              const isCorrect = (draft.correctAnswer ?? []).includes(i)
              const isMulti   = draft.type === 'multiple_choice_multi'
              const isTF      = draft.type === 'true_false'
              return (
                <div key={i} className={`flex items-start gap-2 p-2 rounded-lg border ${isCorrect ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-[#1D2B22]/15 bg-[#1D2B22]/[0.04]'}`}>
                  <span className="text-xs font-bold text-[#6B5530] w-5 mt-2">{String.fromCharCode(65 + i)}</span>
                  <textarea
                    className="flex-1 min-h-[2rem] px-2 py-1.5 rounded bg-[#1D2B22]/[0.06] border border-[#1D2B22]/15 text-sm resize-none leading-snug break-words"
                    rows={Math.min(4, Math.max(1, Math.ceil((opt?.length || 0) / 46)))}
                    value={opt}
                    readOnly={isTF}
                    onChange={e => !isTF && setOption(i, e.target.value)}
                  />
                  <button type="button"
                    onClick={() => toggleCorrect(i)}
                    className={`flex-shrink-0 w-8 h-8 mt-0.5 rounded flex items-center justify-center text-sm font-bold transition-colors ${isCorrect ? 'bg-emerald-500 text-white' : 'bg-[#1D2B22]/[0.06] text-[#6B5530] hover:bg-[#1D2B22]/10'}`}
                    title={isMulti ? t('admin.questions.modal.toggleCorrectTitle') : t('admin.questions.modal.pickCorrectTitle')}>
                    {isMulti ? (isCorrect ? '✓' : '○') : (isCorrect ? '●' : '○')}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Fill-in-blank answer */}
      {draft.type === 'fill_in_blank' && (
        <div>
          <label className="block text-xs text-[#6B5530] mb-1">{t('admin.questions.modal.fillAnswerLabel')}</label>
          <input className="w-full h-9 px-3 rounded bg-[#1D2B22]/[0.06] border border-[#1D2B22]/15 text-sm"
            value={draft.correctAnswerText ?? ''}
            onChange={e => setField('correctAnswerText', e.target.value)}
            placeholder={t('admin.questions.modal.fillAnswerPlaceholder')} />
        </div>
      )}

      {/* Explanation */}
      <div>
        <label className="block text-xs text-[#6B5530] mb-1">{t('admin.questions.modal.explanationLabel')}</label>
        <textarea rows={6} className="w-full px-3 py-2 rounded bg-[#1D2B22]/[0.06] border border-[#1D2B22]/15 text-sm resize-y min-h-[8rem] leading-relaxed"
          value={draft.explanation ?? ''} onChange={e => setField('explanation', e.target.value)}
          placeholder={t('admin.questions.modal.explanationPlaceholder')} />
      </div>

      {/* Review Status */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-[#6B5530] mb-1">{t('admin.questions.modal.reviewStatusLabel')}</label>
          <AdminSelect value={draft.reviewStatus ?? 'ACTIVE'} onChange={v => setField('reviewStatus', v as ReviewStatus)} options={[
            { value: 'ACTIVE', label: t('admin.questions.modal.statusActive') },
            { value: 'PENDING', label: t('admin.questions.modal.statusPending') },
            { value: 'REJECTED', label: t('admin.questions.modal.statusRejected') },
          ]} />
        </div>
      </div>
    </div>
  )
}
