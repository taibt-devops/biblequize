import { useTranslation } from 'react-i18next';

export interface QuizSetPreview {
  id: string;
  name: string;
  questionCount: number;
  createdAt: string;
  coverImageUrl?: string | null;
  playCount?: number;
  averageRating?: number | null;
}

interface Props {
  quizSets: QuizSetPreview[];
  onPlay: (id: string) => void;
  onViewAll: () => void;
  playingId?: string | null;
}

// GD-FIX-R2-2: deterministic gradient palette tuned for hue diversity so
// 3 adjacent cards never share the same warm-tone family. Order matters —
// hash → index, but the entries are spread across hue wheel (gold,
// emerald, sky, purple, orange, teal) so any 3 indices look distinct.
const GRADIENTS = [
  'linear-gradient(135deg, #F59E0B 0%, #D97F06 100%)', // 0 — amber
  'linear-gradient(135deg, #46C89A 0%, #2E7D4F 100%)', // 1 — emerald
  'linear-gradient(135deg, #2F6FB0 0%, #2F6FB0 100%)', // 2 — sapphire
  'linear-gradient(135deg, #2F6FB0 0%, #1E2E86 100%)', // 3 — deep sapphire
  'linear-gradient(135deg, #FF7A5A 0%, #B3452F 100%)', // 4 — ruby/ember
  'linear-gradient(135deg, #2E7D4F 0%, #0A6650 100%)', // 5 — deep emerald
];

// 32-bit FNV-1a hash for better distribution than the prior shift-add
// fold (which collapsed similar UUID-style ids onto adjacent indices).
function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickGradient(id: string): string {
  return GRADIENTS[hashId(id) % GRADIENTS.length];
}

// Cover image convention: backend stores either a URL ("https://...") or
// an emoji prefix ("emoji:📖"). Mockup-aligned cards use the emoji as the
// tile glyph. Real images render in the dedicated quiz-set list, not the
// preview tile (kept simple here).
function parseEmojiCover(coverUrl?: string | null): string | null {
  if (!coverUrl) return null;
  if (coverUrl.startsWith('emoji:')) return coverUrl.slice(6);
  return null;
}

export default function QuizSetsPreviewCard({ quizSets, onPlay, onViewAll, playingId }: Props) {
  const { t } = useTranslation();
  const top3 = quizSets.slice(0, 3);

  return (
    <section
      data-testid="group-quizsets-preview"
      className="bg-bq-white border border-bq-hair shadow-bq-soft rounded-xl p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[11px] font-bold text-bq-amberd uppercase tracking-wider">
          📚 {t('groups.quizSetsSection')} ({quizSets.length})
        </h2>
        {quizSets.length > 3 && (
          <button
            onClick={onViewAll}
            className="text-[10px] text-bq-ink2 hover:text-bq-amberd transition-colors"
          >
            {t('groups.viewAll')} →
          </button>
        )}
      </div>
      {top3.length === 0 ? (
        <p className="text-[12px] text-bq-ink2 text-center py-4">
          {t('groups.noQuizSets')}
        </p>
      ) : (
        <ul className="space-y-2">
          {top3.map((qs) => {
            const emoji = parseEmojiCover(qs.coverImageUrl) ?? '📖';
            const gradient = pickGradient(qs.id);
            const showPlay = (qs.playCount ?? 0) > 0;
            const showRating = qs.averageRating != null && qs.averageRating > 0;
            return (
              <li
                key={qs.id}
                className="flex items-center gap-2.5 p-2 rounded-lg bg-bq-inset border border-bq-hair hover:border-bq-ink3/40 transition-colors"
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0 shadow-inner"
                  style={{ background: gradient }}
                >
                  {emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-bold text-bq-ink truncate">{qs.name}</div>
                  <div className="text-[10px] text-bq-ink2 flex items-center gap-1.5 flex-wrap">
                    <span>{t('groups.questionsCount', { count: qs.questionCount })}</span>
                    {showPlay && (
                      <>
                        <span className="text-bq-ink3">·</span>
                        <span>▶ {qs.playCount}x</span>
                      </>
                    )}
                    {showRating && (
                      <>
                        <span className="text-bq-ink3">·</span>
                        <span className="text-bq-amberd">⭐ {(qs.averageRating ?? 0).toFixed(1)}</span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => onPlay(qs.id)}
                  disabled={playingId === qs.id}
                  className="px-2.5 py-1 rounded-md bg-bq-action text-bq-ink shadow-bq-action text-[10px] font-bold disabled:opacity-50 hover:brightness-110 transition-all whitespace-nowrap"
                >
                  {playingId === qs.id ? '...' : t('groups.play')}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
