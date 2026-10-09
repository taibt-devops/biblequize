import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { QuizSetFull } from '../../../api/quizSets'
import { BIBLE_BOOKS_VI, localizeBibleBook, normalizeBibleBookVi } from '../../../data/bibleData'
import { COLOR, DARK_INPUT_STYLE, INSET_BG } from './styles'

interface Props {
  quizSet: QuizSetFull
  onChange: (patch: Partial<QuizSetFull>) => void
  defaultOpen?: boolean
  defaultBook?: string
  defaultChapterFrom?: number
  defaultChapterTo?: number
  onScopeChange?: (s: { book: string; chapterFrom: number; chapterTo: number }) => void
}

export default function MetadataAccordion({
  quizSet, onChange, defaultOpen = true,
  defaultBook = 'Sáng Thế Ký', defaultChapterFrom = 1, defaultChapterTo = 1,
  onScopeChange,
}: Props) {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(defaultOpen)
  const [book, setBook] = useState(() => normalizeBibleBookVi(defaultBook))
  const [chapterFrom, setChapterFrom] = useState(defaultChapterFrom)
  const [chapterTo, setChapterTo] = useState(defaultChapterTo)

  const lang: 'vi' | 'en' = i18n.language?.startsWith('en') ? 'en' : 'vi'

  const emitScope = (b: string, cf: number, ct: number) => {
    onScopeChange?.({ book: b, chapterFrom: cf, chapterTo: Math.max(cf, ct) })
  }

  return (
    <div style={{
      background: INSET_BG,
      borderBottom: `1px solid ${COLOR.borderXSubtle}`,
      padding: '14px 24px',
    }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: open ? 10 : 0, cursor: 'pointer' }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 14, color: COLOR.textMuted }} aria-hidden>{open ? 'expand_more' : 'chevron_right'}</span>
        <span style={{ fontSize: 11, fontWeight: 500, color: COLOR.textMuted, letterSpacing: 0.6 }}>
          {t('quizSet.editor.metadata.header')}
        </span>
        <span style={{ color: COLOR.textDisabled, fontSize: 11, marginLeft: 4 }}>
          · {localizeBibleBook(book, lang)} {chapterFrom}{chapterTo > chapterFrom ? `-${chapterTo}` : ''}
          {quizSet.coverScripture ? ` · ${quizSet.coverScripture}` : ''}
        </span>
      </div>

      {open && (
        <div className="qse-meta-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1.2fr) minmax(0, 1.2fr) minmax(0, 0.6fr)', gap: 12 }}>
          <input
            type="text"
            placeholder={t('quizSet.editor.metadata.namePlaceholder')}
            value={quizSet.name || ''}
            onChange={e => onChange({ name: e.target.value })}
            style={DARK_INPUT_STYLE}
          />
          <div style={{ position: 'relative' }}>
            <select
              value={book}
              onChange={e => { setBook(e.target.value); emitScope(e.target.value, chapterFrom, chapterTo) }}
              style={{
                ...DARK_INPUT_STYLE,
                borderColor: COLOR.goldFocus,
                paddingRight: 30,
                appearance: 'none',
                cursor: 'pointer',
              }}
            >
              {BIBLE_BOOKS_VI.map(b => (
                <option key={b} value={b} style={{ background: COLOR.inputBg }}>
                  {localizeBibleBook(b, lang)}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined" style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              fontSize: 13, color: COLOR.textDisabled, pointerEvents: 'none',
            }} aria-hidden>expand_more</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 5, alignItems: 'center' }}>
            <input
              type="number" min={1} value={chapterFrom}
              onChange={e => { const v = Math.max(1, +e.target.value || 1); setChapterFrom(v); emitScope(book, v, chapterTo) }}
              style={{ ...DARK_INPUT_STYLE, textAlign: 'center', padding: 9 }}
            />
            <span style={{ color: COLOR.textDisabled, fontSize: 11 }}>{t('quizSet.editor.metadata.chapterTo')}</span>
            <input
              type="number" min={chapterFrom} value={chapterTo}
              onChange={e => { const v = Math.max(chapterFrom, +e.target.value || chapterFrom); setChapterTo(v); emitScope(book, chapterFrom, v) }}
              style={{ ...DARK_INPUT_STYLE, textAlign: 'center', padding: 9 }}
            />
          </div>
          <div style={{ position: 'relative' }} title={t('quizSet.editor.metadata.languageTitle')}>
            <select
              aria-label={t('quizSet.editor.metadata.languageLabel')}
              data-testid="qse-language-select"
              value={(quizSet.language || 'vi').toLowerCase()}
              onChange={e => onChange({ language: e.target.value })}
              style={{
                ...DARK_INPUT_STYLE,
                paddingRight: 26,
                appearance: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="vi" style={{ background: COLOR.inputBg }}>{t('quizSet.editor.metadata.langVi')}</option>
              <option value="en" style={{ background: COLOR.inputBg }}>{t('quizSet.editor.metadata.langEn')}</option>
            </select>
            <span className="material-symbols-outlined" style={{
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              fontSize: 13, color: COLOR.textDisabled, pointerEvents: 'none',
            }} aria-hidden>expand_more</span>
          </div>
        </div>
      )}
      <style>{`
        @media (max-width: 767px) {
          .qse-meta-grid { grid-template-columns: minmax(0, 1fr) !important; }
        }
      `}</style>
    </div>
  )
}
