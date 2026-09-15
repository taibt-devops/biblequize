import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Skeleton } from '../../components/Skeleton'
import { getChapterCount, getVerseCount } from '../../data/bibleData'
import { useBooks } from '../../hooks/useBookName'
import { useAddMemoryVerse, usePassage } from '../../hooks/useMemoryVerses'
import { verseEndOptions } from '../../utils/memorize/schedule'

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1)
const SELECT = 'w-full rounded-xl border border-bq-hair bg-bq-white px-3 py-2.5 text-sm text-bq-ink disabled:opacity-50'

/** /practice/memorize/add — pick book → chapter → verse range (≤ 5), preview, add (SPEC_USER §5.1.1). */
export default function MemorizeAdd() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { data: books = [] } = useBooks()
  const [book, setBook] = useState('')
  const [chapter, setChapter] = useState(0)
  const [from, setFrom] = useState(0)
  const [to, setTo] = useState(0)
  const passage = usePassage(book || undefined, chapter || undefined, from || undefined, to || undefined)
  const addVerse = useAddMemoryVerse()

  const sortedBooks = useMemo(
    () => (Array.isArray(books) ? [...books] : []).sort((a, b) => a.orderIndex - b.orderIndex),
    [books],
  )
  const verseCount = book && chapter ? getVerseCount(book, chapter) : 0
  const status = (addVerse.error as { response?: { status?: number } } | null)?.response?.status

  const submit = () =>
    addVerse.mutate(
      { book, chapter, verseStart: from, verseEnd: to },
      { onSuccess: () => navigate('/practice/memorize') },
    )

  return (
    <div data-testid="memorize-add-page" className="space-y-6">
      <section>
        <button type="button" onClick={() => navigate('/practice/memorize')} className="mb-3 text-xs font-semibold text-bq-sapphire">
          ← {t('memorize.add.back')}
        </button>
        <h1 className="font-display text-2xl font-bold text-bq-ink">{t('memorize.add.title')}</h1>
        <p className="text-sm text-bq-ink2">{t('memorize.add.maxHint')}</p>
      </section>

      <div className="grid grid-cols-2 gap-3 rounded-2xl border border-bq-hair bg-bq-white p-5 shadow-bq-soft md:grid-cols-4">
        <label className="col-span-2 space-y-1 text-xs font-semibold text-bq-ink2 md:col-span-1">
          {t('memorize.add.book')}
          <select data-testid="memorize-add-book" className={SELECT} value={book}
            onChange={e => { setBook(e.target.value); setChapter(0); setFrom(0); setTo(0) }}>
            <option value="">{t('memorize.add.choose')}</option>
            {sortedBooks.map(b => (
              <option key={b.name} value={b.name}>{i18n.language === 'en' ? b.name : b.nameVi}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs font-semibold text-bq-ink2">
          {t('memorize.add.chapter')}
          <select data-testid="memorize-add-chapter" className={SELECT} value={chapter || ''} disabled={!book}
            onChange={e => { setChapter(Number(e.target.value)); setFrom(0); setTo(0) }}>
            <option value="">{t('memorize.add.choose')}</option>
            {range(book ? getChapterCount(book) : 0).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs font-semibold text-bq-ink2">
          {t('memorize.add.verseFrom')}
          <select data-testid="memorize-add-verse-from" className={SELECT} value={from || ''} disabled={!chapter}
            onChange={e => { const v = Number(e.target.value); setFrom(v); setTo(v) }}>
            <option value="">{t('memorize.add.choose')}</option>
            {range(verseCount).map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs font-semibold text-bq-ink2">
          {t('memorize.add.verseTo')}
          <select data-testid="memorize-add-verse-to" className={SELECT} value={to || ''} disabled={!from}
            onChange={e => setTo(Number(e.target.value))}>
            <option value="">{t('memorize.add.choose')}</option>
            {verseEndOptions(from, verseCount).map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
      </div>

      {passage.isFetching && <Skeleton className="h-24 w-full rounded-2xl" />}
      {passage.isError && !passage.isFetching && (
        <p data-testid="memorize-add-no-text" className="rounded-xl border border-bq-amber/30 bg-bq-amber/10 p-4 text-sm text-bq-amberd">
          {t('memorize.add.noText')}
        </p>
      )}
      {passage.data && !passage.isFetching && (
        <div data-testid="memorize-add-preview" className="rounded-2xl border border-bq-hair bg-bq-inset p-5 font-literata text-lg leading-relaxed text-bq-ink">
          {passage.data.verses.map(v => (
            <span key={v.verse}><sup className="mr-1 text-xs text-bq-ink3">{v.verse}</sup>{v.text} </span>
          ))}
        </div>
      )}

      {addVerse.isError && (
        <p data-testid="memorize-add-error" className="text-sm font-semibold text-bq-ruby">
          {status === 409 ? t('memorize.add.duplicate') : t('memorize.add.error')}
        </p>
      )}

      <button
        type="button"
        data-testid="memorize-add-submit"
        disabled={!passage.data || passage.isFetching || addVerse.isPending}
        onClick={submit}
        className="w-full rounded-xl bg-bq-action px-5 py-3 text-sm font-semibold text-white shadow-bq-action transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none md:w-auto"
      >
        {t('memorize.add.submit')}
      </button>
    </div>
  )
}
