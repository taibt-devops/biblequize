import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client';
import { PlaceBackdrop, Plaque } from '../components/lk/Place';
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
    <div className="bg-bq-white/80 border-[3px] border-bq-ink/20 rounded-2xl p-6 animate-pulse">
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
          <span data-testid="tournament-status-badge" className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full border-2 border-bq-ink text-[12.5px] font-extrabold bg-bq-amber text-bq-ink">
            <span className="w-2 h-2 rounded-full bg-bq-ink animate-pulse" />
            {t('tournaments.statusRegistration')}
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span data-testid="tournament-status-badge" className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full border-2 border-bq-ink text-[12.5px] font-extrabold bg-bq-leaf text-bq-ink">
            <span className="w-2 h-2 rounded-full bg-bq-emerald animate-pulse" />
            {t('tournaments.statusInProgress')}
          </span>
        );
      case 'COMPLETED':
        return (
          <span data-testid="tournament-status-badge" className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full border-2 border-bq-ink/40 text-[12.5px] font-extrabold bg-bq-paper text-bq-ink2">
            {t('tournaments.statusCompleted')}
          </span>
        );
      default:
        return null;
    }
  }

  return (
    <div className="relative max-w-4xl mx-auto" data-testid="tournaments-page">
      <PlaceBackdrop place="arena" veil="strong" />
      {/* Header */}
      <section className="mb-8 space-y-3">
        <span className="inline-block px-3 py-0.5 rounded-full bg-bq-amber border-2 border-bq-ink text-[13px] font-extrabold">
          {t('tournaments.specialEvent')}
        </span>
        <div>
          <Plaque className="text-[30px] md:text-[40px]">
            <img src="/images/lk/pennant.webp" alt="" aria-hidden className="h-[1em]" />
            {t('tournaments.title')}
          </Plaque>
        </div>
        <p className="m-0 w-fit max-w-full px-3 py-1 bg-bq-white/90 border-2 border-bq-ink rounded-2xl font-read text-[15px] md:text-[16px] text-bq-ink2">
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
        <div className="bg-bq-white border-[3px] border-bq-ink shadow-bq-card rounded-bq p-10 text-center" data-testid="tournaments-error">
          <img src="/images/lk/hero-lost.webp" alt="" aria-hidden className="mx-auto h-28 mb-3" />
          <p className="text-bq-ink font-bold text-lg mb-2">{t('tournaments.errorLoadList')}</p>
          <p className="text-bq-ink2 text-sm mb-6">
            {(error as Error)?.message || t('tournaments.errorGeneric')}
          </p>
          <button
            onClick={() => refetch()}
            className="lk-btn text-bq-ink text-[16px]"
          >
            {t('common.retry')}
          </button>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && tournaments && tournaments.length === 0 && (
        <div className="bg-bq-white border-[3px] border-bq-ink shadow-bq-card rounded-bq p-10 text-center" data-testid="tournaments-empty">
          <img src="/images/lk/hero-rest.webp" alt="" aria-hidden className="mx-auto h-28 mb-3" />
          <p className="m-0 font-display text-[22px] font-extrabold text-bq-ink mb-2">{t('tournaments.noTournaments')}</p>
          <p className="m-0 font-read text-[15px] text-bq-ink2">
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
              className="block bg-bq-white border-[3px] border-bq-ink shadow-[0_5px_0_#1D2B22] rounded-2xl p-6 transition-transform hover:-translate-y-0.5 no-underline group"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <h2 className="m-0 font-display text-[22px] font-extrabold text-bq-ink">
                  {tItem.name}
                </h2>
                {statusBadge(tItem.status)}
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[14px] font-bold text-bq-ink2">
                {/* Participants */}
                <div className="flex items-center gap-2" data-testid="tournament-participants-count">
                  <span className="material-symbols-outlined text-[18px] text-bq-ink">groups</span>
                  <span>
                    {tItem.participantCount}/{tItem.maxParticipants} {t('tournaments.participants')}
                  </span>
                </div>

                {/* Current round */}
                {tItem.currentRound != null && (
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-bq-ink">
                      format_list_numbered
                    </span>
                    <span>{t('tournaments.round', { number: tItem.currentRound })}</span>
                  </div>
                )}

                {/* Dates */}
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-bq-ink">
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
