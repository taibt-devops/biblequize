import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  groupId: string;
  groupCreatedAt?: string;
  memberCount: number;
  quizSetsCount: number;
  announcementsCount: number;
  isLeader: boolean;
  onInvite: () => void;
  onCreateQuizSet: () => void;
  onPostAnnouncement: () => void;
}

function isNewGroup(createdAt?: string): boolean {
  if (!createdAt) return true;
  const days = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
  return days < 7;
}

export default function NewGroupOnboarding(props: Props) {
  const { t } = useTranslation();
  const dismissKey = `bq_onboarding_dismissed_${props.groupId}`;
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try { return localStorage.getItem(dismissKey) === '1'; } catch { return false; }
  });

  const isNew = isNewGroup(props.groupCreatedAt);
  const isSmall = props.memberCount < 5;
  const showBanner = props.isLeader && (isNew || isSmall) && !dismissed;
  if (!showBanner) return null;

  const tasks = [
    {
      icon: '👥',
      iconBg: 'rgba(47,111,176,0.16)',
      label: t('groups.onboarding.task1'),
      done: props.memberCount >= 5,
      action: props.onInvite,
    },
    {
      icon: '📚',
      iconBg: 'rgba(46,125,79,0.16)',
      label: t('groups.onboarding.task2'),
      done: props.quizSetsCount > 0,
      action: props.onCreateQuizSet,
    },
    {
      icon: '📢',
      iconBg: 'rgba(245,158,11,0.18)',
      label: t('groups.onboarding.task3'),
      done: props.announcementsCount > 0,
      action: props.onPostAnnouncement,
    },
  ];
  const completed = tasks.filter((task) => task.done).length;

  const handleDismiss = () => {
    try { localStorage.setItem(dismissKey, '1'); } catch { /* ignore */ }
    setDismissed(true);
  };

  return (
    <div
      data-testid="group-onboarding-banner"
      className="rounded-2xl p-4 sm:p-5 border border-bq-amber/35 mb-1"
      style={{ background: 'rgba(245,158,11,0.08)' }}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="text-[12.5px] font-bold text-bq-amberd mb-1">
            👋 {t('groups.onboarding.title')}
          </div>
          <div className="text-[13px] text-bq-ink">
            {t('groups.onboarding.subtitle', { completed, total: tasks.length })}
          </div>
        </div>
        <button
          onClick={handleDismiss}
          aria-label={t('common.close')}
          className="text-bq-ink3 hover:text-bq-ink w-7 h-7 rounded-md hover:bg-bq-inset flex items-center justify-center text-[18px] leading-none"
        >
          ×
        </button>
      </div>

      <ul className="space-y-2">
        {tasks.map((task, idx) => (
          <li key={idx}>
            <button
              type="button"
              onClick={task.done ? undefined : task.action}
              disabled={task.done}
              data-testid={`onboarding-task-${idx}`}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                task.done
                  ? 'border-bq-emerald/30 cursor-default'
                  : 'border-bq-hair hover:border-bq-amber/40 hover:bg-bq-inset'
              }`}
              style={task.done ? { background: 'rgba(46,125,79,0.06)' } : undefined}
            >
              <span
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[16px] shrink-0"
                style={{ background: task.done ? 'rgba(46,125,79,0.18)' : task.iconBg }}
              >
                {task.done ? '✅' : task.icon}
              </span>
              <span className={`flex-1 text-[12px] ${task.done ? 'text-bq-emerald line-through' : 'text-bq-ink'}`}>
                {task.label}
              </span>
              {!task.done && <span className="text-bq-amberd text-[14px] font-semibold">→</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
