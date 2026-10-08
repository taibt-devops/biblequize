import { useEffect, useState } from 'react';
import { api } from '../../api/client';

interface Props {
  questionId: string;
  scriptureRef?: string;
  explanation: string;
  onContinue: () => void;
}

/**
 * Sprint 2 S2-6 — slide-up panel shown after a wrong answer in
 * multiplayer. Mirrors the Quiz.tsx bookmark interaction so the same
 * "Đánh dấu ôn lại" REST call is reused across solo and multiplayer.
 *
 * The panel is informational only — it does NOT gate the next question.
 * Server timing drives that. We render an auto-dismiss progress bar so
 * users see roughly when the next question is coming.
 */
export function ExplanationPanel({ questionId, scriptureRef, explanation, onContinue }: Props) {
  const [bookmarked, setBookmarked] = useState(false);
  const [progress, setProgress] = useState(0);

  // 4-second visual dismiss bar. The actual dismissal happens when the
  // next QUESTION_START fires; this is a hint, not a hard timer.
  useEffect(() => {
    const start = Date.now();
    const dur = 4000;
    const t = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - start) / dur) * 100);
      setProgress(pct);
      if (pct >= 100) clearInterval(t);
    }, 100);
    return () => clearInterval(t);
  }, []);

  const onBookmark = () => {
    if (bookmarked) return;
    // Fire-and-forget — match the Quiz.tsx pattern (line 983).
    try { api.post('/api/me/bookmarks', { questionId }); } catch { /* ignore */ }
    setBookmarked(true);
  };

  return (
    <div
      data-testid="explanation-panel"
      className="rounded-2xl p-5 mt-4"
      style={{
        background: 'rgba(50,52,64,0.78)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(232,168,50,0.3)',
        animation: 'slideUp 0.4s cubic-bezier(0.34,1.56,0.64,1)',
      }}
    >
      <div className="flex items-start gap-4">
        <div
          className="w-12 h-12 rounded-xl grid place-items-center flex-shrink-0"
          style={{ background: 'rgba(232,168,50,0.15)' }}
          aria-hidden="true"
        >
          <span className="text-2xl">💡</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-[12.5px] font-bold" style={{ color: '#e8a832' }}>
              Giải thích{scriptureRef ? ` · ${scriptureRef}` : ''}
            </span>
            <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.05)' }} />
          </div>
          <p className="text-sm leading-relaxed mb-3" style={{ color: '#d1d5db' }}>
            {explanation}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onBookmark}
              disabled={bookmarked}
              data-testid="explanation-bookmark"
              className="px-4 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-2 disabled:opacity-60"
              style={{
                background: 'rgba(50,52,64,0.55)',
                color: '#fbbf24',
                border: '1px solid rgba(232,168,50,0.3)',
              }}
            >
              <span className="material-symbols-outlined text-sm">
                {bookmarked ? 'bookmark_added' : 'bookmark_add'}
              </span>
              {bookmarked ? 'Đã đánh dấu' : 'Đánh dấu ôn lại'}
            </button>
            <button
              type="button"
              onClick={onContinue}
              data-testid="explanation-continue"
              className="px-4 py-2 rounded-lg text-xs font-bold"
              style={{
                background: 'linear-gradient(135deg, #e8a832 0%, #d97706 100%)',
                color: '#1D2B22',
              }}
            >
              Tiếp tục →
            </button>
            <div className="ml-auto flex items-center gap-2 text-[10px]" style={{ color: '#6b7280' }}>
              <div
                className="w-20 h-1 rounded-full overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.05)' }}
              >
                <div
                  className="h-full"
                  style={{ background: '#e8a832', width: `${progress}%`, transition: 'width 100ms linear' }}
                />
              </div>
              <span>Tự đóng</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ExplanationPanel;
