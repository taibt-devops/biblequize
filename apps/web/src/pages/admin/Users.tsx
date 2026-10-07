import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '../../api/client'
import AdminSelect from '../../components/ui/AdminSelect'

interface UserItem {
  id: string; name: string; email: string; avatarUrl?: string; role: string
  currentStreak: number; longestStreak: number; lastPlayedAt?: string; createdAt: string
  isBanned: boolean; banReason?: string; bannedAt?: string
}

export default function UsersAdmin() {
  const { t } = useTranslation()
  const [users, setUsers] = useState<UserItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [selected, setSelected] = useState<UserItem | null>(null)
  const [banReason, setBanReason] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const fetchUsers = async (p = page) => {
    setIsLoading(true)
    try {
      const params: Record<string, any> = { page: p, size: 20 }
      if (search) params.search = search
      if (roleFilter) params.role = roleFilter
      if (statusFilter) params.status = statusFilter
      const res = await api.get('/api/admin/users', { params })
      setUsers(res.data.items ?? [])
      setTotal(res.data.total ?? 0)
      setTotalPages(res.data.totalPages ?? 1)
    } catch { /* graceful */ }
    finally { setIsLoading(false) }
  }

  useEffect(() => { fetchUsers() }, [page, roleFilter, statusFilter])

  const handleBan = async (user: UserItem, ban: boolean) => {
    if (ban && banReason.trim().length < 10) return
    setIsSaving(true)
    try {
      await api.patch(`/api/admin/users/${user.id}/ban`, { banned: ban, reason: ban ? banReason : undefined })
      fetchUsers()
      setSelected(null)
      setBanReason('')
    } catch { /* error */ }
    finally { setIsSaving(false) }
  }

  const handleRoleChange = async (user: UserItem, newRole: string) => {
    setIsSaving(true)
    try {
      await api.patch(`/api/admin/users/${user.id}/role`, { role: newRole })
      fetchUsers()
    } catch { /* error */ }
    finally { setIsSaving(false) }
  }

  const roleBadge = (role: string) => {
    const m: Record<string, string> = {
      ADMIN: 'bg-red-500/10 text-[#B3452F]',
      USER: 'bg-blue-500/10 text-[#2F6FB0]',
      GROUP_LEADER: 'bg-[#2F6FB0]/10 text-[#2F6FB0]',
      CONTENT_MOD: 'bg-[#FFC93C]/10 text-[#8A5A12]',
    }
    return <span className={`px-2 py-1 text-[0.65rem] font-bold rounded uppercase tracking-wider ${m[role] || 'bg-[#1D2B22]/[0.04] text-[#4D3A1F]/60'}`}>{role}</span>
  }

  return (
    <div data-testid="admin-users-page" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold text-[#1D2B22] tracking-tight">{t('admin.users.title')}</h1>
          <p className="text-[#4D3A1F] text-sm">{t('admin.users.subtitle')}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#4D3A1F]/50 text-sm">search</span>
          <input data-testid="admin-users-search" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchUsers(0)}
            placeholder={t('admin.users.searchPlaceholder')} className="w-full h-10 bg-[#F9ECC8] border-none rounded px-10 text-sm text-[#1D2B22] placeholder:text-[#4D3A1F]/40 focus:ring-1 focus:ring-[#8A5A12] transition-all" />
        </div>
        <AdminSelect className="w-40" value={roleFilter} onChange={v => { setRoleFilter(v); setPage(0) }} options={[
          { value: '', label: t('admin.users.filterRoleAll') },
          { value: 'ADMIN', label: 'Admin' },
          { value: 'USER', label: 'User' },
          { value: 'GROUP_LEADER', label: 'Group Leader' },
          { value: 'CONTENT_MOD', label: 'Content Mod' },
        ]} />
        <AdminSelect className="w-40" value={statusFilter} onChange={v => { setStatusFilter(v); setPage(0) }} options={[
          { value: '', label: t('admin.users.filterStatusAll') },
          { value: 'active', label: t('admin.users.statusActive') },
          { value: 'banned', label: t('admin.users.statusBanned') },
        ]} />
      </div>

      {/* Table */}
      <div data-testid="admin-users-table" className="bg-[#FFF8E7] rounded-lg overflow-hidden border border-[#1D2B22]/10">
        {isLoading ? (
          <div className="p-8 text-center text-[#4D3A1F]/40">{t('admin.users.loading')}</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-[#4D3A1F]/40">{t('admin.users.empty')}</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-[#F0DFB8] z-10">
              <tr>
                <th className="px-6 py-4 text-[0.65rem] font-bold uppercase tracking-widest text-[#4D3A1F]/80">{t('admin.users.columnUser')}</th>
                <th className="px-6 py-4 text-[0.65rem] font-bold uppercase tracking-widest text-[#4D3A1F]/80">{t('admin.users.columnRole')}</th>
                <th className="px-6 py-4 text-[0.65rem] font-bold uppercase tracking-widest text-[#4D3A1F]/80">{t('admin.users.columnStreak')}</th>
                <th className="px-6 py-4 text-[0.65rem] font-bold uppercase tracking-widest text-[#4D3A1F]/80">{t('admin.users.columnStatus')}</th>
                <th className="px-6 py-4 text-[0.65rem] font-bold uppercase tracking-widest text-[#4D3A1F]/80 text-right">{t('admin.users.columnLastActivity')}</th>
                <th className="px-6 py-4 text-[0.65rem] font-bold uppercase tracking-widest text-[#4D3A1F]/80 text-right">{t('admin.users.columnActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1D2B22]/5">
              {users.map(u => (
                <tr data-testid="admin-user-row" key={u.id} className={`hover:bg-[#F0DFB8] transition-colors cursor-pointer ${u.isBanned ? 'opacity-60' : ''}`} onClick={() => { setSelected(u); setBanReason('') }}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full bg-[#1D2B22]/[0.06] flex items-center justify-center text-xs font-bold text-[#4D3A1F] border ${u.isBanned ? 'border-red-500/50' : 'border-[#1D2B22]/20'}`}>
                        {u.avatarUrl ? <img src={u.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" /> : u.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#1D2B22]">{u.name}</p>
                        <p className="text-[0.7rem] text-[#4D3A1F]/60 font-mono">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">{roleBadge(u.role)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-sm font-bold text-[#1D2B22]">{u.currentStreak}</span>
                      <span className="text-[#4D3A1F]/40 text-xs">{t('admin.users.daysUnit')}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {u.isBanned
                      ? <span className="text-[#B3452F] text-xs font-bold">{t('admin.users.statusBanned')}</span>
                      : <span className="text-[#2E7D4F] text-xs font-medium">{t('admin.users.statusActive')}</span>}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <p className="text-xs font-mono text-[#4D3A1F]/60">{u.lastPlayedAt || '—'}</p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 hover:bg-[#F0DFB8] rounded text-[#4D3A1F]">
                      <span className="material-symbols-outlined text-lg">more_horiz</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#4D3A1F]/40">{t('admin.users.paginationSummary', { total, page: page + 1, totalPages })}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
              className="px-3 py-1.5 bg-[#FFF8E7] rounded text-sm text-[#1D2B22] disabled:opacity-30 hover:bg-[#F0DFB8] transition-colors">{t('admin.users.paginationPrev')}</button>
            <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
              className="px-3 py-1.5 bg-[#FFF8E7] rounded text-sm text-[#1D2B22] disabled:opacity-30 hover:bg-[#F0DFB8] transition-colors">{t('admin.users.paginationNext')}</button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div data-testid="admin-user-detail-modal" className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-[#FFF8E7] rounded-lg border border-[#1D2B22]/20 max-w-lg w-full p-6 space-y-5" onClick={e => e.stopPropagation()}>
            {selected.isBanned && (
              <div className="bg-red-500/10 border border-red-500/30 rounded p-3 text-[#B3452F] text-sm flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">lock</span>
                {t('admin.users.bannedBanner', { reason: selected.banReason ?? '' })}
              </div>
            )}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-[#FFC93C]/20 flex items-center justify-center text-lg font-bold text-[#8A5A12]">
                {selected.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#1D2B22]">{selected.name}</h3>
                <p data-testid="admin-user-detail-email" className="text-[#4D3A1F]/60 text-sm font-mono">{selected.email}</p>
                <div className="flex gap-2 mt-1">{roleBadge(selected.role)}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-[#EFE3C3] rounded p-3">
                <span className="text-[#4D3A1F]/40 text-[10px] uppercase tracking-widest font-bold">{t('admin.users.currentStreakLabel')}</span>
                <p className="font-bold text-[#1D2B22] font-mono mt-1">{t('admin.users.currentStreakValue', { count: selected.currentStreak })}</p>
              </div>
              <div className="bg-[#EFE3C3] rounded p-3">
                <span className="text-[#4D3A1F]/40 text-[10px] uppercase tracking-widest font-bold">{t('admin.users.bestStreakLabel')}</span>
                <p className="font-bold text-[#1D2B22] font-mono mt-1">{t('admin.users.bestStreakValue', { count: selected.longestStreak })}</p>
              </div>
            </div>

            {/* Role change */}
            <div className="flex items-center gap-3">
              <span className="text-[#4D3A1F]/60 text-sm">{t('admin.users.roleLabel')}</span>
              <select value={selected.role} onChange={e => handleRoleChange(selected, e.target.value)} disabled={isSaving}
                className="bg-[#EFE3C3] border border-[#1D2B22]/20 rounded px-3 py-1.5 text-sm text-[#1D2B22] focus:ring-1 focus:ring-[#8A5A12]">
                <option value="USER">USER</option>
                <option value="ADMIN">ADMIN</option>
                <option value="GROUP_LEADER">GROUP_LEADER</option>
                <option value="CONTENT_MOD">CONTENT_MOD</option>
              </select>
            </div>

            {/* Ban/Unban */}
            {selected.isBanned ? (
              <button onClick={() => handleBan(selected, false)} disabled={isSaving}
                className="w-full py-2.5 bg-green-600 text-white rounded text-sm font-bold disabled:opacity-50 hover:bg-green-500 transition-colors">
                {t('admin.users.unbanButton')}
              </button>
            ) : (
              <div data-testid="admin-user-ban-btn" className="space-y-2">
                <textarea data-testid="admin-ban-reason-input" value={banReason} onChange={e => setBanReason(e.target.value)} placeholder={t('admin.users.banReasonPlaceholder')}
                  className="w-full bg-[#EFE3C3] border border-[#1D2B22]/20 rounded p-3 text-sm text-[#1D2B22] placeholder:text-[#4D3A1F]/30 resize-none focus:ring-1 focus:ring-[#8A5A12]" rows={2} />
                <button data-testid="admin-ban-confirm-btn" onClick={() => handleBan(selected, true)} disabled={isSaving || banReason.trim().length < 10}
                  className="w-full py-2.5 bg-red-600 text-white rounded text-sm font-bold disabled:opacity-50 hover:bg-red-500 transition-colors">
                  {t('admin.users.banButton')}
                </button>
              </div>
            )}

            <button onClick={() => setSelected(null)} className="w-full py-2 text-[#4D3A1F]/60 text-sm hover:text-[#1D2B22] transition-colors">{t('admin.users.closeButton')}</button>
          </div>
        </div>
      )}
    </div>
  )
}
