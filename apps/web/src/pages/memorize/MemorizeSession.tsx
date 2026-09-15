import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { SkeletonCard } from '../../components/Skeleton'
import ClozeExercise from '../../components/memorize/ClozeExercise'
import ContextPassage from '../../components/memorize/ContextPassage'
import PhraseOrderExercise from '../../components/memorize/PhraseOrderExercise'
import SessionSummary from '../../components/memorize/SessionSummary'
import { useBookName } from '../../hooks/useBookName'
import { useMemorizeSession } from '../../hooks/useMemorizeSession'
import { usePassage } from '../../hooks/useMemoryVerses'
import { formatReference } from '../../utils/memorize/schedule'

const CONTEXT_VERSES = 2

/** /practice/memorize/session — review every due verse once (SPEC_USER §5.1.1). */
export default function MemorizeSession() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const bookName = useBookName()
  const session = useMemorizeSession()
  const { current, exercise, outcome, position } = session
  const context = usePassage(
    current?.book, current?.chapter,
    current ? Math.max(1, current.verseStart - CONTEXT_VERSES) : undefined,
    current ? current.verseEnd + CONTEXT_VERSES : undefined,
  )
  const backToList = () => navigate('/practice/memorize')
  const lang = i18n.language === 'en' ? 'en' : 'vi'
  const isLast = position.index === position.total

  return (
    <div data-testid="memorize-session-page" className="mx-auto max-w-2xl space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-bq-ink">{t('memorize.session.title')}</h1>
        {session.status === 'active' && (
          <span className="text-xs font-semibold text-bq-ink3">
            {t('memorize.session.progress', { index: position.index, total: position.total })}
          </span>
        )}
      </header>

      {session.status === 'loading' && <SkeletonCard />}

      {session.status === 'error' && (
        <div className="flex items-center gap-3 rounded-xl border border-bq-ruby/25 bg-bq-ruby/10 p-4">
          <span className="flex-1 text-sm font-semibold text-bq-ruby">{t('memorize.session.loadError')}</span>
          <button type="button" onClick={() => session.reload()}
            className="rounded-lg bg-bq-ruby/15 px-3 py-1.5 text-xs font-semibold text-bq-ruby hover:bg-bq-ruby/20">
            {t('memorize.session.retry')}
          </button>
        </div>
      )}

      {session.status === 'empty' && (
        <section className="rounded-2xl border border-bq-hair bg-bq-white p-6 text-center shadow-bq-soft">
          <h2 className="font-display text-lg font-semibold text-bq-ink">{t('memorize.session.emptyTitle')}</h2>
          <p className="mt-1 text-sm text-bq-ink2">{t('memorize.session.emptyDesc')}</p>
          <button type="button" onClick={backToList} className="mt-4 text-sm font-semibold text-bq-sapphire">
            {t('memorize.session.backToList')}
          </button>
        </section>
      )}

      {session.status === 'done' && (
        <SessionSummary reviewed={session.summary.reviewed} leveledUp={session.summary.leveledUp} onBack={backToList} />
      )}

      {session.status === 'active' && current && exercise && (
        <>
          {session.phase === 'context' && (
            <ContextPassage
              reference={formatReference(bookName(current.book, lang), current.chapter, current.verseStart, current.verseEnd)}
              verseStart={current.verseStart}
              verseEnd={current.verseEnd}
              fallbackText={current.text}
              passage={context.data}
              loading={context.isLoading}
              onStart={session.start}
            />
          )}

          {session.phase === 'exercise' && exercise.type === 'order' && (
            <PhraseOrderExercise key={current.id} text={current.text} chunkSize={exercise.chunkSize}
              seed={session.seed} onComplete={session.complete} />
          )}
          {session.phase === 'exercise' && exercise.type === 'cloze' && (
            <ClozeExercise key={current.id} text={current.text} ratio={exercise.ratio} seed={session.seed}
              contextText={context.data?.verses.map(v => v.text).join(' ')} onComplete={session.complete} />
          )}

          {session.phase === 'result' && outcome && (
            <section data-testid="memorize-result" data-passed={String(outcome.passed)}
              className="space-y-4 rounded-2xl border border-bq-hair bg-bq-white p-5 shadow-bq-soft">
              <p className={`font-display text-lg font-bold ${outcome.passed ? 'text-bq-emerald' : 'text-bq-amberd'}`}>
                {outcome.passed ? t('memorize.session.passed') : t('memorize.session.failed')}
              </p>
              <p className="font-literata text-lg leading-relaxed text-bq-ink">{current.text}</p>
              {session.saveFailed && (
                <div className="flex items-center gap-3 text-sm text-bq-ruby">
                  <span className="flex-1">{t('memorize.session.saveFailed')}</span>
                  <button type="button" onClick={session.retrySave} className="font-semibold underline">
                    {t('memorize.session.retry')}
                  </button>
                </div>
              )}
              <button
                type="button"
                data-testid="memorize-next-btn"
                disabled={!session.canContinue}
                onClick={session.next}
                className="w-full rounded-xl bg-bq-action px-5 py-3 text-sm font-semibold text-white shadow-bq-action transition hover:brightness-105 disabled:opacity-50 disabled:shadow-none md:w-auto"
              >
                {session.saving ? t('memorize.session.saving') : isLast ? t('memorize.session.finish') : t('memorize.session.next')}
              </button>
            </section>
          )}
        </>
      )}
    </div>
  )
}
