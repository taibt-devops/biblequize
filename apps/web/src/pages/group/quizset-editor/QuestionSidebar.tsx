import { useTranslation } from 'react-i18next'
import type { EditorQuestion } from '../../../api/quizSets'
import { ACTION_BG, ACTION_FG, ACTION_SHADOW, COLOR, DIFFICULTY_COLORS, INSET_BG } from './styles'
import { isQuestionValid, validateQuestion } from './validation'

interface Props {
  questions: EditorQuestion[]
  activeId: string | null
  onActivate: (id: string) => void
  onAddManual: () => void
  addBusy?: boolean
}

function difficultyKey(d: string | null | undefined): keyof typeof DIFFICULTY_COLORS {
  const v = (d || 'medium').toLowerCase()
  return (v === 'easy' || v === 'hard') ? v : 'medium'
}

export default function QuestionSidebar({
  questions, activeId, onActivate, onAddManual, addBusy,
}: Props) {
  const { t } = useTranslation()
  const counts = { easy: 0, medium: 0, hard: 0 }
  for (const q of questions) {
    const k = difficultyKey(q.difficulty)
    counts[k]++
  }

  return (
    <div style={{
      background: INSET_BG,
      borderRight: `1px solid ${COLOR.borderXSubtle}`,
      padding: '16px 12px',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '0 4px' }}>
        <span style={{ fontSize: 11, fontWeight: 500, color: COLOR.textMuted, letterSpacing: 0.6 }}>{t('quizSet.editor.sidebar.header')}</span>
        <span style={{ fontSize: 11, color: COLOR.textDisabled }}>{t('quizSet.editor.sidebar.questionCount', { count: questions.length })}</span>
      </div>

      {/* Distribution bar */}
      <div style={{
        display: 'flex', gap: 4, padding: 2, background: COLOR.inputBg,
        borderRadius: 6, fontSize: 10, marginBottom: 12,
      }}>
        {(['easy', 'medium', 'hard'] as const).map(d => {
          const col = DIFFICULTY_COLORS[d]
          const label = d === 'easy'
            ? t('quizSet.editor.sidebar.diffEasyShort')
            : d === 'medium'
              ? t('quizSet.editor.sidebar.diffMediumShort')
              : t('quizSet.editor.sidebar.diffHardShort')
          return (
            <div key={d} style={{
              flex: 1, textAlign: 'center', padding: 4,
              background: col.chip, color: col.accent,
              borderRadius: 4, fontWeight: 500,
            }}>{counts[d]} {label}</div>
          )
        })}
      </div>

      {/* Action buttons — pinned above the list so "Thêm thủ công" stays
          visible even when the list is empty / very long. */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 6,
        paddingBottom: 12, marginBottom: 8,
        borderBottom: `1px solid ${COLOR.borderXSubtle}`,
      }}>
        <button onClick={onAddManual} disabled={addBusy} style={{
          background: ACTION_BG, color: ACTION_FG,
          border: 'none', boxShadow: ACTION_SHADOW,
          padding: '9px 11px', borderRadius: 7, fontSize: 12, fontWeight: 600,
          cursor: addBusy ? 'wait' : 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          opacity: addBusy ? 0.6 : 1,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }} aria-hidden>add</span>
          {t('quizSet.editor.sidebar.btnAddManual')}
        </button>
      </div>

      {/* Scrollable question list */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 4,
        overflowY: 'auto', flex: 1, minHeight: 0,
      }}>
        {questions.length === 0 && (
          <div style={{
            padding: '24px 12px', textAlign: 'center', color: COLOR.textDisabled,
            fontSize: 12, fontStyle: 'italic',
          }}>
            {t('quizSet.editor.sidebar.emptyHint')}
          </div>
        )}
        {questions.map((q, idx) => {
          const dk = difficultyKey(q.difficulty)
          const col = DIFFICULTY_COLORS[dk]
          const isActive = q.id === activeId
          const issues = validateQuestion(q)
          const valid = issues.length === 0
          const isAI = (q.source || '').startsWith('ai')

          return (
            <div
              key={q.id}
              onClick={() => onActivate(q.id)}
              style={{
                background: isActive ? COLOR.goldBg : COLOR.bgPanel,
                // Split `border` shorthand to avoid React warning about
                // shorthand-then-longhand `borderLeft` conflict.
                borderTop:    `1px solid ${isActive ? COLOR.goldBorder : COLOR.borderXSubtle}`,
                borderRight:  `1px solid ${isActive ? COLOR.goldBorder : COLOR.borderXSubtle}`,
                borderBottom: `1px solid ${isActive ? COLOR.goldBorder : COLOR.borderXSubtle}`,
                borderLeft:   `3px solid ${valid ? col.border : COLOR.danger}`,
                borderRadius: 6,
                padding: '9px 11px',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                <span style={{ fontSize: 11, color: isActive ? COLOR.gold : COLOR.textDisabled, fontWeight: 500 }}>#{idx + 1}</span>
                <span className="material-symbols-outlined"
                   style={{ fontSize: 13, color: valid ? COLOR.success : COLOR.warning }} aria-hidden>{valid ? 'check_circle' : 'warning'}</span>
                <span className="material-symbols-outlined"
                   style={{ fontSize: 11, color: COLOR.textDisabled }} aria-hidden>{isAI ? 'auto_awesome' : 'edit'}</span>
                {isActive && (
                  <span style={{ marginLeft: 'auto', fontSize: 9, color: COLOR.gold, fontWeight: 500, letterSpacing: 0.5 }}>
                    {t('quizSet.editor.sidebar.badgeEditing')}
                  </span>
                )}
                {!isActive && !valid && (
                  <span style={{ marginLeft: 'auto', fontSize: 9, color: COLOR.warning, fontWeight: 500, letterSpacing: 0.5 }}>
                    {t('quizSet.editor.sidebar.badgeMissing')}
                  </span>
                )}
              </div>
              <div style={{
                fontSize: 12, color: isActive ? COLOR.textPrimary : COLOR.textSecondary,
                lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {q.content || <em style={{ color: COLOR.textDisabled }}>{t('quizSet.editor.sidebar.emptyContent')}</em>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
