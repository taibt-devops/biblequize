import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface ActionCardProps {
  icon: string;
  label: string;
  hint: string;
  onClick?: () => void;
  highlight?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  testId?: string;
}

function ActionCard({ icon, label, hint, onClick, highlight, disabled, disabledReason, testId }: ActionCardProps) {
  const base = 'rounded-xl p-3 border text-left transition-all flex flex-col gap-1 min-h-[88px]';
  // GD-FIX-9: primary "Bắt đầu Live" action wears the emerald accent;
  // neutral cards stay light with subtle borders. Emerald hint text
  // when highlight reinforces the primary affordance.
  const enabled = highlight
    ? 'bg-bq-emerald/[0.06] border-bq-emerald/35 hover:bg-bq-emerald/10 hover:border-bq-emerald/55 hover:-translate-y-0.5 shadow-bq-eme'
    : 'bg-bq-white border-bq-hair shadow-bq-soft hover:border-bq-ink3/40 hover:-translate-y-0.5';
  const off = 'bg-bq-inset border-bq-hair cursor-not-allowed opacity-50';
  return (
    <button
      data-testid={testId}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={disabled && disabledReason ? disabledReason : undefined}
      aria-disabled={disabled || undefined}
      className={`${base} ${disabled ? off : enabled}`}
    >
      <span className="text-lg">{icon}</span>
      <span className="text-[12px] font-bold text-bq-ink leading-tight">{label}</span>
      <span
        className={`text-[10px] leading-snug ${
          highlight && !disabled ? 'text-bq-emerald font-semibold' : 'text-bq-ink2'
        }`}
      >
        {disabled && disabledReason ? disabledReason : hint}
      </span>
    </button>
  );
}

export interface QuickActionsPanelProps {
  groupId: string;
  memberCount: number;
  quizSetsCount: number;
  isLeader: boolean;
  hasActiveScheduledQuiz: boolean;
  scheduledCount: number;
  /** ID of the earliest active scheduled quiz — used to deep-link members to its detail. */
  firstScheduledQuizId?: string | null;
  onCreateQuizSet: () => void;
  onPostAnnouncement: () => void;
  onSwitchToQuizSets: () => void;
}

export default function QuickActionsPanel(props: QuickActionsPanelProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const heading = (
    <h2 className="text-[12.5px] font-bold text-bq-amberd mb-3">
      ⚡ {t('groups.quickActions.title')}
    </h2>
  );

  if (props.isLeader) {
    const tournamentNeedsMembers = props.memberCount < 4;
    return (
      <section data-testid="group-quick-actions-leader">
        {heading}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <ActionCard
            icon="📚"
            label={t('groups.action.createQuizSet')}
            hint={t('groups.action.createQuizSet.hint')}
            onClick={props.onCreateQuizSet}
            testId="qa-create-quizset"
          />
          {/* BL-25 D4: live co-play demoted to a secondary shortcut — the
              Journey hero (JourneyHeroCard) now owns the spotlight, so this
              card drops its emerald `highlight`. */}
          <ActionCard
            icon="🎮"
            label={t('groups.action.startLive')}
            hint={t('groups.action.startLive.hint')}
            onClick={props.onSwitchToQuizSets}
            testId="qa-start-live"
          />
          <ActionCard
            icon="🏆"
            label={t('groups.action.tournament')}
            hint={t('groups.action.tournament.hint')}
            disabled={tournamentNeedsMembers}
            disabledReason={t('groups.action.tournament.needMembers', { current: props.memberCount, min: 4 })}
            onClick={() => navigate(`/tournaments?groupId=${props.groupId}`)}
            testId="qa-tournament"
          />
          <ActionCard
            icon="📢"
            label={t('groups.action.announce')}
            hint={t('groups.action.announce.hint', { count: props.memberCount })}
            onClick={props.onPostAnnouncement}
            testId="qa-announce"
          />
        </div>
      </section>
    );
  }

  // Members can no longer self-practice (solo mode removed 2026-05-20).
  // Scheduled-quiz card is the only remaining member quick action; hide the
  // section entirely when nothing's available so the layout stays tidy.
  if (!props.hasActiveScheduledQuiz) return null;
  return (
    <section data-testid="group-quick-actions-member">
      {heading}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ActionCard
          icon="📅"
          label={t('groups.action.scheduledQuiz')}
          hint={t('groups.action.scheduledQuiz.hint', { count: props.scheduledCount })}
          highlight
          onClick={() => {
            // Deep-link to the first active scheduled quiz; fall back to the
            // group page if the id wasn't passed (defensive — should always
            // be present when hasActiveScheduledQuiz is true).
            if (props.firstScheduledQuizId) {
              navigate(`/groups/${props.groupId}/scheduled-quizzes/${props.firstScheduledQuizId}`)
            } else {
              navigate(`/groups/${props.groupId}`)
            }
          }}
          testId="qa-scheduled"
        />
      </div>
    </section>
  );
}
