import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { Link } from 'react-router-dom';

interface Tournament {
  id: string;
  name: string;
  status: 'REGISTRATION' | 'IN_PROGRESS' | 'COMPLETED';
  currentRound: number | null;
  participantCount: number;
  maxParticipants: number;
  createdAt: string;
  startAt: string | null;
  endAt: string | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

/* ─── Skeleton ─── */

function TournamentCardSkeleton() {
  return (
    <div className="bg-bq-white border border-bq-hair shadow-bq-soft rounded-2xl p-6 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-6 w-48 bg-bq-inset rounded-lg" />
        <div className="h-5 w-20 bg-bq-inset rounded-full" />
      </div>
      <div className="flex items-center gap-6 mb-4">
        <div className="h-4 w-24 bg-bq-inset rounded" />
        <div className="h-4 w-32 bg-bq-inset rounded" />
      </div>
      <div className="h-10 w-32 bg-bq-inset rounded-xl" />
    </div>
  );
}

/* ─── Main ─── */

const Tournaments: React.FC = () => {
  const { t } = useTranslation();

  const {
    data: tournaments,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<Tournament[]>({
    queryKey: ['tournaments'],
    queryFn: () => api.get('/api/tournaments').then((r) => r.data),
  });

  function statusBadge(status: Tournament['status']) {
    switch (status) {
      case 'REGISTRATION':
        return (
          <span data-testid="tournament-status-badge" className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-black bg-bq-amber/20 text-bq-amberd">
            <span className="w-1.5 h-1.5 rounded-full bg-bq-amber animate-pulse" />
            {t('tournaments.statusRegistration')}
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span data-testid="tournament-status-badge" className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-black bg-bq-emerald/20 text-bq-emerald">
            <span className="w-1.5 h-1.5 rounded-full bg-bq-emerald animate-pulse" />
            {t('tournaments.statusInProgress')}
          </span>
        );
      case 'COMPLETED':
        return (
          <span data-testid="tournament-status-badge" className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-black bg-bq-ink2/20 text-bq-ink2">
            {t('tournaments.statusCompleted')}
          </span>
        );
      default:
        return null;
    }
  }

  return (
    <div className="max-w-4xl mx-auto bg-bq-paper" data-testid="tournaments-page">
      {/* Header */}
      <section className="mb-10">
        <span className="text-bq-amberd font-bold text-[12.5px] mb-2 block">
          {t('tournaments.specialEvent')}
        </span>
        <h1 className="font-display text-4xl md:text-5xl font-black text-bq-ink tracking-tighter mb-4">
          {t('tournaments.title')}
        </h1>
        <p className="text-bq-ink2 text-lg leading-relaxed max-w-2xl">
          {t('tournaments.description')}
        </p>
      </section>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-testid="tournaments-skeleton">
          <TournamentCardSkeleton />
          <TournamentCardSkeleton />
          <TournamentCardSkeleton />
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="bg-bq-white border border-bq-hair shadow-bq-soft rounded-2xl p-10 text-center" data-testid="tournaments-error">
          <span className="material-symbols-outlined text-5xl text-bq-ruby mb-4 block">error</span>
          <p className="text-bq-ink font-bold text-lg mb-2">{t('tournaments.errorLoadList')}</p>
          <p className="text-bq-ink2 text-sm mb-6">
            {(error as Error)?.message || t('tournaments.errorGeneric')}
          </p>
          <button
            onClick={() => refetch()}
            className="px-6 py-3 bg-bq-action text-bq-ink shadow-bq-action rounded-xl font-black text-[12.5px] hover:opacity-90 transition-all active:scale-95"
          >
            {t('common.retry')}
          </button>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && tournaments && tournaments.length === 0 && (
        <div className="bg-bq-white border border-bq-hair shadow-bq-soft rounded-2xl p-10 text-center" data-testid="tournaments-empty">
          <span
            className="material-symbols-outlined text-5xl text-bq-ink2 mb-4 block"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            emoji_events
          </span>
          <p className="text-bq-ink font-bold text-lg mb-2">{t('tournaments.noTournaments')}</p>
          <p className="text-bq-ink2 text-sm">
            {t('tournaments.noTournamentsDesc')}
          </p>
        </div>
      )}

      {/* Tournament List */}
      {!isLoading && !isError && tournaments && tournaments.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-testid="tournaments-list">
          {tournaments.map((tItem) => (
            <Link
              key={tItem.id}
              to={`/tournaments/${tItem.id}`}
              data-testid="tournament-card"
              className="block bg-bq-white border border-bq-hair shadow-bq-soft rounded-2xl p-6 hover:ring-1 hover:ring-bq-amber/30 transition-all group"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <h2 className="text-xl font-black tracking-tight text-bq-ink group-hover:text-bq-amberd transition-colors">
                  {tItem.name}
                </h2>
                {statusBadge(tItem.status)}
              </div>

              <div className="flex flex-wrap items-center gap-6 text-sm text-bq-ink2">
                {/* Participants */}
                <div className="flex items-center gap-2" data-testid="tournament-participants-count">
                  <span className="material-symbols-outlined text-base text-bq-amberd">groups</span>
                  <span>
                    {tItem.participantCount}/{tItem.maxParticipants} {t('tournaments.participants')}
                  </span>
                </div>

                {/* Current round */}
                {tItem.currentRound != null && (
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-base text-bq-amberd">
                      format_list_numbered
                    </span>
                    <span>{t('tournaments.round', { number: tItem.currentRound })}</span>
                  </div>
                )}

                {/* Dates */}
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-bq-amberd">
                    calendar_month
                  </span>
                  <span>
                    {formatDate(tItem.startAt)}
                    {tItem.endAt ? ` — ${formatDate(tItem.endAt)}` : ''}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default Tournaments;
