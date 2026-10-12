import { useRef, useState } from 'react';
import type { RoomEvent } from '../../../types/room';

/** PCV-13: thông báo bị loại (out) hoặc hồi sinh (revived). */
export type EliminationToast = { id: number; username: string; rank: number; kind: 'out' | 'revived' };

export interface BattleRoyaleState {
  activeCount: number;
  totalCount: number;
  isEliminated: boolean;
  myRank: number | null;
  showEliminationScreen: boolean;
  isSpectator: boolean;
  toasts: EliminationToast[];
}

/**
 * FMR-3 — Battle Royale mode state + event handling.
 * Owns elimination tracking (toasts, my-elimination screen, spectator flip)
 * and the active/total player counters.
 */
export function useBattleRoyale(myUserId: string) {
  const [activeCount, setActiveCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [isEliminated, setIsEliminated] = useState(false);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [showEliminationScreen, setShowEliminationScreen] = useState(false);
  const [isSpectator, setIsSpectator] = useState(false);
  const [toasts, setToasts] = useState<EliminationToast[]>([]);
  const toastCounter = useRef(0);

  const addToast = (username: string, rank: number, kind: EliminationToast['kind'] = 'out') => {
    const id = ++toastCounter.current;
    setToasts(prev => [...prev, { id, username, rank, kind }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  };

  const handleEvent = (msg: RoomEvent) => {
    switch (msg.type) {
      case 'PLAYER_ELIMINATED': {
        const d = msg.data;
        addToast(d.username, d.rank);
        setActiveCount(d.activeRemaining);
        // Identity check by userId (NOT username) — display names can
        // collide hoặc lệch localStorage.userName, khiến eliminated
        // player KHÔNG thấy màn "Bạn bị loại" → tưởng vẫn chơi
        // (bug 2026-05-23 user report). userId là server-side stable.
        if (d.userId === myUserId) {
          setIsEliminated(true);
          setMyRank(d.rank);
          setShowEliminationScreen(true);
        }
        break;
      }
      case 'PLAYER_REVIVED': {
        // PCV-13: bóng đúng 3 câu liên tiếp ở câu 1–9 → trở lại cuộc chơi với 1 mạng.
        const d = msg.data;
        addToast(d.username, 0, 'revived');
        setActiveCount(d.activeRemaining);
        if (d.userId === myUserId) {
          setIsEliminated(false);
          setIsSpectator(false);
          setShowEliminationScreen(false);
          setMyRank(null);
        }
        break;
      }
      case 'BATTLE_ROYALE_UPDATE': {
        const d = msg.data;
        setActiveCount(d.activeCount);
        setTotalCount(d.totalCount);
        break;
      }
    }
  };

  /** "Xem tiếp" from the elimination screen → spectator mode. */
  const spectate = () => {
    setShowEliminationScreen(false);
    setIsSpectator(true);
  };

  const state: BattleRoyaleState = {
    activeCount, totalCount, isEliminated, myRank,
    showEliminationScreen, isSpectator, toasts,
  };
  return { state, handleEvent, spectate };
}
