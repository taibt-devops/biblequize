import { useTranslation } from 'react-i18next'
import { ACTION_BG, ACTION_FG, ACTION_SHADOW, COLOR, DIFFICULTY_COLORS, INSET_BG } from './styles'
import type { EditorQuestion } from '../../../api/quizSets'
import { validateQuestion, issueLabel, MIN_QUESTIONS_TO_PUBLISH } from './validation'

interface Props {
  open: boolean
  questions: EditorQuestion[]
  nameValid: boolean
  onClose: () => void
  onConfirm: () => void
  onGotoQuestion: (id: string) => void
  busy?: boolean
}

export default function PublishConfirmModal({
  open, questions, nameValid, onClose, onConfirm, onGotoQuestion, busy,
}: Props) {
  const { t } = useTranslation()
  if (!open) return null

  const invalid = questions.map((q, i) => ({ q, idx: i, issues: validateQuestion(q) }))
    .filter(x => x.issues.length > 0)
  const blockers: string[] = []
  if (!nameValid) blockers.push(t('quizSet.editor.publishConfirm.blockerNameShort'))
  if (questions.length < MIN_QUESTIONS_TO_PUBLISH) {
    blockers.push(t('quizSet.editor.publishConfirm.blockerNeedQuestions', { min: MIN_QUESTIONS_TO_PUBLISH, have: questions.length }))
  }

  const blocked = blockers.length > 0 || invalid.length > 0
  const counts = { easy: 0, medium: 0, hard: 0 } as Record<string, number>
  for (const q of questions) {
    const d = (q.difficulty || 'medium').toLowerCase()
    if (d in counts) counts[d]++
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(29,43,34,0.45)', zIndex: 60,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: COLOR.bgPanel, border: `1px solid ${COLOR.borderSubtle}`,
        borderRadius: 12, maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${COLOR.borderXSubtle}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: blocked ? COLOR.warning : COLOR.gold }} aria-hidden>{blocked ? 'warning' : 'rocket_launch'}</span>
          <div style={{ fontSize: 15, fontWeight: 500, color: COLOR.textPrimary }}>
            {blocked
              ? t('quizSet.editor.publishConfirm.blockedTitle', { count: blockers.length + invalid.length })
              : t('quizSet.editor.publishConfirm.confirmTitle')}
          </div>
        </div>

        <div style={{ padding: '18px 22px' }}>
          {blocked ? (
            <>
              {blockers.length > 0 && (
                <ul style={{ margin: 0, paddingLeft: 18, marginBottom: 14 }}>
                  {blockers.map((b, i) => (
                    <li key={i} style={{ color: COLOR.warning, fontSize: 13, marginBottom: 4 }}>{b}</li>
                  ))}
                </ul>
              )}
              {invalid.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                  {invalid.map(({ q, idx, issues }) => (
                    <button
                      key={q.id}
                      onClick={() => { onGotoQuestion(q.id); onClose() }}
                      style={{
                        background: 'rgba(245,158,11,0.08)',
                        border: `1px solid rgba(245,158,11,0.30)`,
                        borderRadius: 7, padding: '8px 12px', textAlign: 'left', cursor: 'pointer',
                        color: COLOR.textSecondary, fontSize: 12, display: 'flex',
                        alignItems: 'center', justifyContent: 'space-between', gap: 8,
                      }}>
                      <div>
                        <span style={{ color: COLOR.warning, fontWeight: 500 }}>{t('quizSet.editor.publishConfirm.questionPrefix', { idx: idx + 1 })}</span>{' '}
                        {issues.map(iss => issueLabel(t, iss)).join(' · ')}
                      </div>
                      <span style={{ color: COLOR.gold, fontSize: 11 }}>{t('quizSet.editor.publishConfirm.gotoQuestion')}</span>
                    </button>
                  ))}
                </div>
              )}
              <button onClick={onClose} style={{
                width: '100%', background: ACTION_BG, color: ACTION_FG, boxShadow: ACTION_SHADOW,
                border: 'none', padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>{t('quizSet.editor.publishConfirm.backToFix')}</button>
            </>
          ) : (
            <>
              <div style={{
                background: INSET_BG, border: `1px solid ${COLOR.borderSubtle}`,
                borderRadius: 8, padding: 14, marginBottom: 16,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: COLOR.textPrimary, marginBottom: 8 }}>
                  <span>{t('quizSet.editor.publishConfirm.totalQuestions')}</span>
                  <span style={{ fontWeight: 500 }}>{questions.length}</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['easy', 'medium', 'hard'] as const).map(d => {
                    const col = DIFFICULTY_COLORS[d]
                    const lbl = d === 'easy'
                      ? t('quizSet.editor.publishConfirm.diffEasy')
                      : d === 'medium'
                        ? t('quizSet.editor.publishConfirm.diffMedium')
                        : t('quizSet.editor.publishConfirm.diffHard')
                    return (
                      <div key={d} style={{
                        flex: 1, background: col.chip, color: col.accent,
                        padding: 6, textAlign: 'center', borderRadius: 6, fontSize: 11, fontWeight: 500,
                      }}>{counts[d]} {lbl}</div>
                    )
                  })}
                </div>
              </div>

              <p style={{ fontSize: 13, color: COLOR.textSecondary, marginBottom: 16, lineHeight: 1.5 }}>
                {t('quizSet.editor.publishConfirm.explainPublish')}
              </p>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={onClose} style={{
                  background: INSET_BG, color: COLOR.textSecondary,
                  border: `1px solid ${COLOR.borderSubtle}`,
                  padding: '9px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                }}>{t('quizSet.editor.publishConfirm.cancel')}</button>
                <button onClick={onConfirm} disabled={busy} style={{
                  background: ACTION_BG, color: ACTION_FG, border: 'none', boxShadow: ACTION_SHADOW,
                  padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1,
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }} aria-hidden>rocket_launch</span>
                  {busy ? t('quizSet.editor.publishConfirm.publishing') : t('quizSet.editor.publishConfirm.publish')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
