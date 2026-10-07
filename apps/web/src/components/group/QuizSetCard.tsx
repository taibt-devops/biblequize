import { useTranslation } from 'react-i18next';

// Backend quiz-set fields surfaced on the desktop list card. Mirrors
// MOCKUP_QUIZ_SET_V2_PROFESSIONAL_DESKTOP.html .quiz-card layout.
export interface QuizSetCardData {
  id: string;
  name: string;
  questionCount: number;
  createdAt: string;
  coverImageUrl?: string | null;
  coverScripture?: string | null;
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD' | string | null;
  estimatedDurationMin?: number | null;
  suggestedMode?: string | null;
  playCount?: number;
  averageRating?: number | null;
  totalRatings?: number | null;
  publishStatus?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'SOFT_DELETED' | string | null;
  inUseByScheduled?: boolean;
}

interface Props {
  quizSet: QuizSetCardData;
  onClick: () => void;
}

// 6-color gradient palette, hashed by id (FNV-1a) so adjacent cards never
// share a tone. Matches QuizSetsPreviewCard palette so list ↔ preview tile
// pairs stay visually consistent for the same set.
const HERO_GRADIENTS = [
  'linear-gradient(135deg, #F59E0B 0%, #D97F06 50%, #B36405 100%)', // amber (default per mockup hero)
  'linear-gradient(135deg, #46C89A 0%, #2E7D4F 100%)',              // emerald
  'linear-gradient(135deg, #2F6FB0 0%, #2F6FB0 100%)',              // sapphire
  'linear-gradient(135deg, #2F6FB0 0%, #1E2E86 100%)',              // deep sapphire
  'linear-gradient(135deg, #FF7A5A 0%, #B3452F 100%)',              // ruby/ember
  'linear-gradient(135deg, #2E7D4F 0%, #0A6650 100%)',              // deep emerald
];

function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickGradient(id: string): string {
  return HERO_GRADIENTS[hashId(id) % HERO_GRADIENTS.length];
}

function parseEmojiCover(coverUrl?: string | null): string | null {
  if (!coverUrl) return null;
  if (coverUrl.startsWith('emoji:')) return coverUrl.slice(6);
  return null;
}

const MODE_BADGE: Record<string, { label: string; bg: string; border: string; color: string }> = {
  SPEED_RACE:            { label: '⚡', bg: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.03))', border: 'rgba(245,158,11,0.3)', color: '#D97F06' },
  GROUP_LIVE_SEQUENTIAL: { label: '📚', bg: 'linear-gradient(135deg, rgba(46,125,79,0.15), rgba(46,125,79,0.03))', border: 'rgba(46,125,79,0.3)', color: '#2E7D4F' },
  SEQUENTIAL:            { label: '📚', bg: 'linear-gradient(135deg, rgba(46,125,79,0.15), rgba(46,125,79,0.03))', border: 'rgba(46,125,79,0.3)', color: '#2E7D4F' },
  TEAM_VS_TEAM:          { label: '⚔️', bg: 'linear-gradient(135deg, rgba(47,111,176,0.15), rgba(47,111,176,0.03))', border: 'rgba(47,111,176,0.3)', color: '#2F6FB0' },
  BATTLE_ROYALE:         { label: '💀', bg: 'linear-gradient(135deg, rgba(47,111,176,0.15), rgba(47,111,176,0.03))', border: 'rgba(47,111,176,0.3)', color: '#2F6FB0' },
  SUDDEN_DEATH:          { label: '🥊', bg: 'linear-gradient(135deg, rgba(179,69,47,0.15), rgba(179,69,47,0.03))', border: 'rgba(179,69,47,0.3)', color: '#B3452F' },
};

export default function QuizSetCard({ quizSet, onClick }: Props) {
  const { t } = useTranslation();
  const emoji = parseEmojiCover(quizSet.coverImageUrl) ?? '📖';
  const gradient = pickGradient(quizSet.id);
  const isDraft = quizSet.publishStatus === 'DRAFT';
  const showRating = quizSet.averageRating != null && (quizSet.averageRating ?? 0) > 0;
  const showPlay = quizSet.playCount != null && quizSet.playCount > 0;
  const suggestedKey = (quizSet.suggestedMode ?? '').toUpperCase();
  const suggested = MODE_BADGE[suggestedKey];

  const difficultyMeta: { label: string; color: string } | null = (() => {
    switch ((quizSet.difficulty ?? '').toUpperCase()) {
      case 'EASY':   return { label: t('groups.quizCard.difficultyEasy'), color: '#2E7D4F' };
      case 'MEDIUM': return { label: '⚡ ' + t('groups.quizCard.difficultyMedium'), color: '#D97F06' };
      case 'HARD':   return { label: '🔥 ' + t('groups.quizCard.difficultyHard'), color: '#B3452F' };
      default: return null;
    }
  })();

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={`quiz-set-card-${quizSet.id}`}
      className="text-left rounded-xl overflow-hidden border border-bq-hair bg-bq-white shadow-bq-soft hover:-translate-y-0.5 hover:border-bq-ink3/40 transition-all"
    >
      {/* Hero */}
      <div className="h-28 relative" style={{ background: gradient }}>
        <div className="absolute inset-0 flex items-center justify-center text-5xl opacity-40 select-none">
          {emoji}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        <div className="absolute top-2 left-2">
          {isDraft ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/85 text-bq-ink2 border border-bq-hair">
              {t('groups.quizCard.statusDraft')}
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-bq-emerald/20 text-white border border-bq-emerald/40">
              ✓ {t('groups.quizCard.statusPublished')}
            </span>
          )}
        </div>
        {(showRating || showPlay) && (
          <div className="absolute top-2 right-2 flex gap-1">
            {showRating && (
              <span className="px-1.5 py-0.5 rounded bg-black/40 backdrop-blur text-bq-amber text-[10px] font-bold">
                ⭐ {(quizSet.averageRating ?? 0).toFixed(1)}
              </span>
            )}
            {showPlay && (
              <span className="px-1.5 py-0.5 rounded bg-black/40 backdrop-blur text-white text-[10px] font-bold">
                ▶ {quizSet.playCount}x
              </span>
            )}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-3">
        <h3 className="font-extrabold text-bq-ink text-sm leading-tight line-clamp-2">{quizSet.name}</h3>
        {quizSet.coverScripture && (
          <div className="text-[10px] text-bq-ink2 mt-1 line-clamp-1">📍 {quizSet.coverScripture}</div>
        )}
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <span className="text-[10px] text-bq-ink2">
            {t('groups.questionsCount', { count: quizSet.questionCount })}
          </span>
          {difficultyMeta && (
            <>
              <span className="text-[10px] text-bq-ink3">·</span>
              <span className="text-[10px] font-semibold" style={{ color: difficultyMeta.color }}>
                {difficultyMeta.label}
              </span>
            </>
          )}
          {quizSet.estimatedDurationMin != null && quizSet.estimatedDurationMin > 0 && (
            <>
              <span className="text-[10px] text-bq-ink3">·</span>
              <span className="text-[10px] text-bq-ink2">
                {t('groups.quizCard.duration', { min: quizSet.estimatedDurationMin })}
              </span>
            </>
          )}
        </div>
        {(suggested || quizSet.inUseByScheduled) && (
          <div className="flex gap-1 mt-2 flex-wrap">
            {suggested && (
              <span
                className="text-[9px] px-1.5 py-0.5 rounded font-semibold"
                style={{ background: suggested.bg, border: `1px solid ${suggested.border}`, color: suggested.color }}
                title={suggestedKey}
              >
                {suggested.label}
              </span>
            )}
            {quizSet.inUseByScheduled && (
              <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold border border-bq-sapphire/40 bg-bq-sapphire/15 text-bq-sapphire">
                📅 {t('groups.quizCard.inUseScheduled')}
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
