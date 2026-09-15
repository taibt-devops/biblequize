import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { SkeletonCard } from '../../components/Skeleton'
import MemoryVerseItem from '../../components/memorize/MemoryVerseItem'
import { useBookName } from '../../hooks/useBookName'
import { useAddMemoryVerse, useDeleteMemoryVerse, useMemoryVerses } from '../../hooks/useMemoryVerses'
import { formatReference, SUGGESTED_VERSES } from '../../utils/memorize/schedule'

/** /practice/memorize — the user's memory verses (SPEC_USER §5.1.1). */
export default function MemorizeList() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const bookName = useBookName()
  const lang = i18n.language === 'en' ? 'en' : 'vi'
  const { data, isLoading, isError, refetch } = useMemoryVerses()
  const addVerse = useAddMemoryVerse()
  const deleteVerse = useDeleteMemoryVerse()
  const dueCount = data?.dueCount ?? 0

  return (
    <div data-testid="memorize-list-page" className="space-y-6">
      <section>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-bq-amberd/90">
          {t('memorize.list.eyebrow')}
        </p>
        <h1 className="mb-1 font-display text-2xl font-bold leading-tight text-bq-ink">{t('memorize.list.title')}</h1>
        <p className="text-sm text-bq-ink2">{t('memorize.list.desc')}</p>
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          data-testid="memorize-start-review-btn"
          disabled={dueCount === 0}
          onClick={() => navigate('/practice/memorize/session')}
          className="rounded-xl bg-bq-action px-5 py-2.5 text-sm font-semibold text-white shadow-bq-action transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
        >
          {dueCount > 0 ? t('memorize.list.reviewDue', { count: dueCount }) : t('memorize.list.noneDue')}
        </button>
        <button
          type="button"
          data-testid="memorize-add-btn"
          onClick={() => navigate('/practice/memorize/add')}
          className="rounded-xl border border-bq-hair bg-bq-white px-5 py-2.5 text-sm font-semibold text-bq-ink shadow-bq-soft transition hover:border-bq-sapphire/40"
        >
          + {t('memorize.list.add')}
        </button>
      </div>

      {isLoading && (
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-3 rounded-xl border border-bq-ruby/25 bg-bq-ruby/10 p-4">
          <span className="flex-1 text-sm font-semibold text-bq-ruby">{t('memorize.list.loadError')}</span>
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-lg bg-bq-ruby/15 px-3 py-1.5 text-xs font-semibold text-bq-ruby hover:bg-bq-ruby/20"
          >
            {t('memorize.list.retry')}
          </button>
        </div>
      )}

      {data && data.items.length === 0 && (
        <section data-testid="memorize-empty" className="rounded-2xl border border-bq-hair bg-bq-white p-6 text-center shadow-bq-soft">
          <h2 className="font-display text-lg font-semibold text-bq-ink">{t('memorize.list.emptyTitle')}</h2>
          <p className="mt-1 text-sm text-bq-ink2">{t('memorize.list.emptyDesc')}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {SUGGESTED_VERSES.map(ref => (
              <button
                key={`${ref.book}-${ref.chapter}-${ref.verseStart}`}
                type="button"
                data-testid="memorize-suggestion"
                disabled={addVerse.isPending}
                onClick={() => addVerse.mutate(ref)}
                className="rounded-full border border-bq-hair bg-bq-inset px-3 py-1.5 text-xs font-semibold text-bq-ink hover:border-bq-sapphire/40 disabled:opacity-50"
              >
                {formatReference(bookName(ref.book, lang), ref.chapter, ref.verseStart, ref.verseEnd)}
              </button>
            ))}
          </div>
          {addVerse.isError && <p className="mt-3 text-xs text-bq-ruby">{t('memorize.list.suggestionError')}</p>}
        </section>
      )}

      {data && data.items.length > 0 && (
        <ul className="space-y-3">
          {data.items.map(verse => (
            <MemoryVerseItem
              key={verse.id}
              verse={verse}
              bookName={bookName(verse.book, lang)}
              deleting={deleteVerse.isPending}
              onDelete={id => deleteVerse.mutate(id)}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
