import React from 'react';
import { useTranslation } from 'react-i18next';
import { FILL_STYLE } from '../roomQuizCore';
import type { EliminationToast } from '../hooks/useBattleRoyale';

/**
 * FMR-4 — Battle Royale mode fragments.
 * Default export renders the elimination-toast stack (top overlay); named
 * exports cover the header badges. Mode gating (isBattleRoyale / isSpectator)
 * stays with the shell so render conditions match the pre-split page 1:1.
 */
const BattleRoyaleView: React.FC<{ toasts: EliminationToast[] }> = ({ toasts }) => {
  const { t } = useTranslation();
  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-30 space-y-2 w-72">
      {toasts.map(toast => (
        toast.kind === 'revived' ? (
          <div key={toast.id} data-testid="br-revived-toast" className="bg-bq-white border border-bq-emerald/40 text-bq-emerald text-sm px-4 py-2.5 rounded-xl shadow-bq-soft text-center flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-sm" style={FILL_STYLE}>favorite</span>
            <b>{toast.username}</b> {t('room.quiz.revivedSuffix')}
          </div>
        ) : (
          <div key={toast.id} className="bg-bq-white border border-bq-ruby/30 text-bq-ruby text-sm px-4 py-2.5 rounded-xl shadow-bq-soft animate-pulse text-center flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-sm" style={FILL_STYLE}>person_remove</span>
            <b>{toast.username}</b> {t('room.quiz.eliminatedSuffix', { rank: toast.rank })}
          </div>
        )
      ))}
    </div>
  );
};

/** Header pill: remaining/total players (only rendered while activeCount > 0). */
export const BattleRoyaleHeaderBadge: React.FC<{ activeCount: number; totalCount: number }> = ({ activeCount, totalCount }) => (
  <div className="hidden sm:flex items-center gap-1.5 bg-bq-ruby/10 px-2.5 py-1 rounded-full border border-bq-ruby/30">
    <span className="material-symbols-outlined text-bq-ruby text-sm" style={FILL_STYLE}>group</span>
    <span className="text-bq-ruby text-[10px] font-black">{activeCount}/{totalCount}</span>
  </div>
);

/** Header pill: eliminated player who chose to keep watching. */
export const SpectatorBadge: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="hidden sm:flex items-center gap-1 bg-bq-inset px-2.5 py-1 rounded-full border border-bq-hair">
      <span className="material-symbols-outlined text-bq-ink2 text-sm">visibility</span>
      <span className="text-bq-ink2 text-[10px] font-bold">{t('room.quiz.spectator')}</span>
    </div>
  );
};

export default BattleRoyaleView;
