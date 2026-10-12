import { useState } from 'react';
import type { RoomEvent, QuizEndSummary } from '../../../types/room';

export interface TeamVsTeamState {
  myTeam: string | null;
  teamScoreA: number;
  teamScoreB: number;
  perfectA: boolean;
  perfectB: boolean;
  teamWinner: string | null;
  teamWinScoreA: number;
  teamWinScoreB: number;
  /** PCV-22: Hội ý — đồng đội đã chọn gì ở câu này (playerId → lựa chọn). */
  teamVotes: Record<string, { username: string; answerIndex: number }>;
  /** PCV-22: chat đội. */
  teamChat: { senderId: string; sender: string; text: string }[];
  /** PCV-22: đáp án hai đội của câu vừa công bố. */
  teamAnswers: { A?: number | null; B?: number | null } | null;
}

/**
 * FMR-3 — Team vs Team mode state + event handling.
 * Owns team assignment (matched by userId), the live team score bar,
 * perfect-round flags and the end-of-match winner snapshot.
 */
export function useTeamVsTeam(myUserId: string, initialTeam: string | null) {
  const [myTeam, setMyTeam] = useState<string | null>(initialTeam);
  const [teamScoreA, setTeamScoreA] = useState(0);
  const [teamScoreB, setTeamScoreB] = useState(0);
  const [perfectA, setPerfectA] = useState(false);
  const [perfectB, setPerfectB] = useState(false);
  const [teamWinner, setTeamWinner] = useState<string | null>(null);
  const [teamWinScoreA, setTeamWinScoreA] = useState(0);
  const [teamWinScoreB, setTeamWinScoreB] = useState(0);
  const [teamVotes, setTeamVotes] = useState<TeamVsTeamState['teamVotes']>({});
  const [teamChat, setTeamChat] = useState<TeamVsTeamState['teamChat']>([]);
  const [teamAnswers, setTeamAnswers] = useState<TeamVsTeamState['teamAnswers']>(null);

  const handleEvent = (msg: RoomEvent) => {
    switch (msg.type) {
      case 'QUESTION_START': {
        // New round — clear last round's perfect banners.
        setPerfectA(false);
        setPerfectB(false);
        setTeamVotes({});
        setTeamAnswers(null);
        break;
      }
      case 'TEAM_VOTE': {
        const d = msg.data;
        setTeamVotes(prev => ({ ...prev, [d.playerId]: { username: d.username, answerIndex: d.answerIndex } }));
        break;
      }
      case 'TEAM_CHAT': {
        const d = msg.data;
        setTeamChat(prev => [...prev.slice(-49), { senderId: d.senderId, sender: d.sender, text: d.text }]);
        break;
      }
      case 'ROUND_END': {
        if (msg.data.teamAnswers) setTeamAnswers(msg.data.teamAnswers);
        break;
      }
      case 'TEAM_ASSIGNMENT': {
        const me = msg.data.players.find(p => p.userId === myUserId);
        if (me) setMyTeam(me.team);
        break;
      }
      case 'TEAM_SCORE_UPDATE': {
        setTeamScoreA(msg.data.scoreA);
        setTeamScoreB(msg.data.scoreB);
        break;
      }
      case 'PERFECT_ROUND': {
        setPerfectA(msg.data.teamAPerfect);
        setPerfectB(msg.data.teamBPerfect);
        break;
      }
    }
  };

  /** Team slice of the TvT QUIZ_END payload (core results are handled by the
   *  shell). Only ever fires the TeamWinScreen when the page is in TvT mode. */
  const applyQuizEnd = (summary: QuizEndSummary) => {
    setTeamWinner(summary.teamWinner ?? null);
    setTeamWinScoreA(summary.scoreA ?? 0);
    setTeamWinScoreB(summary.scoreB ?? 0);
  };

  const state: TeamVsTeamState = {
    myTeam, teamScoreA, teamScoreB, perfectA, perfectB,
    teamWinner, teamWinScoreA, teamWinScoreB,
    teamVotes, teamChat, teamAnswers,
  };
  return { state, handleEvent, applyQuizEnd };
}
