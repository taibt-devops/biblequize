import React from 'react';
import { useTranslation } from 'react-i18next';
import { MatchResultOverlay, SdArenaHeader } from '../RoomOverlays';
import type { SuddenDeathState } from '../hooks/useSuddenDeath';

/**
 * FMR-4 — Sudden Death (Đấu vương) mode fragments.
 * Default export renders the champion-vs-challenger arena header; named
 * exports cover the spectating badge and the match-result overlay. Mode
 * gating stays with the shell so render conditions match the pre-split
 * page 1:1.
 */
const SuddenDeathView: React.FC<{ sd: SuddenDeathState; myUsername: string; onPredict?: (userId: string) => void }> = ({ sd, myUsername, onPredict }) => {
  const { t } = useTranslation();
  const nameOf = (id: string | null) => (id === sd.sdChampionId ? sd.sdChampionName : sd.sdChallengerName);
  return (
    <>
      <SdArenaHeader
        championName={sd.sdChampionName}
        championStreak={sd.sdChampionStreak}
        challengerName={sd.sdChallengerName}
        myUsername={myUsername}
        queueRemaining={sd.sdQueueRemaining}
      />
      {/* PCV-16: khán giả đoán ai thắng trận này (khóa khi câu đầu bắt đầu). */}
      {sd.sdSpectating && sd.predictionOpen && onPredict && (
        <div data-testid="sd-predict" className="mb-4 rounded-2xl border-2 border-dashed border-bq-ink/30 bg-bq-cream px-4 py-3">
          <div className="text-[13px] font-extrabold text-bq-ink mb-2">{t('room.sd.predictTitle')}</div>
          <div className="flex flex-wrap gap-2">
            {[sd.sdChampionId, sd.sdChallengerId].map(id => (
              <button
                key={id}
                type="button"
                data-testid={`sd-predict-${id}`}
                aria-pressed={sd.myPick === id}
                onClick={() => onPredict(id)}
                className={`px-3 py-1.5 rounded-full border-2 border-bq-ink text-[13.5px] font-extrabold ${sd.myPick === id ? 'bg-bq-amber text-bq-ink' : 'bg-bq-white text-bq-ink hover:bg-bq-paper'}`}
              >
                {nameOf(id)}
              </button>
            ))}
          </div>
        </div>
      )}
      {sd.sdSpectating && !sd.predictionOpen && sd.myPick && (
        <div data-testid="sd-predict-status" className="mb-4 text-[13px] font-bold text-bq-ink2">
          {sd.lastPredictionCorrect === null
            ? t('room.sd.predictPicked', { name: nameOf(sd.myPick) })
            : sd.lastPredictionCorrect ? t('room.sd.predictRight') : t('room.sd.predictWrong')}
        </div>
      )}
    </>
  );
};

/** Header pill shown while the viewer waits outside the hot seat. */
export const SdSpectatingBadge: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="hidden sm:flex items-center gap-1 bg-bq-ember/10 px-2.5 py-1 rounded-full border border-bq-ember/20">
      <span className="material-symbols-outlined text-bq-ember text-sm">visibility</span>
      <span className="text-bq-ember text-[10px] font-bold">{t('room.quiz.sdSpectating')}</span>
    </div>
  );
};

/** Full-screen match-result overlay (winner/loser of the last duel). */
export const SdMatchResultOverlay: React.FC<{
  result: NonNullable<SuddenDeathState['sdMatchResult']>;
  myUserId: string;
  onDismiss: () => void;
}> = ({ result, myUserId, onDismiss }) => (
  <MatchResultOverlay
    winnerId={result.winnerId}
    winnerName={result.winnerName}
    loserId={result.loserId}
    loserName={result.loserName}
    myUserId={myUserId}
    onDismiss={onDismiss}
  />
);

export default SuddenDeathView;
