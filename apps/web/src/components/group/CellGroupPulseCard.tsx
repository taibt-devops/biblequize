import { useTranslation } from 'react-i18next';

// Sprint 5 placeholder — Sprint 6 will fetch GET /api/groups/:id/pulse
// and render real strong/medium/weak status with active ratio + live
// rooms + new content counts (heuristic: 0.5x active + 0.3x rooms +
// 0.2x content; thresholds 0.7 / 0.4).
export default function CellGroupPulseCard() {
  const { t } = useTranslation();
  return (
    <div
      data-testid="cell-group-pulse-placeholder"
      className="rounded-2xl p-4 border border-dashed border-bq-emerald/25"
      style={{ background: 'rgba(46,125,79,0.06)' }}
    >
      <div className="flex items-center gap-3">
        <div className="text-3xl opacity-40 select-none">💚</div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="text-[12px] font-bold text-bq-emerald">
              {t('groups.pulse.title')}
            </span>
            <span className="text-[11.5px] text-bq-ink2 px-1.5 py-0.5 rounded bg-bq-inset">
              {t('groups.pulse.comingSoon')}
            </span>
            <span className="text-[11.5px] px-1.5 py-0.5 rounded bg-bq-amber/10 text-bq-amberd ml-auto">
              👑 {t('groups.pulse.leaderOnly')}
            </span>
          </div>
          <p className="text-[12px] text-bq-ink2 leading-relaxed">
            {t('groups.pulse.placeholder')}
          </p>
        </div>
      </div>
    </div>
  );
}
