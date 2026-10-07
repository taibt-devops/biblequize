import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { localizeBibleBook } from '../../../data/bibleData'
import { ACTION_BG, ACTION_BG_DISABLED, ACTION_FG, ACTION_SHADOW, COLOR, DIFFICULTY_COLORS, INSET_BG } from './styles'

interface Scope {
  book: string
  chapterFrom: number
  chapterTo: number
}

export interface AIGenerateRequest {
  countEasy: number
  countMedium: number
  countHard: number
  chapterFrom: number
  chapterTo: number
  verseFrom: number | null
  verseTo: number | null
  topic?: string
}

interface Props {
  open: boolean
  scope: Scope
  remaining: number
  limit: number
  topic?: string
  onClose: () => void
  onGenerate: (req: AIGenerateRequest) => Promise<void>
  busy?: boolean
  error?: string | null
}

export default function AIGeneratePanel({
  open, scope, remaining, limit, topic: defaultTopic, onClose, onGenerate, busy, error,
}: Props) {
  const { t, i18n } = useTranslation()
  const lang: 'vi' | 'en' = i18n.language?.startsWith('en') ? 'en' : 'vi'
  const [easy, setEasy] = useState(2)
  const [medium, setMedium] = useState(2)
  const [hard, setHard] = useState(1)
  const [topic, setTopic] = useState(defaultTopic || '')

  const [chFrom, setChFrom] = useState(scope.chapterFrom)
  const [chTo, setChTo] = useState(scope.chapterTo)
  const [vFromStr, setVFromStr] = useState('')
  const [vToStr, setVToStr] = useState('')

  // Reseed scope when opened with a different metadata scope
  useEffect(() => {
    if (open) {
      setChFrom(scope.chapterFrom)
      setChTo(Math.max(scope.chapterFrom, scope.chapterTo))
    }
  }, [open, scope.chapterFrom, scope.chapterTo])

  if (!open) return null

  const total = easy + medium + hard
  const overQuota = total > remaining
  const tooLarge = total > 15
  const disabled = total <= 0 || overQuota || tooLarge || busy
  const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0

  const Stepper = ({
    value, setValue, label, color,
  }: { value: number; setValue: (n: number) => void; label: string; color: (typeof DIFFICULTY_COLORS)[keyof typeof DIFFICULTY_COLORS] }) => (
    <div style={{
      background: color.bg, border: `1px solid ${color.border}`,
      borderRadius: 8, padding: '10px 8px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center', marginBottom: 8 }}>
        <span style={{ display: 'inline-block', width: 7, height: 7, background: color.accent, borderRadius: '50%' }} />
        <span style={{ fontSize: 11, fontWeight: 500, color: color.accent, letterSpacing: 0.5 }}>{label}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr 24px', gap: 4, alignItems: 'center' }}>
        <button onClick={() => setValue(Math.max(0, value - 1))} style={{
          background: INSET_BG, color: COLOR.textSecondary, border: 'none',
          width: 24, height: 24, borderRadius: 5, cursor: 'pointer', fontSize: 14, lineHeight: 1,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>−</button>
        <div style={{ fontSize: 18, fontWeight: 500, color: COLOR.textPrimary, textAlign: 'center' }}>{value}</div>
        <button onClick={() => setValue(Math.min(15, value + 1))} style={{
          background: color.chip,
          color: color.accent, border: 'none',
          width: 24, height: 24, borderRadius: 5, cursor: 'pointer', fontSize: 14, lineHeight: 1,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>+</button>
      </div>
    </div>
  )

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(29,43,34,0.45)', zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: COLOR.bgPanel, border: `1px solid ${COLOR.borderSubtle}`,
        borderRadius: 16, maxWidth: 580, width: '100%', maxHeight: '92vh', overflowY: 'auto',
        boxShadow: '0 18px 40px -24px rgba(20,20,30,0.28)',
      }}>
        <div style={{ padding: '20px 24px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: COLOR.gold }} aria-hidden>auto_awesome</span>
            <div style={{ fontSize: 16, fontWeight: 500, color: COLOR.textPrimary }}>{t('quizSet.editor.aiPanel.title')}</div>
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: COLOR.goldBg, border: `1px solid rgba(245,158,11,0.30)`,
            padding: '4px 9px', borderRadius: 999, fontSize: 11, color: COLOR.gold,
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 12 }} aria-hidden>auto_awesome</span>
            <span>{limit - remaining}/{limit}</span>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', color: COLOR.textDisabled, cursor: 'pointer', padding: 4,
          }} aria-label={t('quizSet.editor.aiPanel.close')}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden>close</span>
          </button>
        </div>

        <div style={{ padding: '20px 24px 0' }}>
          <div style={{ marginBottom: 6, fontSize: 11, color: COLOR.textMuted, letterSpacing: 0.6, fontWeight: 500 }}>
            {t('quizSet.editor.aiPanel.bookHeader')}
          </div>
          <div style={{
            background: COLOR.inputBg, border: `1px solid rgba(245,158,11,0.30)`,
            borderRadius: 8, padding: '11px 13px', fontSize: 13, color: COLOR.textPrimary, marginBottom: 14,
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14, color: COLOR.gold, marginRight: 8, verticalAlign: -2 }} aria-hidden>menu_book</span>
            {localizeBibleBook(scope.book, lang)}
            <span style={{ marginLeft: 8, color: COLOR.textDisabled, fontSize: 11 }}>{t('quizSet.editor.aiPanel.bookEditHint')}</span>
          </div>

          {/* PHẠM VI: Chương + Câu */}
          <div style={{
            background: INSET_BG, border: `1px solid ${COLOR.borderXSubtle}`,
            borderRadius: 10, padding: '12px 14px', marginBottom: 16,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 13, color: COLOR.textMuted }} aria-hidden>bookmarks</span>
              <span style={{ fontSize: 11, fontWeight: 500, color: COLOR.textMuted, letterSpacing: 0.6 }}>{t('quizSet.editor.aiPanel.scopeHeader')}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }} className="ai-scope-grid">
              <div>
                <div style={{ fontSize: 11, fontWeight: 500, color: COLOR.textSecondary, marginBottom: 6 }}>{t('quizSet.editor.aiPanel.chapterLabel')}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 6, alignItems: 'center' }}>
                  <input type="number" min={1} value={chFrom}
                    onChange={e => {
                      const v = Math.max(1, +e.target.value || 1)
                      setChFrom(v)
                      if (chTo < v) setChTo(v)
                    }}
                    style={scopeInput()} />
                  <span style={{ color: COLOR.textDisabled, fontSize: 11 }}>{t('quizSet.editor.aiPanel.chapterTo')}</span>
                  <input type="number" min={chFrom} value={chTo}
                    onChange={e => setChTo(Math.max(chFrom, +e.target.value || chFrom))}
                    style={scopeInput()} />
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 500, color: COLOR.textSecondary }}>{t('quizSet.editor.aiPanel.verseLabel')}</span>
                  <span style={{ fontSize: 11, color: COLOR.textDisabled }}>{t('quizSet.editor.aiPanel.verseOptional')}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 6, alignItems: 'center' }}>
                  <input type="number" min={1} placeholder="1" value={vFromStr}
                    onChange={e => setVFromStr(e.target.value)}
                    style={scopeInput(true)} />
                  <span style={{ color: COLOR.textDisabled, fontSize: 11 }}>{t('quizSet.editor.aiPanel.chapterTo')}</span>
                  <input type="number" min={1} placeholder="31" value={vToStr}
                    onChange={e => setVToStr(e.target.value)}
                    style={scopeInput(true)} />
                </div>
              </div>
            </div>
          </div>

          {/* CHỦ ĐỀ */}
          <div style={{ marginBottom: 18 }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              fontSize: 11, fontWeight: 500, color: COLOR.textMuted, letterSpacing: 0.6, marginBottom: 6,
            }}>
              <span>{t('quizSet.editor.aiPanel.topicHeader')}</span>
              <span style={{ color: COLOR.textDisabled, fontWeight: 400, letterSpacing: 0 }}>{t('quizSet.editor.aiPanel.topicOptional')}</span>
            </div>
            <textarea
              rows={2}
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder={t('quizSet.editor.aiPanel.topicPlaceholder')}
              style={{
                width: '100%', background: COLOR.inputBg, border: `1px solid ${COLOR.borderSubtle}`,
                color: COLOR.textPrimary, padding: '11px 13px', borderRadius: 8,
                fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box', resize: 'none', outline: 'none',
              }}
            />
          </div>

          {/* PHÂN BỔ ĐỘ KHÓ */}
          <div style={{
            background: INSET_BG, border: `1px solid ${COLOR.borderXSubtle}`,
            borderRadius: 10, padding: '12px 14px', marginBottom: 18,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 13, color: COLOR.textMuted }} aria-hidden>bar_chart</span>
                <span style={{ fontSize: 11, fontWeight: 500, color: COLOR.textMuted, letterSpacing: 0.6 }}>{t('quizSet.editor.aiPanel.difficultyHeader')}</span>
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                <span style={{ color: COLOR.textDisabled }}>{t('quizSet.editor.aiPanel.totalLabel')}</span>
                <span style={{ fontWeight: 500, color: COLOR.gold, fontSize: 14 }}>{total}</span>
                <span style={{ color: COLOR.textDisabled }}>{t('quizSet.editor.aiPanel.totalUnit')}</span>
              </div>
            </div>

            {/* Stacked bar */}
            <div style={{
              display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden',
              marginBottom: 14, background: '#FFFFFF',
            }}>
              <div style={{ width: `${pct(easy)}%`, background: DIFFICULTY_COLORS.easy.accent, transition: 'width 0.2s' }} />
              <div style={{ width: `${pct(medium)}%`, background: DIFFICULTY_COLORS.medium.accent, transition: 'width 0.2s' }} />
              <div style={{ width: `${pct(hard)}%`, background: DIFFICULTY_COLORS.hard.accent, transition: 'width 0.2s' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
              <Stepper value={easy} setValue={setEasy} label={t('quizSet.editor.aiPanel.diffEasy')} color={DIFFICULTY_COLORS.easy} />
              <Stepper value={medium} setValue={setMedium} label={t('quizSet.editor.aiPanel.diffMedium')} color={DIFFICULTY_COLORS.medium} />
              <Stepper value={hard} setValue={setHard} label={t('quizSet.editor.aiPanel.diffHard')} color={DIFFICULTY_COLORS.hard} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 10, borderTop: `1px solid ${COLOR.borderXSubtle}` }}>
              <span style={{ fontSize: 11, color: COLOR.textDisabled }}>{t('quizSet.editor.aiPanel.suggestion')}</span>
              <button onClick={() => { setEasy(2); setMedium(2); setHard(2) }} style={pillBtn()}>
                <span className="material-symbols-outlined" style={{ fontSize: 12 }} aria-hidden>balance</span> {t('quizSet.editor.aiPanel.balance')}
              </button>
              <button onClick={() => { setEasy(4); setMedium(4); setHard(2) }} style={pillBtn(true)}>
                <span className="material-symbols-outlined" style={{ fontSize: 12 }} aria-hidden>pie_chart</span> {t('quizSet.editor.aiPanel.recommended')}
              </button>
            </div>
          </div>

          {error && (
            <div style={{
              background: 'rgba(179,69,47,0.10)', border: `1px solid rgba(179,69,47,0.30)`,
              color: COLOR.danger, padding: '8px 12px', borderRadius: 7, fontSize: 12, marginBottom: 12,
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14, marginRight: 6, verticalAlign: -2 }} aria-hidden>error</span>
              {error}
            </div>
          )}
        </div>

        <div style={{
          padding: '16px 24px 20px', borderTop: `1px solid ${COLOR.borderXSubtle}`,
          background: INSET_BG,
        }}>
          <button
            onClick={() => {
              const vFrom = vFromStr.trim() === '' ? null : Math.max(1, +vFromStr || 1)
              const vTo = vToStr.trim() === '' ? null : Math.max(vFrom ?? 1, +vToStr || (vFrom ?? 1))
              onGenerate({
                countEasy: easy, countMedium: medium, countHard: hard,
                chapterFrom: chFrom, chapterTo: chTo,
                verseFrom: vFrom, verseTo: vTo,
                topic: topic.trim() || undefined,
              })
            }}
            disabled={disabled}
            style={{
              width: '100%',
              background: disabled ? ACTION_BG_DISABLED : ACTION_BG,
              boxShadow: disabled ? 'none' : ACTION_SHADOW,
              color: ACTION_FG, border: 'none', padding: '13px 16px',
              borderRadius: 10, fontSize: 14, fontWeight: 600,
              cursor: disabled ? 'not-allowed' : 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: disabled ? 0.6 : 1,
            }}
          >
            <span className="material-symbols-outlined"
               style={{ fontSize: 16, animation: busy ? 'spin 1s linear infinite' : undefined }} aria-hidden>{busy ? 'progress_activity' : 'auto_awesome'}</span>
            {busy
              ? t('quizSet.editor.aiPanel.generating', { total })
              : tooLarge
                ? t('quizSet.editor.aiPanel.tooLarge')
                : overQuota
                  ? t('quizSet.editor.aiPanel.overQuota', { remaining })
                  : <>{t('quizSet.editor.aiPanel.ctaGenerate', { total })} <span style={{ opacity: 0.7, fontWeight: 400, marginLeft: 4 }}>{t('quizSet.editor.aiPanel.ctaBreakdown', { easy, medium, hard })}</span></>}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, fontSize: 11, color: COLOR.textDisabled }}>
            <span className="material-symbols-outlined" style={{ fontSize: 12 }} aria-hidden>schedule</span>
            <span>{t('quizSet.editor.aiPanel.durationHint')}</span>
          </div>
        </div>

        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @media (max-width: 480px) {
            .ai-scope-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </div>
    </div>
  )
}

function scopeInput(placeholderStyle = false): React.CSSProperties {
  return {
    width: '100%', background: COLOR.inputBg,
    border: `1px solid ${placeholderStyle ? COLOR.borderXSubtle : COLOR.borderSubtle}`,
    color: COLOR.textPrimary, padding: 9, borderRadius: 7, fontSize: 13,
    textAlign: 'center', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none',
  }
}

function pillBtn(highlighted = false): React.CSSProperties {
  return {
    background: highlighted ? COLOR.goldBg : '#FFFFFF',
    color: highlighted ? COLOR.gold : COLOR.textSecondary,
    border: `1px solid ${highlighted ? 'rgba(245,158,11,0.30)' : COLOR.borderSubtle}`,
    padding: '4px 10px', borderRadius: 999, fontSize: 11, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 4,
  }
}
