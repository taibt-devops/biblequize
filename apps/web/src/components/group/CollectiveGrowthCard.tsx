import { useTranslation } from 'react-i18next';
import { useGroupCollectiveGrowth } from '../../hooks/useGroupCollectiveGrowth';

// BL-23 "Cùng nhau thuộc Lời" — anti-leaderboard collective growth (Q-A SAFE).
// Emerald per GD-12 palette (success/progress). Member-visible (D5).
interface Props {
  groupId: string;
}

const EMERALD_BG = 'rgba(46,125,79,0.06)';

export default function CollectiveGrowthCard({ groupId }: Props) {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useGroupCollectiveGrowth(groupId);

  if (isLoading) {
    return (
      <div
        data-testid="collective-growth-loading"
        className="rounded-2xl p-5 border-[0.5px] border-bq-emerald/20"
        style={{ background: EMERALD_BG }}
      >
        <div className="h-4 w-36 bg-bq-inset rounded animate-pulse mb-3" />
        <div className="h-9 w-52 bg-bq-inset rounded animate-pulse mb-3" />
        <div className="h-2.5 w-full bg-bq-inset rounded-full animate-pulse" />
      </div>
    );
  }

  // Fail soft (incl. non-member 400) — a quiet line, never a scary banner.
  if (isError || !data) {
    return (
      <div
        data-testid="collective-growth-error"
        className="rounded-2xl p-4 border-[0.5px] border-bq-hair bg-bq-white text-center"
      >
        <p className="text-bq-ink3 text-[12px]">{t('groups.growth.error')}</p>
      </div>
    );
  }

  const {
    totalLearned, contributors, masteryCompletions, memberCount,
    nextMilestone, milestonePct, perSet,
  } = data;

  if (totalLearned === 0) {
    return (
      <div
        data-testid="collective-growth-empty"
        className="rounded-2xl p-5 border-[0.5px] border-bq-emerald/20"
        style={{ background: EMERALD_BG }}
      >
        <div className="flex items-center gap-3">
          <div className="text-3xl select-none">📖</div>
          <div>
            <div className="text-bq-ink text-[14px] font-semibold mb-0.5">{t('groups.growth.title')}</div>
            <p className="text-bq-ink2 text-[12px] leading-relaxed">{t('groups.growth.empty')}</p>
          </div>
        </div>
      </div>
    );
  }

  const topSets = perSet.slice(0, 3);
  const remaining = Math.max(0, nextMilestone - totalLearned);

  return (
    <section
      data-testid="collective-growth-card"
      className="rounded-2xl p-5 border-[0.5px] border-bq-emerald/25"
      style={{ background: EMERALD_BG }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[18px]">🌱</span>
        <span className="text-bq-emerald text-[12.5px] font-bold">
          {t('groups.growth.title')}
        </span>
      </div>

      <div className="mb-1">
        <span className="text-bq-emerald text-[34px] font-bold leading-none tabular-nums">
          {totalLearned.toLocaleString()}
        </span>
        <span className="text-bq-ink2 text-[13px] ml-2">{t('groups.growth.versesUnit')}</span>
      </div>
      <p className="text-bq-ink2 text-[12px] mb-3">{t('groups.growth.subtitle')}</p>

      <div className="mb-3">
        <div className="h-2.5 w-full bg-bq-inset rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-bq-emerald transition-[width] duration-500"
            style={{ width: `${milestonePct}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-bq-ink3 text-[10px]">
            🔥 {t('groups.growth.milestone', { remaining, target: nextMilestone.toLocaleString() })}
          </span>
          <span className="text-bq-ink3 text-[10px] tabular-nums">{milestonePct}%</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-[11px]">
        <span className="text-bq-ink2">
          👥 <b className="text-bq-ink">{contributors}{memberCount ? `/${memberCount}` : ''}</b> {t('groups.growth.contributors')}
        </span>
        {masteryCompletions > 0 && (
          <span className="text-bq-ink2">
            🏅 <b className="text-bq-ink">{masteryCompletions}</b> {t('groups.growth.completions')}
          </span>
        )}
      </div>

      {topSets.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t-[0.5px] border-bq-hair">
          {topSets.map((s) => (
            <div key={s.quizSetId} className="flex items-center gap-2">
              <span className="text-bq-ink text-[11px] flex-1 truncate">{s.name}</span>
              <span className="text-bq-ink3 text-[10px] tabular-nums">{s.participants} 👤</span>
              <div className="w-16 h-1.5 bg-bq-inset rounded-full overflow-hidden">
                <div className="h-full bg-bq-emerald/70 rounded-full" style={{ width: `${s.avgMasteryPct}%` }} />
              </div>
              <span className="text-bq-ink3 text-[10px] tabular-nums w-8 text-right">{s.avgMasteryPct}%</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
