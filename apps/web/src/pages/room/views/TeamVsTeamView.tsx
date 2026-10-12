import React from 'react';
import { useTranslation } from 'react-i18next';
import { TeamScoreBar } from '../RoomOverlays';
import { FILL_STYLE } from '../roomQuizCore';
import type { TeamVsTeamState } from '../hooks/useTeamVsTeam';

/**
 * FMR-4 — Team vs Team mode fragments.
 * Default export renders the live team-score header bar; named exports cover
 * the header badge and the perfect-round banner. Mode gating stays with the
 * shell so render conditions match the pre-split page 1:1.
 */
const TeamVsTeamView: React.FC<{ team: TeamVsTeamState; names?: { A: string; B: string } }> = ({ team, names }) => (
  <TeamScoreBar
    scoreA={team.teamScoreA}
    scoreB={team.teamScoreB}
    perfectA={team.perfectA}
    perfectB={team.perfectB}
    nameA={names?.A}
    nameB={names?.B}
  />
);

/** Header pill: which team the viewer plays for. */
export const TeamHeaderBadge: React.FC<{ myTeam: string; names?: { A: string; B: string } }> = ({ myTeam, names }) => (
  <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
    myTeam === 'A'
      ? 'bg-bq-sapphire/10 border-bq-sapphire/20'
      : 'bg-bq-ruby/10 border-bq-ruby/20'
  }`}>
    <span className={`w-2 h-2 rounded-full ${myTeam === 'A' ? 'bg-bq-sapphire' : 'bg-bq-ruby'}`} />
    <span className={`text-[10px] font-black ${myTeam === 'A' ? 'text-bq-sapphire' : 'text-bq-ruby'}`}>
      {names ? (myTeam === 'A' ? names.A : names.B) : `Team ${myTeam}`}
    </span>
  </div>
);

/** Banner under the answer grid when a team aced the round (+50 bonus). */
export const PerfectRoundBanner: React.FC<{
  perfectA: boolean; perfectB: boolean; myTeam: string | null; names?: { A: string; B: string };
}> = ({ perfectA, perfectB, myTeam, names }) => {
  const { t } = useTranslation();
  const teams = [perfectA ? (names?.A ?? 'A') : null, perfectB ? (names?.B ?? 'B') : null].filter(Boolean).join(' & ');
  return (
  <div className={`p-4 rounded-2xl border text-center font-bold text-sm animate-pulse ${
    (perfectA && myTeam === 'A') || (perfectB && myTeam === 'B')
      ? 'border-bq-amber/30 bg-bq-amber/5 text-bq-amberd'
      : 'border-bq-emerald/30 bg-bq-emerald/5 text-bq-emerald'
  }`}>
    <span className="material-symbols-outlined text-sm mr-1" style={FILL_STYLE}>stars</span>
    {/* PCV-14: thưởng cả đội cộng vào điểm đội, không vào điểm cá nhân. */}
    {t('room.team.allCorrectBanner', { teams })}
  </div>
  );
};

export default TeamVsTeamView;
