import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import { queryKeys } from '../../api/queryKeys'

interface Season { id: string; name: string; startDate: string; endDate: string; isActive: boolean }

async function fetchSeasons(): Promise<Season[]> {
  const res = await api.get<Season[]>('/api/admin/seasons')
  return Array.isArray(res.data) ? res.data : []
}

export default function RankingsAdmin() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data: seasons = [], isLoading } = useQuery({
    queryKey: queryKeys.rankings.list(),
    queryFn: fetchSeasons,
  })

  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', startDate: '', endDate: '' })

  const createMutation = useMutation({
    mutationFn: (body: typeof form) => api.post('/api/admin/seasons', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rankings.all })
      setShowCreate(false)
      setForm({ name: '', startDate: '', endDate: '' })
    },
  })

  const endMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/admin/seasons/${id}/end`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.rankings.all }),
  })

  const createSeason = () => {
    if (!form.name || !form.startDate || !form.endDate) return
    createMutation.mutate(form)
  }

  const endSeason = (id: string) => {
    if (!confirm(t('admin.rankings.endConfirm'))) return
    endMutation.mutate(id)
  }

  const active = seasons.find(s => s.isActive)

  return (
    <div data-testid="admin-rankings-page" className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold text-[#1D2B22]">{t('admin.rankings.title')}</h2><p className="text-[#4D3A1F]/60 text-sm">{t('admin.rankings.subtitle', { count: seasons.length })}</p></div>
        <button onClick={() => setShowCreate(!showCreate)} className="px-4 py-2 gold-gradient text-[#1D2B22] rounded-lg text-sm font-bold hover:opacity-90">{t('admin.rankings.createSeasonButton')}</button>
      </div>

      {showCreate && (
        <div data-testid="create-season-form" className="rounded-lg border border-[#1D2B22]/20 bg-[#FFF8E7] p-4 space-y-3">
          <input data-testid="create-season-name-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={t('admin.rankings.seasonNamePlaceholder')} className="w-full bg-[#F9ECC8] border border-[#1D2B22]/20 rounded-lg px-4 py-2 text-sm text-[#1D2B22]" />
          <div className="flex gap-3">
            <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className="flex-1 bg-[#F9ECC8] border border-[#1D2B22]/20 rounded-lg px-4 py-2 text-sm text-[#1D2B22] [color-scheme:dark]" />
            <input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} className="flex-1 bg-[#F9ECC8] border border-[#1D2B22]/20 rounded-lg px-4 py-2 text-sm text-[#1D2B22] [color-scheme:dark]" />
          </div>
          <button data-testid="create-season-submit-btn" onClick={createSeason} disabled={createMutation.isPending} className="px-6 py-2 gold-gradient text-[#1D2B22] rounded-lg text-sm font-bold disabled:opacity-50">{createMutation.isPending ? t('admin.rankings.creating') : t('admin.rankings.createSeasonSubmit')}</button>
        </div>
      )}

      {active && (
        <div data-testid="active-season-banner" className="rounded-lg border-2 border-emerald-500/30 bg-emerald-500/5 p-5">
          <div data-testid="admin-season-active-banner" className="flex items-center justify-between">
            <div>
              <span className="text-[#2E7D4F] text-xs font-bold uppercase tracking-wider">{t('admin.rankings.activeBadge')}</span>
              <h3 data-testid="active-season-name" className="text-xl font-bold text-[#1D2B22] mt-1">{active.name}</h3>
              <p className="text-[#4D3A1F]/60 text-sm">{active.startDate} → {active.endDate}</p>
            </div>
            <span data-testid="admin-season-end-btn" className="inline-flex">
              <button data-testid="end-season-btn" onClick={() => endSeason(active.id)} className="px-4 py-2 bg-red-600/20 text-[#B3452F] rounded-lg text-sm font-medium hover:bg-red-600/30 border border-red-500/20">{t('admin.rankings.endEarlyButton')}</button>
            </span>
          </div>
        </div>
      )}

      {isLoading ? <div className="text-center text-[#4D3A1F]/60 py-8">{t('admin.rankings.loading')}</div>
       : seasons.filter(s => !s.isActive).length === 0 ? <div className="text-center text-[#4D3A1F]/60 py-8">{t('admin.rankings.empty')}</div>
       : <div data-testid="inactive-seasons-list" className="space-y-3"><div data-testid="admin-seasons-archived-list" className="contents">{seasons.filter(s => !s.isActive).map(s => (
          <div key={s.id} className="rounded-lg border border-[#1D2B22]/20 bg-[#FFF8E7] p-4 flex items-center justify-between">
            <div><h4 className="font-medium text-[#1D2B22]">{s.name}</h4><p className="text-[#4D3A1F]/60 text-xs">{s.startDate} → {s.endDate}</p></div>
            <span className="text-[#4D3A1F]/30 text-xs">{t('admin.rankings.endedLabel')}</span>
          </div>
        ))}</div></div>
      }
    </div>
  )
}
