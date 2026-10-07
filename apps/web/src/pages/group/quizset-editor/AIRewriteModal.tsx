import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { EditorQuestion } from '../../../api/quizSets'
import { ACTION_BG, ACTION_BG_DISABLED, ACTION_FG, ACTION_SHADOW, COLOR, INSET_BG } from './styles'

interface Draft {
  content?: string
  options?: string[]
  correctAnswer?: number[] | number
  explanation?: string
}

interface Props {
  open: boolean
  current: EditorQuestion
  remaining: number
  limit: number
  onClose: () => void
  onGenerate: (hint: string) => Promise<Draft | null>
  onAccept: (draft: Draft) => void
}

export default function AIRewriteModal({ open, current, remaining, limit, onClose, onGenerate, onAccept }: Props) {
  const { t } = useTranslation()
  const [hint, setHint] = useState('')
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const handleGenerate = async () => {
    if (remaining < 1) { setError(t('quizSet.editor.aiRewrite.quotaExhausted')); return }
    setBusy(true); setError(null)
    try {
      const d = await onGenerate(hint.trim())
      if (d && d.content) setDraft(d)
      else setError(t('quizSet.editor.aiRewrite.noValidResponse'))
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || t('quizSet.editor.aiRewrite.errorGeneric'))
    } finally { setBusy(false) }
  }

  const correctIdx = draft?.correctAnswer != null
    ? (Array.isArray(draft.correctAnswer) ? draft.correctAnswer[0] : draft.correctAnswer)
    : null

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(29,43,34,0.45)', zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: COLOR.bgPanel, border: `1px solid ${COLOR.borderSubtle}`,
        borderRadius: 12, maxWidth: 720, width: '100%', maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${COLOR.borderXSubtle}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: COLOR.gold }} aria-hidden>refresh</span>
          <div style={{ flex: 1, fontSize: 15, fontWeight: 500, color: COLOR.textPrimary }}>{t('quizSet.editor.aiRewrite.title')}</div>
          <span style={{ fontSize: 11, color: COLOR.textMuted }}>{t('quizSet.editor.aiRewrite.quota', { remaining, limit })}</span>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', color: COLOR.textMuted, cursor: 'pointer', padding: 4,
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden>close</span>
          </button>
        </div>

        <div style={{ padding: '18px 22px' }}>
          <label style={{ display: 'block', fontSize: 11, color: COLOR.textMuted, marginBottom: 6, letterSpacing: 0.6, fontWeight: 500 }}>
            {t('quizSet.editor.aiRewrite.hintLabel')}
          </label>
          <input
            type="text" value={hint} onChange={e => setHint(e.target.value)}
            placeholder={t('quizSet.editor.aiRewrite.hintPlaceholder')}
            style={{
              width: '100%', background: COLOR.inputBg, border: `1px solid ${COLOR.borderSubtle}`,
              color: COLOR.textPrimary, padding: '9px 12px', borderRadius: 7,
              fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 12, outline: 'none',
            }}
          />
          <button onClick={handleGenerate} disabled={busy || remaining < 1} style={{
            background: busy || remaining < 1 ? ACTION_BG_DISABLED : ACTION_BG, color: ACTION_FG,
            border: 'none', boxShadow: busy || remaining < 1 ? 'none' : ACTION_SHADOW,
            padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            cursor: busy || remaining < 1 ? 'not-allowed' : 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16,
            opacity: busy || remaining < 1 ? 0.6 : 1,
          }}>
            <span className="material-symbols-outlined" style={{
              fontSize: 14, animation: busy ? 'spin 1s linear infinite' : undefined,
            }} aria-hidden>{busy ? 'progress_activity' : 'refresh'}</span>
            {busy ? t('quizSet.editor.aiRewrite.generating') : draft ? t('quizSet.editor.aiRewrite.generateAnother') : t('quizSet.editor.aiRewrite.generateFirst')}
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </button>

          {error && (
            <div style={{
              background: 'rgba(179,69,47,0.10)', border: `1px solid rgba(179,69,47,0.30)`,
              color: COLOR.danger, padding: '8px 12px', borderRadius: 7, fontSize: 12, marginBottom: 12,
            }}>{error}</div>
          )}

          {draft && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div style={panelStyle()}>
                <div style={headerLabelStyle()}>{t('quizSet.editor.aiRewrite.currentVersion')}</div>
                <div style={{ fontSize: 13, color: COLOR.textSecondary, marginBottom: 10 }}>{current.content}</div>
                {(current.options || []).map((o, i) => (
                  <div key={i} style={optionRow(i, current.correctAnswer?.[0] === i)}>{'ABCD'[i]}. {o || <em>—</em>}</div>
                ))}
                {current.explanation && (
                  <div style={{ marginTop: 8, fontSize: 11, color: COLOR.textMuted, fontStyle: 'italic' }}>
                    {current.explanation}
                  </div>
                )}
              </div>
              <div style={{ ...panelStyle(), borderColor: COLOR.goldBorder }}>
                <div style={{ ...headerLabelStyle(), color: COLOR.gold }}>{t('quizSet.editor.aiRewrite.newVersion')}</div>
                <div style={{ fontSize: 13, color: COLOR.textPrimary, marginBottom: 10 }}>{draft.content}</div>
                {(draft.options || []).map((o, i) => (
                  <div key={i} style={optionRow(i, correctIdx === i)}>{'ABCD'[i]}. {o}</div>
                ))}
                {draft.explanation && (
                  <div style={{ marginTop: 8, fontSize: 11, color: COLOR.textMuted, fontStyle: 'italic' }}>
                    {draft.explanation}
                  </div>
                )}
              </div>
            </div>
          )}

          {draft && (
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={onClose} style={{
                background: INSET_BG, color: COLOR.textSecondary,
                border: `1px solid ${COLOR.borderSubtle}`,
                padding: '9px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
              }}>{t('quizSet.editor.aiRewrite.keepOld')}</button>
              <button onClick={() => { onAccept(draft); onClose() }} style={{
                background: ACTION_BG, color: ACTION_FG, boxShadow: ACTION_SHADOW,
                border: 'none', padding: '9px 18px', borderRadius: 8,
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>{t('quizSet.editor.aiRewrite.acceptNew')}</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function panelStyle(): React.CSSProperties {
  return {
    background: INSET_BG, border: `1px solid ${COLOR.borderSubtle}`,
    borderRadius: 8, padding: 14,
  }
}
function headerLabelStyle(): React.CSSProperties {
  return { fontSize: 10, color: COLOR.textMuted, letterSpacing: 0.6, fontWeight: 500, marginBottom: 8, textTransform: 'uppercase' }
}
function optionRow(_i: number, isCorrect: boolean): React.CSSProperties {
  return {
    fontSize: 12, padding: '3px 0',
    color: isCorrect ? COLOR.success : COLOR.textSecondary,
    fontWeight: isCorrect ? 500 : 400,
  }
}
