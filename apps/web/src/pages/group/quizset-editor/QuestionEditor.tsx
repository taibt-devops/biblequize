import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { EditorQuestion } from '../../../api/quizSets'
import { ANSWER_OPTION_COLORS, COLOR, DARK_INPUT_STYLE, DARK_TEXTAREA_STYLE, DIFFICULTY_COLORS } from './styles'
import { validateQuestion } from './validation'

type Difficulty = 'easy' | 'medium' | 'hard'

interface Props {
  index: number
  question: EditorQuestion
  onChange: (patch: Partial<EditorQuestion>) => void
  onDelete: () => void
  /** Omit to hide the "AI viết lại" button (personal scope in Phase 1). */
  onAIRewrite?: () => void
  onDuplicate?: () => void
  rewriting?: boolean
}

function scriptureRefString(q: EditorQuestion): string {
  if (!q.book) return ''
  const ch = q.chapter ?? ''
  const vs = q.verseStart
  const ve = q.verseEnd
  if (vs && ve && ve !== vs) return `${q.book} ${ch}:${vs}-${ve}`
  if (vs) return `${q.book} ${ch}:${vs}`
  return `${q.book} ${ch}`
}

const SCRIPTURE_RE = /^[A-Za-zÀ-ỹĐđ0-9\s]+\s\d+(:\d+(-\d+)?)?$/

export default function QuestionEditor({
  index, question, onChange, onDelete, onAIRewrite, onDuplicate, rewriting,
}: Props) {
  const { t } = useTranslation()
  const issues = useMemo(() => validateQuestion(question), [question])
  const issueByKind = new Map(issues.map(i => [i.kind === 'option_empty' ? `option_empty_${i.index}` : i.kind, i] as const))

  // Scripture ref edited as one freeform string but stored as book + chapter + verseStart + verseEnd
  const [scriptureInput, setScriptureInput] = useState(scriptureRefString(question))
  useEffect(() => { setScriptureInput(scriptureRefString(question)) }, [question.id])

  const dk: Difficulty = (['easy', 'medium', 'hard'] as const).includes(question.difficulty as any)
    ? question.difficulty as Difficulty : 'medium'
  const correctIndex = question.correctAnswer?.[0] ?? -1

  // AEU-5: distractor error-type metadata (transient, only on freshly AI-generated Qs).
  const metaByIndex = new Map((question.distractors ?? []).map(d => [d.index, d] as const))
  const quality = question.quality

  const onScriptureBlur = () => {
    const txt = scriptureInput.trim()
    // Parse "Book 1:2-3" / "Book 1:2" / "Book 1"
    const m = txt.match(/^(.+?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/)
    if (!m) return // invalid, leave UI to show warning
    const [, book, ch, vs, ve] = m
    onChange({
      book: book.trim(),
      chapter: Number(ch),
      verseStart: vs ? Number(vs) : null,
      verseEnd: ve ? Number(ve) : (vs ? Number(vs) : null),
    })
  }

  const scriptureValid = SCRIPTURE_RE.test(scriptureInput.trim()) || scriptureInput.trim() === ''

  const setOption = (i: number, val: string) => {
    const opts = [...(question.options || ['', '', '', ''])]
    while (opts.length < 4) opts.push('')
    opts[i] = val
    onChange({ options: opts })
  }

  return (
    <div className="qse-editor-pane" style={{ padding: '20px 24px', background: COLOR.bgSection, overflowY: 'auto', minWidth: 0 }}>

      {/* Header: number + difficulty + actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: COLOR.textDisabled }}>{t('quizSet.editor.question.labelQuestion')}</span>
        <span style={{ fontSize: 18, fontWeight: 500, color: COLOR.textPrimary }}>#{index + 1}</span>

        <div style={{ display: 'flex', gap: 4, padding: 2, background: COLOR.inputBg, borderRadius: 6 }}>
          {(['easy', 'medium', 'hard'] as const).map(d => {
            const active = dk === d
            const col = DIFFICULTY_COLORS[d]
            const label = d === 'easy'
              ? t('quizSet.editor.question.diffEasy')
              : d === 'medium'
                ? t('quizSet.editor.question.diffMedium')
                : t('quizSet.editor.question.diffHard')
            return (
              <button
                key={d}
                onClick={() => onChange({ difficulty: d })}
                style={{
                  background: active ? col.chip : 'transparent',
                  color: active ? col.accent : COLOR.textMuted,
                  border: 'none', padding: '4px 12px', borderRadius: 4,
                  fontSize: 11, fontWeight: active ? 500 : 400, cursor: 'pointer',
                }}
              >{label}</button>
            )
          })}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          {onAIRewrite && (
            <button onClick={onAIRewrite} disabled={rewriting} style={{
              background: COLOR.goldBg, color: COLOR.gold,
              border: `1px solid rgba(245,158,11,0.30)`,
              padding: '5px 10px', borderRadius: 6, fontSize: 11,
              cursor: rewriting ? 'wait' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 4,
              opacity: rewriting ? 0.6 : 1,
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 12 }} aria-hidden>refresh</span>
              {rewriting ? t('quizSet.editor.question.aiRewriting') : t('quizSet.editor.question.aiRewrite')}
            </button>
          )}
          {onDuplicate && (
            <button onClick={onDuplicate} title={t('quizSet.editor.question.duplicateTooltip')} style={{
              background: 'transparent', color: COLOR.textDisabled,
              border: `1px solid ${COLOR.borderSubtle}`,
              padding: '5px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 13 }} aria-hidden>content_copy</span>
            </button>
          )}
          <button onClick={onDelete} title={t('quizSet.editor.question.deleteTooltip')} style={{
            background: 'transparent', color: COLOR.danger,
            border: `1px solid rgba(179,69,47,0.30)`,
            padding: '5px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 13 }} aria-hidden>delete</span>
          </button>
        </div>
      </div>

      {/* Question textarea */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: COLOR.textMuted, letterSpacing: 0.6, marginBottom: 6 }}>
          {t('quizSet.editor.question.fieldQuestion')} <span style={{ color: COLOR.danger }}>*</span>
        </label>
        <textarea
          rows={2}
          value={question.content || ''}
          onChange={e => {
            onChange({ content: e.target.value })
            e.target.style.height = 'auto'
            e.target.style.height = Math.max(e.target.scrollHeight, 60) + 'px'
          }}
          ref={el => {
            if (el) { el.style.height = 'auto'; el.style.height = Math.max(el.scrollHeight, 60) + 'px' }
          }}
          placeholder={t('quizSet.editor.question.questionPlaceholder')}
          style={{
            ...DARK_TEXTAREA_STYLE,
            borderColor: issueByKind.has('short_content') ? COLOR.warning : COLOR.goldFocus,
            padding: '11px 13px',
            fontSize: 14,
            wordBreak: 'break-word',
          }}
        />
        {issueByKind.has('short_content') && (
          <div style={{ fontSize: 10, color: COLOR.warning, marginTop: 4 }}>{t('quizSet.editor.question.shortContentHint')}</div>
        )}
      </div>

      {/* Options A/B/C/D */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: COLOR.textMuted, letterSpacing: 0.6, marginBottom: 8 }}>
          {t('quizSet.editor.question.fieldOptions')} <span style={{ color: COLOR.textDisabled, fontWeight: 400, letterSpacing: 0 }}>· {t('quizSet.editor.question.optionHelp')}</span>
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {ANSWER_OPTION_COLORS.map((meta, i) => {
            const isCorrect = correctIndex === i
            const empty = issueByKind.has(`option_empty_${i}`)
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 9,
                background: isCorrect ? 'rgba(46,125,79,0.08)' : COLOR.inputBg,
                border: `1px solid ${isCorrect ? 'rgba(46,125,79,0.30)' : empty ? COLOR.warning : COLOR.borderXSubtle}`,
                borderRadius: 8, padding: '9px 12px',
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: meta.bg, color: meta.text, border: `1px solid ${meta.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 500, flexShrink: 0,
                }}>{meta.letter}</div>
                <button
                  type="button"
                  onClick={() => onChange({ correctAnswer: [i] })}
                  title={isCorrect ? t('quizSet.editor.question.correctAnswer') : t('quizSet.editor.question.pickCorrect')}
                  style={{
                    width: 16, height: 16,
                    background: isCorrect ? COLOR.success : 'transparent',
                    border: isCorrect ? 'none' : `1.5px solid ${COLOR.borderSubtle}`,
                    borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                  }}
                >
                  {isCorrect && <span className="material-symbols-outlined" style={{ fontSize: 10, color: '#FFFFFF' }} aria-hidden>check</span>}
                </button>
                <textarea
                  rows={1}
                  value={question.options?.[i] ?? ''}
                  onChange={e => {
                    setOption(i, e.target.value)
                    e.target.style.height = 'auto'
                    e.target.style.height = e.target.scrollHeight + 'px'
                  }}
                  ref={el => {
                    if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' }
                  }}
                  placeholder={t('quizSet.editor.question.optionPlaceholder', { letter: meta.letter })}
                  style={{
                    flex: 1, background: 'transparent', border: 'none',
                    color: isCorrect ? COLOR.textPrimary : COLOR.textSecondary,
                    fontSize: 13, fontFamily: 'inherit', padding: '4px 0',
                    fontWeight: isCorrect ? 500 : 400, outline: 'none', minWidth: 0,
                    resize: 'none', lineHeight: 1.5, overflow: 'hidden',
                    wordBreak: 'break-word',
                  }}
                />
                {!isCorrect && metaByIndex.get(i) && (
                  <span style={{
                    flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '2px 7px', borderRadius: 5, fontSize: 10, fontWeight: 500,
                    background: COLOR.inputBg, border: `1px solid ${COLOR.borderSubtle}`, color: COLOR.textMuted,
                  }}>
                    {t(`admin.aiGenerator.draftCard.errorType.${metaByIndex.get(i)!.errorType}`)}
                    {metaByIndex.get(i)!.almostRight && (
                      <span style={{ color: COLOR.gold }}>★ {t('admin.aiGenerator.draftCard.almostRightTag')}</span>
                    )}
                  </span>
                )}
              </div>
            )
          })}
        </div>
        {issueByKind.has('no_correct') && (
          <div style={{ fontSize: 10, color: COLOR.warning, marginTop: 6 }}>{t('quizSet.editor.question.noCorrectHint')}</div>
        )}
        {quality && !quality.valid && (
          <div role="alert" style={{
            marginTop: 8, padding: '8px 11px', borderRadius: 8,
            background: COLOR.goldBg, border: `1px solid rgba(245,158,11,0.30)`,
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: COLOR.gold, marginBottom: 3 }}>
              ⚠ {t('admin.aiGenerator.draftCard.qualityWarningTitle')}
            </div>
            <ul style={{ margin: 0, paddingLeft: 16, fontSize: 10.5, color: COLOR.textMuted, lineHeight: 1.6 }}>
              {quality.reasons.map(r => (
                <li key={r}>{t(`admin.aiGenerator.draftCard.reason.${r}`)}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Bottom: Explanation + Scripture (2-column grid, stacks on mobile) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)', gap: 12 }} className="qse-grid">
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: COLOR.textMuted, letterSpacing: 0.6, marginBottom: 6 }}>
            {t('quizSet.editor.question.fieldExplanation')} <span style={{ color: COLOR.danger }}>*</span>
          </label>
          <textarea
            rows={3}
            value={question.explanation || ''}
            onChange={e => {
              onChange({ explanation: e.target.value })
              e.target.style.height = 'auto'
              e.target.style.height = Math.max(e.target.scrollHeight, 80) + 'px'
            }}
            ref={el => {
              if (el) { el.style.height = 'auto'; el.style.height = Math.max(el.scrollHeight, 80) + 'px' }
            }}
            placeholder={t('quizSet.editor.question.explainPlaceholder')}
            style={{
              ...DARK_TEXTAREA_STYLE,
              borderColor: issueByKind.has('short_explanation') ? COLOR.warning : COLOR.borderSubtle,
              padding: '10px 12px',
              fontSize: 12,
              wordBreak: 'break-word',
            }}
          />
          {issueByKind.has('short_explanation') && (
            <div style={{ fontSize: 10, color: COLOR.warning, marginTop: 4 }}>
              {t('quizSet.editor.question.shortExplanationHint', { current: (question.explanation || '').trim().length })}
            </div>
          )}
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 500, color: COLOR.textMuted, letterSpacing: 0.6, marginBottom: 6 }}>
            {t('quizSet.editor.question.fieldScripture')} <span style={{ color: COLOR.danger }}>*</span>
          </label>
          <input
            type="text"
            value={scriptureInput}
            onChange={e => setScriptureInput(e.target.value)}
            onBlur={onScriptureBlur}
            placeholder={t('quizSet.editor.question.scripturePlaceholder')}
            style={{
              ...DARK_INPUT_STYLE,
              borderColor: scriptureValid ? COLOR.goldFocus : COLOR.danger,
              color: COLOR.gold,
              fontFamily: 'monospace',
              padding: '10px 12px',
              fontSize: 13,
            }}
          />
          {!scriptureValid && (
            <div style={{ fontSize: 10, color: COLOR.danger, marginTop: 4 }}>
              {t('quizSet.editor.question.scriptureBadFormat')}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 767px) {
          .qse-grid { grid-template-columns: 1fr !important; }
          .qse-editor-pane { padding: 14px 12px !important; }
        }
      `}</style>
    </div>
  )
}
