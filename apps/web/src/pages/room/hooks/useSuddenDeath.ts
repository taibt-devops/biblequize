import { useState } from 'react';
import type { RoomEvent } from '../../../types/room';

export interface SuddenDeathState {
  sdChampionName: string;
  sdChampionId: string;
  sdChampionStreak: number;
  sdChallengerName: string;
  sdChallengerId: string;
  sdQueueRemaining: number;
  sdMatchResult: { winnerId: string; winnerName: string; loserId: string; loserName: string } | null;
  sdSpectating: boolean;
  sdMyUserId: string;
  /** PCV-16: khán giả đoán người thắng trận đang chuẩn bị đấu. */
  sdMatchNo: number;
  predictionOpen: boolean;
  myPick: string | null;
  /** null = chưa có kết quả cho trận hiện tại. */
  lastPredictionCorrect: boolean | null;
  myPredictionPoints: number;
}

/**
 * FMR-3 — Sudden Death (Đấu vương) mode state + event handling.
 * Owns the champion/challenger arena state, queue counter and match result
 * overlay. In-match detection is by ID (championName/challengerName are
 * display names and can collide).
 */
export function useSuddenDeath(myUserId: string) {
  const [sdChampionName, setSdChampionName] = useState('');
  const [sdChampionId, setSdChampionId] = useState('');
  const [sdChampionStreak, setSdChampionStreak] = useState(0);
  const [sdChallengerName, setSdChallengerName] = useState('');
  const [sdChallengerId, setSdChallengerId] = useState('');
  const [sdQueueRemaining, setSdQueueRemaining] = useState(0);
  const [sdMatchResult, setSdMatchResult] = useState<SuddenDeathState['sdMatchResult']>(null);
  const [sdSpectating, setSdSpectating] = useState(false);
  // Kept for MatchResultOverlay parity with the pre-split page (it was never
  // written there either — overlay falls back to name-agnostic copy).
  const [sdMyUserId] = useState('');
  const [sdMatchNo, setSdMatchNo] = useState(0);
  const [predictionOpen, setPredictionOpen] = useState(false);
  const [myPick, setMyPick] = useState<string | null>(null);
  const [lastPredictionCorrect, setLastPredictionCorrect] = useState<boolean | null>(null);
  const [myPredictionPoints, setMyPredictionPoints] = useState(0);

  const handleEvent = (msg: RoomEvent) => {
    switch (msg.type) {
      case 'MATCH_START': {
        const d = msg.data;
        setSdChampionId(d.championId);
        setSdChampionName(d.championName);
        setSdChampionStreak(d.championStreak);
        setSdChallengerId(d.challengerId);
        setSdChallengerName(d.challengerName);
        setSdQueueRemaining(d.queueRemaining);
        setSdMatchResult(null);
        // Identity by ID — championName/challengerName là display names có thể collision.
        const inMatch = d.championId === myUserId || d.challengerId === myUserId;
        setSdSpectating(!inMatch);
        // PCV-16: mỗi trận một lượt đoán cho khán giả, khóa khi câu đầu của trận bắt đầu.
        setSdMatchNo(d.matchNo ?? 0);
        setPredictionOpen(!inMatch && (d.matchNo ?? 0) > 0);
        setMyPick(null);
        setLastPredictionCorrect(null);
        break;
      }
      case 'QUESTION_START': {
        setPredictionOpen(false);
        break;
      }
      case 'PREDICTION_RESULT': {
        const d = msg.data;
        if (d.matchNo !== sdMatchNo || myPick === null) break;
        const right = d.correctUserIds.includes(myUserId);
        setLastPredictionCorrect(right);
        if (right) setMyPredictionPoints(n => n + 1);
        break;
      }
      case 'MATCH_END': {
        const d = msg.data;
        setSdMatchResult({ winnerId: d.winnerId, winnerName: d.winnerName, loserId: d.loserId, loserName: d.loserName });
        if (d.winnerName === sdChampionName || d.winnerName === sdChallengerName) {
          setSdChampionStreak(d.winnerNewStreak);
        }
        break;
      }
    }
  };

  const dismissMatchResult = () => setSdMatchResult(null);
  /** PCV-16: ghi lựa chọn đoán (trang gửi lên máy chủ). */
  const choosePrediction = (userId: string) => { if (predictionOpen) setMyPick(userId); };

  const state: SuddenDeathState = {
    sdChampionName, sdChampionId, sdChampionStreak,
    sdChallengerName, sdChallengerId, sdQueueRemaining,
    sdMatchResult, sdSpectating, sdMyUserId,
    sdMatchNo, predictionOpen, myPick, lastPredictionCorrect, myPredictionPoints,
  };
  return { state, handleEvent, dismissMatchResult, choosePrediction };
}
