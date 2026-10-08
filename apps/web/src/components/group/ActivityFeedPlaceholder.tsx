import { useTranslation } from 'react-i18next';

// GD-FIX-6 — even though the feed itself is deferred to BL-17 (Sprint 6),
// the filter chip row is rendered now (active "Tất cả" + 3 disabled
// chips for Quiz / Live / Tin) so member viewers preview the future IA.
const FILTERS: Array<{ key: 'all' | 'quiz' | 'live' | 'news'; icon: string }> = [
  { key: 'all', icon: '' },
  { key: 'quiz', icon: '📚' },
  { key: 'live', icon: '🎮' },
  { key: 'news', icon: '📢' },
];

export default function ActivityFeedPlaceholder() {
  const { t } = useTranslation();
  return (
    <div data-testid="group-activity-feed-placeholder">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-[12.5px] font-bold text-bq-amberd flex items-center gap-1.5">
          <span>📜</span>
          <span>{t('groups.activity.feedTitle')}</span>
        </h2>
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map((f) => {
            const active = f.key === 'all';
            return (
              <button
                key={f.key}
                disabled={!active}
                aria-disabled={!active || undefined}
                title={active ? undefined : t('groups.activity.filterDisabled')}
                data-testid={`activity-filter-${f.key}`}
                className={`text-[10px] px-2 py-1 rounded-full font-semibold border transition-colors ${
                  active
                    ? 'bg-bq-amber/15 text-bq-amberd border-bq-amber/40'
                    : 'bg-bq-inset text-bq-ink2 border-bq-hair opacity-60 cursor-not-allowed'
                }`}
              >
                {f.icon ? <span className="mr-1">{f.icon}</span> : null}
                {t(`groups.activity.filter.${f.key}`)}
              </button>
            );
          })}
        </div>
      </div>
      <div
        className="bg-bq-inset rounded-2xl p-8 text-center border border-dashed border-bq-hair"
      >
        <div className="text-5xl mb-3 opacity-40">📜</div>
        <h3 className="text-bq-ink font-bold mb-1 text-sm">
          {t('groups.activity.placeholder.title')}
        </h3>
        <p className="text-[12px] text-bq-ink2 max-w-md mx-auto">
          {t('groups.activity.placeholder.desc')}
        </p>
      </div>
    </div>
  );
}
