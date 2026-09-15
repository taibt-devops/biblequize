// Central queryKey factories for TanStack Query.
// Pattern: tkdodo's "factory style" — each domain exposes `all` (root), `list`,
// and optionally `detail(id)`. Keep keys as `as const` tuples so cache lookups
// & invalidations are type-safe.
//
// Usage:
//   useQuery({ queryKey: queryKeys.tournaments.list(), queryFn: ... })
//   queryClient.invalidateQueries({ queryKey: queryKeys.tournaments.all })
//
// Add new domains here when migrating callers off `useEffect + api.get`.

export const queryKeys = {
  tournaments: {
    all: ['tournaments'] as const,
    list: () => [...queryKeys.tournaments.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.tournaments.all, 'detail', id] as const,
  },

  rankings: {
    all: ['rankings'] as const,
    list: () => [...queryKeys.rankings.all, 'list'] as const,
  },

  adminGroups: {
    all: ['admin', 'groups'] as const,
    list: () => [...queryKeys.adminGroups.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.adminGroups.all, 'detail', id] as const,
  },

  adminNotifications: {
    all: ['admin', 'notifications'] as const,
    list: () => [...queryKeys.adminNotifications.all, 'list'] as const,
  },

  reviewQueue: {
    all: ['reviewQueue'] as const,
    pending: () => [...queryKeys.reviewQueue.all, 'pending'] as const,
    stats: () => [...queryKeys.reviewQueue.all, 'stats'] as const,
    history: () => [...queryKeys.reviewQueue.all, 'history'] as const,
  },

  groups: {
    all: ['groups'] as const,
    detail: (id: string) => [...queryKeys.groups.all, id] as const,
    collectiveGrowth: (id: string) => [...queryKeys.groups.all, id, 'collective-growth'] as const,
  },

  groupJourney: {
    all: ['groupJourney'] as const,
    list: (groupId: string) => [...queryKeys.groupJourney.all, groupId, 'list'] as const,
    detail: (groupId: string, journeyId: string) =>
      [...queryKeys.groupJourney.all, groupId, 'detail', journeyId] as const,
  },

  memorize: {
    all: ['memorize'] as const,
    list: () => [...queryKeys.memorize.all, 'list'] as const,
    due: () => [...queryKeys.memorize.all, 'due'] as const,
    dueCount: () => [...queryKeys.memorize.all, 'due-count'] as const,
    passage: (book: string, chapter: number, from: number, to: number) =>
      ['bible-passage', book, chapter, from, to] as const,
  },
} as const
