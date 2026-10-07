import React from 'react';
import { useTranslation } from 'react-i18next';
import { ANSWER_LETTERS, FILL_STYLE } from '../roomQuizCore';
import type { RoomQuestion } from '../../../types/room';
import type { SequentialModeState } from '../hooks/useSequentialMode';

/**
 * FMR-4 — Group Live Sequential (Feature A) mode fragments.
 * Default export renders the sequential top-bar + centered question box
 * (replaces the default question card); named exports cover the waiting
 * strip and the reveal panel. Mode gating stays with the shell so render
 * conditions match the pre-split page 1:1.
 */
const SequentialView: React.FC<{
  questionIndex: number;
  totalQuestions: number;
  playingCount: number;
  timerPercent: number;
  timeLeft: number;
  question: RoomQuestion | null;
}> = ({ questionIndex, totalQuestions, playingCount, timerPercent, timeLeft, question }) => {
  const { t } = useTranslation();
  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1">
          <div className="text-[10px] font-bold uppercase tracking-[1px]" style={{ color: 'var(--bq-emerald)' }}>
            CÂU {questionIndex + 1} / {totalQuestions || '?'}
          </div>
          <div className="text-[12px] text-bq-ink2 font-semibold mt-0.5">
            {playingCount > 0
              ? `${playingCount}/${playingCount} đang chơi`
              : t('room.quiz.waitingQuestion')}
          </div>
        </div>
        <div className="relative w-[38px] h-[38px] flex-shrink-0">
          <svg viewBox="0 0 38 38" className="w-full h-full -rotate-90">
            <circle cx="19" cy="19" r="16" fill="none" stroke="var(--bq-hairline)" strokeWidth="4" />
            <circle cx="19" cy="19" r="16" fill="none" stroke="var(--bq-amber-deep)" strokeWidth="4" strokeLinecap="round"
              strokeDasharray="113" strokeDashoffset={113 * (1 - timerPercent / 100)} />
          </svg>
          <div className="absolute inset-0 grid place-items-center text-[12px] font-extrabold tabular-nums" style={{ color: 'var(--bq-amber-deep)' }}>
            {timeLeft}
          </div>
        </div>
      </div>
      {/* Emerald progress bar */}
      <div className="h-1 rounded-full overflow-hidden mb-5" style={{ background: 'var(--bq-paper-sunk)' }}>
        <div className="h-full rounded-full" style={{
          width: `${totalQuestions > 0 ? ((questionIndex + 1) / totalQuestions) * 100 : 0}%`,
          background: 'linear-gradient(90deg, var(--bq-emerald) 0%, var(--bq-emerald-lt) 100%)',
        }} />
      </div>
      {/* Question box centered (mockup style) */}
      <div className="rounded-xl px-4 py-5 mb-4 text-center bg-bq-white border border-bq-hair shadow-bq-soft">
        <div className="text-[16px] md:text-[18px] font-semibold leading-snug text-bq-ink">
          {question?.content || t('room.quiz.waitingQuestion')}
        </div>
      </div>
    </>
  );
};

/** Waiting strip — shown after the player submits, before the reveal. */
export const SequentialWaitingStrip: React.FC<{ seq: SequentialModeState }> = ({ seq }) => {
  const { t } = useTranslation();
  return (
    <div
      data-testid="sequential-waiting-strip"
      className="rounded-xl px-4 py-3.5 flex items-center gap-3 bg-bq-white border border-bq-hair shadow-bq-soft"
    >
      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: 'color-mix(in srgb, var(--bq-emerald) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--bq-emerald) 30%, transparent)' }}
      >
        <span className="material-symbols-outlined text-[18px] animate-pulse" style={{ color: 'var(--bq-emerald)' }}>
          hourglass_empty
        </span>
      </div>
      <div className="flex-1 text-bq-ink text-[12px] font-medium leading-snug">
        <strong style={{ color: 'var(--bq-emerald)' }}>
          {t('room.quiz.sequentialWaiting', { remaining: Math.max(0, seq.seqTotal - seq.seqAnswered) })}
        </strong>
        {' '}{t('room.quiz.sequentialWaitingDesc')}
        <div className="flex gap-1 mt-1.5">
          {Array.from({ length: seq.seqTotal }).map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full"
              style={{
                background: i < seq.seqAnswered
                  ? 'linear-gradient(135deg, var(--bq-emerald-lt) 0%, var(--bq-emerald) 100%)'
                  : 'var(--bq-paper-sunk)',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

/** Reveal panel — correct answer, explanation, per-player answers and the
 *  leader advance button (or member waiting hint). */
export const SequentialRevealPanel: React.FC<{
  revealedData: NonNullable<SequentialModeState['revealedData']>;
  isHost: boolean;
  onAdvance: () => void;
}> = ({ revealedData, isHost, onAdvance }) => {
  const { t } = useTranslation();
  return (
    <div
      data-testid="sequential-reveal-panel"
      className="rounded-xl p-4 space-y-3 bg-bq-white border border-bq-hair shadow-bq-soft"
    >
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[20px] text-bq-amberd" style={FILL_STYLE}>
          check_circle
        </span>
        <span className="text-bq-ink font-bold text-[14px]">
          {t('room.quiz.sequentialAnswerIs', { letter: ANSWER_LETTERS[revealedData.correctIndex] })}
        </span>
      </div>
      {revealedData.explanation && (
        <p className="text-bq-ink2 text-[12px] leading-relaxed">
          {revealedData.explanation}
        </p>
      )}
      {/* Per-player answers */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-bq-hair">
        {revealedData.answers.map(a => (
          <div
            key={a.userId}
            className={`px-2 py-1.5 rounded-md text-[11px] flex items-center justify-between gap-1 ${
              a.isCorrect
                ? 'bg-bq-emerald/10 border border-bq-emerald/20'
                : a.answerIndex === null
                  ? 'bg-bq-inset border border-bq-hair'
                  : 'bg-bq-ruby/10 border border-bq-ruby/20'
            }`}
          >
            <span className="truncate text-bq-ink font-medium">{a.username}</span>
            <span className={`flex-shrink-0 font-bold ${a.isCorrect ? 'text-bq-emerald' : a.answerIndex === null ? 'text-bq-ink3' : 'text-bq-ruby'}`}>
              {a.answerIndex === null ? '—' : ANSWER_LETTERS[a.answerIndex]}
            </span>
          </div>
        ))}
      </div>
      {/* Leader advance button or member waiting hint.
          The reveal panel only renders after BE has decided the round
          is over (all-answered OR question timeout), so the host can
          always advance from here — no need to gate on seqAnswered. */}
      <div className="pt-2 border-t border-bq-hair">
        {isHost ? (
          <button
            data-testid="sequential-advance-btn"
            onClick={onAdvance}
            className="w-full py-3 rounded-xl text-[14px] font-bold flex items-center justify-center gap-2 transition-all hover:brightness-110 bg-bq-action text-bq-ink shadow-bq-action"
          >
            {t('room.quiz.sequentialAdvance')}
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        ) : (
          <div className="text-center text-bq-ink2 text-[12px] py-2 flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-[14px] animate-pulse">hourglass_empty</span>
            {t('room.quiz.sequentialWaitingForLeader')}
          </div>
        )}
      </div>
    </div>
  );
};

export default SequentialView;
