import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import { queryKeys } from '../../api/queryKeys'

interface Group { id: string; name: string; code: string; memberCount: number; maxMembers: number; isPublic: boolean; isLocked: boolean; lockReason?: string; leaderName?: string; createdAt: string }

async function fetchGroups(): Promise<Group[]> {
  const res = await api.get<Group[]>('/api/admin/groups')
  return Array.isArray(res.data) ? res.data : []
}

export default function GroupsAdmin() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data: groups = [], isLoading } = useQuery({
    queryKey: queryKeys.adminGroups.list(),
    queryFn: fetchGroups,
  })

  const [selected, setSelected] = useState<Group | null>(null)
  const [lockReason, setLockReason] = useState('')

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.adminGroups.all })

  const lockMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.patch(`/api/admin/groups/${id}/lock`, { reason }),
    onSuccess: () => { invalidate(); setSelected(null); setLockReason('') },
  })

  const unlockMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/api/admin/groups/${id}/unlock`),
    onSuccess: () => { invalidate(); setSelected(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/admin/groups/${id}`),
    onSuccess: () => { invalidate(); setSelected(null) },
  })

  const lockGroup = (id: string) => {
    if (lockReason.trim().length < 10) return
    lockMutation.mutate({ id, reason: lockReason })
  }

  const deleteGroup = (id: string) => {
    if (!confirm(t('admin.groups.deleteConfirm'))) return
    deleteMutation.mutate(id)
  }

  return (
    <div data-testid="admin-groups-page" className="space-y-6">
      <div><h1 className="text-3xl font-extrabold text-[#1D2B22] tracking-tight">{t('admin.groups.title')}</h1><p className="text-[#4D3A1F]/60 text-sm">{t('admin.groups.subtitle', { count: groups.length })}</p></div>

      {isLoading ? <div className="text-center text-[#4D3A1F]/60 py-8">{t('admin.groups.loading')}</div>
       : groups.length === 0 ? <div className="text-center text-[#4D3A1F]/60 py-8">{t('admin.groups.empty')}</div>
       : <div data-testid="admin-groups-list" className="space-y-3">{groups.map(g => (
          <div data-testid="admin-group-row" key={g.id} className={`rounded-lg border bg-[#FFF8E7] p-4 flex items-center justify-between ${g.isLocked ? 'border-red-500/30 bg-red-500/5' : 'border-[#1D2B22]/20'}`}>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-[#1D2B22]">{g.name}</h4>
                {g.isLocked && <span data-testid="group-lock-badge" className="text-[#B3452F] text-xs font-bold">{t('admin.groups.lockedBadge')}</span>}
                {g.isPublic && <span className="text-[#2F6FB0] text-xs">{t('admin.groups.publicBadge')}</span>}
              </div>
              <p className="text-[#4D3A1F]/60 text-xs">{t('admin.groups.rowSummary', { code: g.code, members: g.memberCount, max: g.maxMembers, leader: g.leaderName || '—' })}</p>
              {g.isLocked && g.lockReason && <p className="text-[#B3452F]/60 text-xs mt-1">{t('admin.groups.lockReasonLabel', { reason: g.lockReason })}</p>}
            </div>
            <button onClick={() => { setSelected(g); setLockReason('') }} className="text-[#8A5A12] text-xs hover:underline">{t('admin.groups.detailsButton')}</button>
          </div>
        ))}</div>
      }

      {selected && (
        <div data-testid="admin-group-detail-modal" className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-[#FFF8E7] rounded-2xl border border-[#1D2B22]/20 max-w-lg w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#1D2B22]">{selected.name}</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-[#FFF8E7] rounded-lg p-3"><span className="text-[#4D3A1F]/60 text-xs">{t('admin.groups.membersLabel')}</span><p className="font-bold text-[#1D2B22]">{selected.memberCount}/{selected.maxMembers}</p></div>
              <div className="bg-[#FFF8E7] rounded-lg p-3"><span className="text-[#4D3A1F]/60 text-xs">{t('admin.groups.codeLabel')}</span><p className="font-bold text-[#1D2B22]">{selected.code}</p></div>
            </div>

            {selected.isLocked ? (
              <div className="space-y-2">
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-[#B3452F] text-sm">{t('admin.groups.lockedBanner', { reason: selected.lockReason ?? '' })}</div>
                <button onClick={() => unlockMutation.mutate(selected.id)} className="w-full py-2 bg-green-600 text-white rounded-lg text-sm font-medium">{t('admin.groups.unlockButton')}</button>
              </div>
            ) : (
              <div className="space-y-2">
                <textarea data-testid="group-lock-reason-input" value={lockReason} onChange={e => setLockReason(e.target.value)} placeholder={t('admin.groups.lockReasonPlaceholder')} className="w-full bg-[#F9ECC8] border border-[#1D2B22]/20 rounded-lg p-3 text-sm text-[#1D2B22] resize-none" rows={2} />
                <button data-testid="group-lock-confirm-btn" onClick={() => lockGroup(selected.id)} disabled={lockReason.trim().length < 10} className="w-full py-2 bg-red-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">{t('admin.groups.lockButton')}</button>
              </div>
            )}

            <button data-testid="group-delete-btn" onClick={() => deleteGroup(selected.id)} className="w-full py-2 bg-[#FFF8E7] text-[#B3452F] rounded-lg text-sm border border-red-500/20">{t('admin.groups.deleteButton')}</button>
            <button onClick={() => setSelected(null)} className="w-full py-2 bg-[#FFF8E7] text-[#4D3A1F]/60 rounded-lg text-sm">{t('admin.groups.closeButton')}</button>
          </div>
        </div>
      )}
    </div>
  )
}
