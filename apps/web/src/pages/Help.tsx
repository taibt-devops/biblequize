import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { FAQ_CATEGORIES, FAQ_ITEMS, type FaqCategory } from '../data/faqData'
import { PlaceBackdrop, Plaque } from '../components/lk/Place'
import PageMeta from '../components/PageMeta'

/**
 * /help — FAQ / self-service support page.
 *
 * <p>Users land here from the sidebar "Help" link, the user menu
 * dropdown, or a deep link on locked game-mode cards (e.g.
 * {@code /help#howUnlockRanked}). Rendered inside AppLayout so users
 * keep nav context.
 *
 * <h3>Behavior</h3>
 * <ul>
 *   <li>Items are grouped by category (see {@link FAQ_CATEGORIES}).</li>
 *   <li>Accordion-style: click a Q to expand/collapse its A.</li>
 *   <li>Category pills filter what's visible.</li>
 *   <li>Deep link {@code /help#<itemId>} auto-expands that item and
 *       smooth-scrolls to it.</li>
 *   <li>Only one item expanded at a time (reduces visual noise for
 *       long content).</li>
 * </ul>
 */
export default function Help() {
  const { t, i18n } = useTranslation()
  const location = useLocation()

  const [activeCategory, setActiveCategory] = useState<FaqCategory | 'all'>('all')
  const [openId, setOpenId] = useState<string | null>(null)

  // Deep link: /help#howUnlockRanked — expand + scroll to that item.
  // Runs once on mount + whenever the hash changes.
  useEffect(() => {
    const hash = location.hash.replace(/^#/, '')
    if (!hash) return
    const matching = FAQ_ITEMS.find((it) => it.id === hash)
    if (!matching) return
    setActiveCategory('all')
    setOpenId(hash)
    // Defer scroll so the accordion has rendered with the newly expanded state.
    requestAnimationFrame(() => {
      document.getElementById(`faq-${hash}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    })
  }, [location.hash])

  const visibleItems = useMemo(
    () =>
      activeCategory === 'all'
        ? FAQ_ITEMS
        : FAQ_ITEMS.filter((it) => it.category === activeCategory),
    [activeCategory],
  )

  // FAQPage structured data built from the same FAQ registry the page renders,
  // so the schema always matches the visible Q&A (rich-result requirement).
  const faqSchema = useMemo(
    () =>
      JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: FAQ_ITEMS.map((item) => ({
          '@type': 'Question',
          name: t(`help.items.${item.id}.q`),
          acceptedAnswer: { '@type': 'Answer', text: t(`help.items.${item.id}.a`) },
        })),
      }),
    [t],
  )

  return (
    <div data-testid="help-page" className="relative max-w-4xl mx-auto space-y-8">
      <PlaceBackdrop place="study" veil="strong" />
      <PageMeta
        title={i18n.language === 'vi' ? 'Trợ giúp & Câu hỏi thường gặp' : 'Help & FAQ'}
        description={
          i18n.language === 'vi'
            ? 'Câu hỏi thường gặp và hướng dẫn sử dụng BibleQuiz.'
            : 'Frequently asked questions and guides for BibleQuiz.'
        }
        canonicalPath="/help"
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqSchema }} />
      {/* ── Hero ── */}
      <section className="space-y-3">
        <Plaque className="text-[28px] md:text-[36px]">
          <img src="/images/lk/scroll.webp" alt="" aria-hidden className="h-[1em]" />
          {t('help.title')}
        </Plaque>
        <p className="m-0 w-fit max-w-full px-3 py-1 bg-bq-white/90 border-2 border-bq-ink rounded-2xl font-read text-[15px] text-bq-ink2">{t('help.subtitle')}</p>
      </section>

      {/* ── Category pills ── */}
      <section className="flex flex-wrap gap-2">
        <CategoryPill
          label={t('common.all', { defaultValue: 'Tất cả' })}
          active={activeCategory === 'all'}
          onClick={() => setActiveCategory('all')}
        />
        {FAQ_CATEGORIES.map((cat) => (
          <CategoryPill
            key={cat}
            label={t(`help.categories.${cat}`)}
            active={activeCategory === cat}
            onClick={() => setActiveCategory(cat)}
          />
        ))}
      </section>

      {/* ── Q&A list (grouped by category when 'all') ── */}
      {activeCategory === 'all' ? (
        <div className="space-y-8">
          {FAQ_CATEGORIES.map((cat) => {
            const items = FAQ_ITEMS.filter((it) => it.category === cat)
            if (items.length === 0) return null
            return (
              <section key={cat} data-testid={`faq-category-${cat}`}>
                <h2 className="w-fit px-3 py-0.5 rounded-full bg-bq-amber border-2 border-bq-ink text-[14px] font-extrabold text-bq-ink mb-3">
                  {t(`help.categories.${cat}`)}
                </h2>
                <div className="space-y-2">
                  {items.map((it) => (
                    <FaqAccordion
                      key={it.id}
                      id={it.id}
                      open={openId === it.id}
                      onToggle={() => setOpenId(openId === it.id ? null : it.id)}
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {visibleItems.map((it) => (
            <FaqAccordion
              key={it.id}
              id={it.id}
              open={openId === it.id}
              onToggle={() => setOpenId(openId === it.id ? null : it.id)}
            />
          ))}
          {visibleItems.length === 0 && (
            <p className="text-bq-ink2 text-sm">{t('help.emptyResult')}</p>
          )}
        </div>
      )}

      {/* ── Footer: contact hint ── */}
      <section className="mt-12 pt-6 border-t border-bq-hair text-center">
        <p className="text-sm text-bq-ink2">
          {t('help.contactHint')}{' '}
          <a
            href="mailto:support@forbible.org"
            className="font-bold text-bq-amberd hover:underline"
          >
            {t('help.contactCta')}
          </a>
        </p>
      </section>
    </div>
  )
}

/* ── Sub-components ─────────────────────────────────────────── */

function CategoryPill({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-xs font-bold tracking-tight transition-colors ${
        active
          ? 'bg-bq-action text-bq-ink shadow-bq-action'
          : 'bg-bq-white border border-bq-hair text-bq-ink2 hover:bg-bq-inset hover:text-bq-ink'
      }`}
    >
      {label}
    </button>
  )
}

function FaqAccordion({
  id,
  open,
  onToggle,
}: {
  id: string
  open: boolean
  onToggle: () => void
}) {
  const { t } = useTranslation()
  const panelRef = useRef<HTMLDivElement>(null)

  return (
    <div
      id={`faq-${id}`}
      data-testid={`faq-item-${id}`}
      data-open={open ? 'true' : 'false'}
      className={`rounded-2xl border transition-all ${
        open
          ? 'bg-bq-white border-bq-amber/40 shadow-bq-soft'
          : 'bg-bq-white border-bq-hair hover:border-bq-ink3'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="font-bold text-bq-ink flex-1">
          {t(`help.items.${id}.q`)}
        </span>
        <span
          className={`material-symbols-outlined text-bq-ink2 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        >
          expand_more
        </span>
      </button>
      {open && (
        <div ref={panelRef} className="px-5 pb-5 text-sm text-bq-ink2 leading-relaxed whitespace-pre-line">
          {t(`help.items.${id}.a`)}
        </div>
      )}
    </div>
  )
}
