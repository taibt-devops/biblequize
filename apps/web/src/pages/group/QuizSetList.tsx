import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api/client'
import {
  createLiveRoomFromQuizSet,
  listQuizSets, listFolders, createFolder, deleteFolder,
  type ListQuizSetsParams, type PublishStatus, type QuizSet, type QuizSetFolder,
  type RoomMode,
} from '../../api/quizSets'
import ModePickerModal from '../../components/group/ModePickerModal'
import { PlaceBackdrop } from '../../components/lk/Place'
import QuizSetListCard from '../../components/group/QuizSetListCard'

type GroupRole = 'LEADER' | 'MOD' | 'MEMBER' | null

/** Card cover gradients — cycle theo tag dominant hoặc fallback by index.
 *  Khung Sáng: nhẹ, sáng — jewel tint trên nền giấy. */
const COVER_GRADIENTS = [
  'linear-gradient(135deg, #FFE08A 0%, #F59E0B 100%)',  // easter — amber
  'linear-gradient(135deg, #2F6FB0 0%, #2F6FB0 100%)',  // gospel — sapphire
  'linear-gradient(135deg, #46C89A 0%, #2E7D4F 100%)',  // creation — emerald
  'linear-gradient(135deg, #46C89A 0%, #2E7D4F 100%)',  // children — emerald
  'linear-gradient(135deg, #FF7A5A 0%, #B3452F 100%)',  // OT — ruby/ember
  'linear-gradient(135deg, #2F6FB0 0%, #2F6FB0 100%)',  // sea — sapphire
  'linear-gradient(135deg, #2F6FB0 0%, #2F6FB0 100%)',  // psalms — sapphire
  'linear-gradient(135deg, #2F6FB0 0%, #2F6FB0 100%)',  // letters — sapphire
]

function pickCoverGradient(qs: QuizSet, idx: number): string {
  const tagsArr = (qs.tags || []) as string[]
  const tagStr = tagsArr.join(' ').toLowerCase()
  if (tagStr.includes('phục sinh') || tagStr.includes('easter'))    return COVER_GRADIENTS[0]
  if (tagStr.includes('phúc âm') || tagStr.includes('gospel'))      return COVER_GRADIENTS[1]
  if (tagStr.includes('sáng tạo') || tagStr.includes('creation'))   return COVER_GRADIENTS[2]
  if (tagStr.includes('thiếu nhi') || tagStr.includes('children'))  return COVER_GRADIENTS[3]
  if (tagStr.includes('giáng sinh') || tagStr.includes('christmas')) return COVER_GRADIENTS[4]
  if (tagStr.includes('thư tín') || tagStr.includes('epistle'))     return COVER_GRADIENTS[7]
  if (tagStr.includes('bài giảng') || tagStr.includes('sermon'))    return COVER_GRADIENTS[6]
  return COVER_GRADIENTS[idx % COVER_GRADIENTS.length]
}

const STATUS_FILTERS: { key: PublishStatus | 'ALL'; tKey: string; dot: string }[] = [
  { key: 'ALL',       tKey: 'quizSet.list.filterAll',       dot: '#F59E0B' },
  { key: 'PUBLISHED', tKey: 'quizSet.list.filterPublished', dot: '#2E7D4F' },
  { key: 'DRAFT',     tKey: 'quizSet.list.filterDraft',     dot: '#6B5530' },
  { key: 'ARCHIVED',  tKey: 'quizSet.list.filterArchived',  dot: '#F59E0B' },
]

const SORT_OPTIONS: { key: NonNullable<ListQuizSetsParams['sort']>; tKey: string }[] = [
  { key: 'popular', tKey: 'quizSet.list.sortPopular' },
  { key: 'recent',  tKey: 'quizSet.list.sortRecent' },
  { key: 'name',    tKey: 'quizSet.list.sortName' },
  { key: 'rating',  tKey: 'quizSet.list.sortRating' },
]

const DIFFICULTY_LABEL: Record<string, { vi: string; cssClass: string; emoji: string }> = {
  EASY:   { vi: 'Dễ',         cssClass: 'qs-difficulty-easy',   emoji: '🟢' },
  MEDIUM: { vi: 'Trung bình', cssClass: 'qs-difficulty-medium', emoji: '⚡' },
  HARD:   { vi: 'Khó',        cssClass: 'qs-difficulty-hard',   emoji: '🔥' },
  MIXED:  { vi: 'Tổng hợp',   cssClass: 'qs-difficulty-mixed',  emoji: '🎲' },
}

const MODE_BADGES: { key: string; emoji: string; cssClass: string }[] = [
  { key: 'SPEED_RACE',           emoji: '⚡',  cssClass: 'qs-mode-speed' },
  { key: 'GROUP_LIVE_SEQUENTIAL', emoji: '📚', cssClass: 'qs-mode-seq' },
  { key: 'TEAM_VS_TEAM',         emoji: '⚔️', cssClass: 'qs-mode-team' },
  { key: 'BATTLE_ROYALE',        emoji: '💀', cssClass: 'qs-mode-br' },
  { key: 'SUDDEN_DEATH',         emoji: '🥊', cssClass: 'qs-mode-sd' },
]

export default function QuizSetList() {
  const { t } = useTranslation()
  const { id: groupId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [items, setItems] = useState<QuizSet[]>([])
  const [folders, setFolders] = useState<QuizSetFolder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<PublishStatus | 'ALL'>('ALL')
  const [sort, setSort] = useState<ListQuizSetsParams['sort']>('popular')
  const [search, setSearch] = useState('')
  const [activeFolder, setActiveFolder] = useState<string | 'ALL' | 'UNCAT'>('ALL')
  const [groupName, setGroupName] = useState<string>('')
  const [myRole, setMyRole] = useState<GroupRole>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [sortOpen, setSortOpen] = useState(false)
  const [pickerQuizSet, setPickerQuizSet] = useState<QuizSet | null>(null)
  const [pickerBusy, setPickerBusy] = useState(false)
  const [pickerError, setPickerError] = useState<string | null>(null)

  useEffect(() => {
    if (!groupId) return
    api.get(`/api/groups/${groupId}`)
      .then(res => {
        setGroupName(res.data?.group?.name || '')
        setMyRole((res.data?.group?.myRole as GroupRole) ?? null)
      })
      .catch(() => {})
  }, [groupId])

  const handlePlayMultiplayer = (qs: QuizSet) => {
    setPickerError(null)
    setPickerQuizSet(qs)
  }

  const handleSchedule = (qs: QuizSet) => {
    if (!groupId) return
    navigate(`/groups/${groupId}/scheduled-quizzes/new?quizSetId=${qs.id}`)
  }

  const handlePickMode = async (mode: RoomMode) => {
    if (!groupId || !pickerQuizSet) return
    setPickerBusy(true); setPickerError(null)
    try {
      const room = await createLiveRoomFromQuizSet(groupId, { quizSetId: pickerQuizSet.id, mode })
      navigate(`/room/${room.id}/lobby`, { state: { fromGroupId: groupId } })
    } catch (err: any) {
      setPickerError(err?.response?.data?.message || err.message)
    } finally {
      setPickerBusy(false)
      setPickerQuizSet(null)
    }
  }

  const canSchedule = myRole === 'LEADER' || myRole === 'MOD'

  useEffect(() => {
    if (!groupId) return
    setLoading(true); setError(null)
    Promise.all([
      listQuizSets(groupId, {
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        sort, search: search.trim() || undefined, size: 100,
      }),
      listFolders(groupId).catch(() => []),
    ])
      .then(([qsRes, folderList]) => { setItems(qsRes.quizSets); setFolders(folderList) })
      .catch(err => setError(err?.response?.data?.message || err.message))
      .finally(() => setLoading(false))
  }, [groupId, statusFilter, sort, search])

  const refreshFolders = () => groupId && listFolders(groupId).then(setFolders).catch(() => {})

  const handleCreateFolder = async () => {
    const name = window.prompt(t('quizSet.list.createFolderPrompt'))
    if (!name?.trim() || !groupId) return
    try { await createFolder(groupId, name.trim()); refreshFolders() }
    catch (err: any) { setError(err?.response?.data?.message || err.message) }
  }

  const handleDeleteFolder = async (folder: QuizSetFolder) => {
    if (!confirm(t('quizSet.list.deleteFolderConfirm', { name: folder.name }))) return
    if (!groupId) return
    try {
      await deleteFolder(groupId, folder.id); refreshFolders()
      if (activeFolder === folder.id) setActiveFolder('ALL')
    } catch (err: any) { setError(err?.response?.data?.message || err.message) }
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: items.length, UNCAT: 0 }
    items.forEach(qs => {
      c[qs.publishStatus] = (c[qs.publishStatus] || 0) + 1
      if (!qs.folderId) c.UNCAT++
      else c[qs.folderId] = (c[qs.folderId] || 0) + 1
    })
    return c
  }, [items])

  const filteredByFolder = useMemo(() => {
    if (activeFolder === 'ALL') return items
    if (activeFolder === 'UNCAT') return items.filter(qs => !qs.folderId)
    return items.filter(qs => qs.folderId === activeFolder)
  }, [items, activeFolder])

  const drafts = useMemo(() => filteredByFolder.filter(qs => qs.publishStatus === 'DRAFT'), [filteredByFolder])
  const nonDrafts = useMemo(() => filteredByFolder.filter(qs => qs.publishStatus !== 'DRAFT'), [filteredByFolder])

  const grouped = useMemo(() => {
    if (activeFolder !== 'ALL') return null
    const byFolder = new Map<string, QuizSet[]>()
    const uncategorized: QuizSet[] = []
    nonDrafts.forEach(qs => {
      if (qs.folderId) {
        const arr = byFolder.get(qs.folderId) || []
        arr.push(qs); byFolder.set(qs.folderId, arr)
      } else uncategorized.push(qs)
    })
    return { byFolder, uncategorized }
  }, [nonDrafts, activeFolder])

  return (
    <div className="relative min-h-screen md:flex">
      <PlaceBackdrop place="chapel" veil="strong" />
      {/* Mobile header (md:hidden) */}
      <div className="md:hidden">
        <MobileHeader
          groupId={groupId!} t={t} totalCount={items.length}
        />
      </div>

      {/* Desktop folder sidebar (hidden:lg:flex) */}
      <aside className="hidden md:flex w-[240px] shrink-0 border-r border-bq-hair flex-col bg-bq-inset">
        <div className="px-4 py-3 border-b border-bq-hair">
          <div className="text-[12px] font-semibold text-bq-ink3 mb-2">Danh mục</div>
          <button
            onClick={handleCreateFolder}
            className="w-full bg-bq-white border border-bq-hair rounded-lg px-3 py-2 flex items-center gap-2 text-xs hover:bg-bq-inset"
          >
            <span className="text-bq-amberd">+</span>
            <span className="text-bq-ink2">{t('quizSet.list.createFolder').replace('+ ', '')}</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto qs-scroll-thin py-2">
          <FolderItem
            label="Tất cả"
            emoji="📚"
            count={counts.ALL}
            active={activeFolder === 'ALL'}
            onClick={() => setActiveFolder('ALL')}
            highlight
          />

          <SidebarSection label="Theo trạng thái">
            {STATUS_FILTERS.filter(f => f.key !== 'ALL').map(f => {
              const selected = statusFilter === f.key
              return (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(selected ? 'ALL' : (f.key as PublishStatus))}
                  className="w-full flex items-center justify-between px-4 py-1.5 text-xs hover:bg-bq-inset"
                >
                  <span className={`flex items-center gap-2 ${selected ? 'text-bq-amberd font-bold' : 'text-bq-ink2'}`}>
                    <span className="w-2 h-2 rounded-full" style={{ background: f.dot }} />
                    <span>{t(f.tKey)}</span>
                  </span>
                  <span className="text-[10px] text-bq-ink3">{counts[f.key] || 0}</span>
                </button>
              )
            })}
          </SidebarSection>

          <SidebarSection label="Thư mục">
            {folders.map(f => (
              <FolderItem
                key={f.id}
                label={f.name}
                emoji="📁"
                count={counts[f.id] || 0}
                active={activeFolder === f.id}
                onClick={() => setActiveFolder(f.id)}
                onDelete={() => handleDeleteFolder(f)}
              />
            ))}
            <FolderItem
              label="Chưa phân loại"
              emoji="📁"
              count={counts.UNCAT}
              active={activeFolder === 'UNCAT'}
              onClick={() => setActiveFolder('UNCAT')}
              dimmed
            />
          </SidebarSection>
        </div>
      </aside>

      {/* MAIN content */}
      <div className="flex-1 flex flex-col bg-bq-paper min-h-screen">
        {/* Desktop toolbar */}
        <div className="hidden md:block px-6 py-4 border-b border-bq-hair bg-bq-white">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[12px] text-bq-ink3 font-semibold">
                <Link to={`/groups/${groupId}`} className="hover:text-bq-ink">{(groupName || 'Nhóm').toUpperCase()}</Link>
                {' / '}<span>BỘ CÂU HỎI</span>
              </div>
              <h1 className="text-2xl font-extrabold text-bq-ink mt-0.5 font-display">
                {activeFolder === 'ALL' ? 'Tất cả bộ câu hỏi' :
                 activeFolder === 'UNCAT' ? 'Chưa phân loại' :
                 folders.find(f => f.id === activeFolder)?.name || 'Bộ câu hỏi'}
                <span className="text-bq-ink3 font-normal text-xl ml-1">({filteredByFolder.length})</span>
              </h1>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                title="Tính năng đang phát triển"
                className="px-3 py-2 rounded-lg bg-bq-inset border border-bq-hair text-bq-ink2 text-xs font-semibold flex items-center gap-1.5 hover:border-bq-ink3 opacity-60 cursor-not-allowed"
              >
                <span>📋</span><span>Clone từ template</span>
              </button>
              <button
                type="button"
                title="Tính năng đang phát triển"
                className="px-3 py-2 rounded-lg bg-bq-inset border border-bq-hair text-bq-ink2 text-xs font-semibold flex items-center gap-1.5 hover:border-bq-ink3 opacity-60 cursor-not-allowed"
              >
                <span>📥</span><span>Import</span>
              </button>
              <Link
                to={`/groups/${groupId}/quiz-sets/new`}
                className="px-4 py-2 rounded-lg bg-bq-action shadow-bq-action text-bq-ink text-xs font-extrabold flex items-center gap-1.5 hover:opacity-90"
              >
                <span className="text-base leading-none">+</span><span>TẠO BỘ MỚI</span>
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 bg-bq-inset rounded-lg px-3 py-2 flex items-center gap-2 max-w-md border border-bq-hair">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-bq-ink3">
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-transparent outline-none text-xs text-bq-ink placeholder-bq-ink3 flex-1"
                placeholder="Tìm theo tên, mô tả, tag..."
              />
              <span className="text-[10px] text-bq-ink3 px-1.5 py-0.5 rounded border border-bq-hair">⌘K</span>
            </div>

            <div className="flex items-center gap-1.5 ml-auto text-xs">
              <span className="text-bq-ink3">{t('quizSet.list.sortLabel')}</span>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setSortOpen(v => !v)}
                  className="bg-bq-inset rounded-lg px-2.5 py-1.5 text-bq-ink2 outline-none border border-bq-hair cursor-pointer flex items-center gap-1"
                >
                  <span>{t(SORT_OPTIONS.find(o => o.key === sort)?.tKey || 'quizSet.list.sortPopular')}</span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M7 10l5 5 5-5z" /></svg>
                </button>
                {sortOpen && (
                  <div
                    className="absolute right-0 top-full mt-1 w-44 bg-bq-white border border-bq-hair shadow-bq-soft rounded-lg overflow-hidden z-20"
                    onMouseLeave={() => setSortOpen(false)}
                  >
                    {SORT_OPTIONS.map(o => (
                      <button
                        key={o.key}
                        type="button"
                        onClick={() => { setSort(o.key); setSortOpen(false) }}
                        className={`w-full px-3 py-1.5 text-left text-xs hover:bg-bq-inset ${sort === o.key ? 'text-bq-amberd font-bold' : 'text-bq-ink2'}`}
                      >{t(o.tKey)}</button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex bg-bq-inset rounded-lg overflow-hidden border border-bq-hair ml-1">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`px-2 py-1.5 ${viewMode === 'grid' ? 'text-bq-amberd bg-bq-amber/10' : 'text-bq-ink3 hover:text-bq-ink2'}`}
                  title="Lưới"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`px-2 py-1.5 ${viewMode === 'list' ? 'text-bq-amberd bg-bq-amber/10' : 'text-bq-ink3 hover:text-bq-ink2'}`}
                  title="Danh sách"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <line x1="8" y1="6" x2="21" y2="6" />
                    <line x1="8" y1="12" x2="21" y2="12" />
                    <line x1="8" y1="18" x2="21" y2="18" />
                    <line x1="3" y1="6" x2="3.01" y2="6" />
                    <line x1="3" y1="12" x2="3.01" y2="12" />
                    <line x1="3" y1="18" x2="3.01" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile filter chips + search */}
        <div className="md:hidden px-5 mb-3">
          <div className="bg-bq-white border border-bq-hair shadow-bq-soft rounded-xl px-3 py-2.5 flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-bq-ink3">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent outline-none text-sm text-bq-ink placeholder-bq-ink3 flex-1"
              placeholder={t('quizSet.list.search')}
            />
          </div>

          <div className="flex gap-1.5 mt-2 overflow-x-auto qs-scroll-thin pb-1">
            {STATUS_FILTERS.map(f => {
              const selected = statusFilter === f.key
              return (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={`shrink-0 px-3 py-1 rounded-full text-[10px] font-semibold ${
                    selected
                      ? 'bg-bq-amber/15 text-bq-amberd border border-bq-amber/30'
                      : 'bg-bq-white border border-bq-hair text-bq-ink2'
                  }`}
                >
                  {t(f.tKey)} · {counts[f.key] || 0}
                </button>
              )
            })}
          </div>

          <div className="flex justify-between items-center mt-2">
            <span className="text-[10px] text-bq-ink3">{t('quizSet.list.sortLabel')}</span>
            <select
              value={sort}
              onChange={e => setSort(e.target.value as any)}
              className="text-[10px] text-bq-amberd font-semibold bg-transparent outline-none cursor-pointer"
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.key} value={o.key} className="bg-bq-white text-bq-ink">{t(o.tKey)}</option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="mx-5 lg:mx-6 mb-3 px-4 py-3 rounded-lg bg-bq-ruby/15 text-bq-ruby text-sm">{error}</div>
        )}

        <div className="flex-1 overflow-y-auto qs-scroll-thin px-5 lg:px-6 lg:py-6">
          {loading ? (
            <div className="px-5 py-8 text-center text-bq-ink3">{t('quizSet.list.loading')}</div>
          ) : items.length === 0 ? (
            <EmptyState groupId={groupId!} hasSearch={search.length > 0} t={t} />
          ) : grouped ? (
            <>
              {folders.map(folder => {
                const folderItems = grouped.byFolder.get(folder.id) || []
                if (folderItems.length === 0) return null
                return (
                  <SectionGroup key={folder.id} title={`📁 ${folder.name}`} count={folderItems.length}>
                    <CardGrid groupId={groupId!} items={folderItems} viewMode={viewMode} myRole={myRole}
                      onPlayMultiplayer={handlePlayMultiplayer} onSchedule={handleSchedule} canSchedule={canSchedule} />
                  </SectionGroup>
                )
              })}

              {grouped.uncategorized.length > 0 && (
                <SectionGroup title="📂 Chưa phân loại" count={grouped.uncategorized.length}>
                  <CardGrid groupId={groupId!} items={grouped.uncategorized} viewMode={viewMode} myRole={myRole}
                    onPlayMultiplayer={handlePlayMultiplayer} onSchedule={handleSchedule} canSchedule={canSchedule} />
                </SectionGroup>
              )}

              {drafts.length > 0 && (
                <SectionGroup title={`📝 ${t('quizSet.list.draftsHeader')}`} count={drafts.length} dimmed>
                  <CardGrid groupId={groupId!} items={drafts} viewMode={viewMode} myRole={myRole} />
                </SectionGroup>
              )}
            </>
          ) : (
            <>
              {nonDrafts.length > 0 && <CardGrid groupId={groupId!} items={nonDrafts} viewMode={viewMode} myRole={myRole}
                onPlayMultiplayer={handlePlayMultiplayer} onSchedule={handleSchedule} canSchedule={canSchedule} />}
              {drafts.length > 0 && (
                <SectionGroup title={`📝 ${t('quizSet.list.draftsHeader')}`} count={drafts.length} dimmed>
                  <CardGrid groupId={groupId!} items={drafts} viewMode={viewMode} myRole={myRole} />
                </SectionGroup>
              )}
            </>
          )}

          {/* Mobile-only "Tạo thư mục" footer (desktop has it in sidebar) */}
          <button
            onClick={handleCreateFolder}
            className="md:hidden w-full mt-3 py-2 rounded-xl bg-bq-white border border-dashed border-bq-hair text-xs text-bq-ink2 hover:text-bq-amberd hover:border-bq-amber/40"
          >{t('quizSet.list.createFolder')}</button>
        </div>
      </div>

      {pickerError && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-bq-ruby text-white text-xs shadow-lg">
          {pickerError}
        </div>
      )}

      {pickerQuizSet && groupId && (
        <ModePickerModal
          quizSet={pickerQuizSet}
          busy={pickerBusy}
          groupId={groupId}
          onPick={handlePickMode}
          onSolo={null}
          canSchedule={canSchedule}
          onClose={() => setPickerQuizSet(null)}
        />
      )}
    </div>
  )
}

function MobileHeader({ groupId, t, totalCount }: { groupId: string; t: any; totalCount: number }) {
  const navigate = useNavigate()
  return (
    <div className="px-5 py-3 flex items-center justify-between">
      <button
        onClick={() => navigate(`/groups/${groupId}`)}
        className="w-9 h-9 rounded-full bg-bq-white border border-bq-hair flex items-center justify-center text-bq-ink2"
        aria-label={t('quizSet.list.back')}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </button>
      <div className="text-center">
        <div className="text-xs text-bq-ink2">{t('quizSet.list.title')}</div>
        <div className="text-sm font-bold text-bq-ink font-display">{t('quizSet.list.totalCount', { count: totalCount })}</div>
      </div>
      <Link
        to={`/groups/${groupId}/quiz-sets/new`}
        className="w-9 h-9 rounded-full bg-bq-action shadow-bq-action flex items-center justify-center text-bq-ink font-bold"
        aria-label={t('quizSet.list.createNew')}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      </Link>
    </div>
  )
}

function SidebarSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <div className="px-4 py-1 mt-3">
        <div className="text-[11.5px] font-semibold text-bq-ink3">{label}</div>
      </div>
      {children}
    </>
  )
}

function FolderItem({
  label, emoji, count, active, onClick, onDelete, highlight, dimmed,
}: {
  label: string; emoji: string; count: number;
  active: boolean; onClick: () => void; onDelete?: () => void;
  highlight?: boolean; dimmed?: boolean;
}) {
  return (
    <div className="group flex items-center hover:bg-bq-inset">
      <button
        onClick={onClick}
        className="flex-1 flex items-center justify-between px-4 py-1.5 text-xs"
      >
        <span className={`flex items-center gap-2 ${
          active ? 'text-bq-amberd font-bold' :
          highlight ? 'text-bq-amberd font-bold' :
          dimmed ? 'text-bq-ink3' : 'text-bq-ink2'
        }`}>
          <span>{emoji}</span><span>{label}</span>
        </span>
        <span className={`text-[10px] ${active || highlight ? 'text-bq-amberd' : 'text-bq-ink3'}`}>{count}</span>
      </button>
      {onDelete && (
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 px-2 text-bq-ink3 hover:text-bq-ruby text-xs"
          title="Xóa thư mục"
        >×</button>
      )}
    </div>
  )
}

function SectionGroup({
  title, count, dimmed, children,
}: {
  title: string; count: number; dimmed?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-sm font-bold ${dimmed ? 'text-bq-ink2' : 'text-bq-ink'}`}>{title}</span>
        <span className="text-xs text-bq-ink3">{count} bộ</span>
        <div className="h-px flex-1 bg-bq-hair ml-2" />
      </div>
      {children}
    </div>
  )
}

function CardGrid({
  groupId, items, viewMode = 'grid', onPlayMultiplayer, onSchedule, canSchedule, myRole,
}: {
  groupId: string; items: QuizSet[]; draftStyle?: boolean; viewMode?: 'grid' | 'list';
  onPlayMultiplayer?: (qs: QuizSet) => void;
  onSchedule?: (qs: QuizSet) => void;
  canSchedule?: boolean;
  myRole: GroupRole;
}) {
  const cls = viewMode === 'list'
    ? 'grid grid-cols-1 gap-3'
    : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-5'
  const isMember = myRole != null
  return (
    <div className={cls}>
      {items.map(qs => (
        <QuizSetListCard
          key={qs.id}
          groupId={groupId}
          qs={qs}
          myRole={myRole}
          isMember={isMember}
          onPlayCoPlay={onPlayMultiplayer}
          onSchedule={canSchedule ? onSchedule : undefined}
        />
      ))}
    </div>
  )
}

function coverEmoji(qs: QuizSet): string {
  return qs.coverImageUrl?.startsWith('emoji:') ? qs.coverImageUrl.slice(6) : '📖'
}

function statusBadge(status: PublishStatus) {
  switch (status) {
    case 'PUBLISHED':    return { vi: '✓ Đã xuất bản', cls: 'qs-badge-published' }
    case 'DRAFT':        return { vi: 'Nháp',          cls: 'qs-badge-draft' }
    case 'ARCHIVED':     return { vi: 'Lưu trữ',       cls: 'qs-badge-archived' }
    case 'SOFT_DELETED': return { vi: 'Đã xóa',        cls: 'qs-badge-deleted' }
  }
}

/** Responsive card: mobile = compact horizontal · desktop = cover-on-top */
function QuizSetCard({
  groupId, qs, idx = 0, forceCompact, onPlayMultiplayer, onSchedule, canSchedule,
}: {
  groupId: string; qs: QuizSet; idx?: number; forceCompact?: boolean;
  onPlayMultiplayer?: (qs: QuizSet) => void;
  onSchedule?: (qs: QuizSet) => void;
  canSchedule?: boolean;
}) {
  const navigate = useNavigate()
  const cover = coverEmoji(qs)
  const badge = statusBadge(qs.publishStatus)
  const diff = qs.difficulty ? DIFFICULTY_LABEL[qs.difficulty] : null
  const gradient = pickCoverGradient(qs, idx)
  const showActions = qs.publishStatus === 'PUBLISHED' && !!onPlayMultiplayer
  const goDetail = () => navigate(`/groups/${groupId}/quiz-sets/${qs.id}`)
  const stop = (e: React.MouseEvent) => { e.stopPropagation(); e.preventDefault() }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={goDetail}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goDetail() } }}
      className="qs-fade-in cursor-pointer block"
    >
      {/* Desktop: cover on top (hidden when list view forced) */}
      <div className={`${forceCompact ? 'hidden' : 'hidden md:block'} transition rounded-xl overflow-hidden shadow-bq-soft ${
        idx === 0 ? 'bg-bq-white border border-bq-amber/30' : 'bg-bq-white border border-bq-hair'
      }`}>
        <div className="h-28 relative overflow-hidden" style={{ background: gradient }}>
          <div className="absolute inset-0 flex items-center justify-center text-5xl opacity-40">{cover}</div>
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.35) 0%, transparent 50%, transparent 100%)' }} />
          <div className="absolute top-2 left-2"><span className={`qs-badge-status ${badge.cls}`}>{badge.vi}</span></div>
          <div className="absolute top-2 right-2 flex gap-1">
            {qs.averageRating != null && (
              <span className="px-1.5 py-0.5 rounded bg-black/40 backdrop-blur text-bq-amber text-[10px] font-bold">⭐ {Number(qs.averageRating).toFixed(1)}</span>
            )}
            <span className="px-1.5 py-0.5 rounded bg-black/40 backdrop-blur text-white text-[10px] font-bold">▶ {qs.playCount}x</span>
          </div>
        </div>
        <div className="p-3">
          <h3 className="font-extrabold text-bq-ink text-sm leading-tight font-display">{qs.name}</h3>
          {qs.coverScripture && (
            <div className="text-[10px] text-bq-ink2 mt-1 line-clamp-1">📍 {qs.coverScripture}{qs.description ? ` · "${qs.description.slice(0, 40)}"` : ''}</div>
          )}
          <div className="flex items-center gap-1.5 mt-2">
            <span className="text-[10px] text-bq-ink3">{qs.totalQuestions} câu</span>
            {diff && (
              <>
                <span className="text-[10px] text-bq-ink3">·</span>
                <span className={`text-[10px] font-semibold ${diff.cssClass}`}>{diff.emoji} {diff.vi}</span>
              </>
            )}
            {qs.estimatedDurationMin != null && (
              <>
                <span className="text-[10px] text-bq-ink3">·</span>
                <span className="text-[10px] text-bq-ink3">~{qs.estimatedDurationMin}p</span>
              </>
            )}
          </div>
          <ModeBadgeRow suggestedMode={qs.suggestedMode} />
          {showActions && (
            <CardActionRow
              qs={qs}
              onPlayMultiplayer={onPlayMultiplayer!}
              onSchedule={onSchedule}
              canSchedule={canSchedule}
              stop={stop}
            />
          )}
        </div>
      </div>

      {/* Mobile / list view: compact horizontal */}
      <div className={`${forceCompact ? 'block' : 'md:hidden'} bg-bq-white border border-bq-hair shadow-bq-soft rounded-xl mb-2 overflow-hidden`}>
        <div className="flex p-3 gap-3">
          <div className="w-14 h-14 rounded-lg flex items-center justify-center text-2xl shrink-0 bg-bq-inset">{cover}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <h3 className="font-display font-bold text-bq-ink text-xs leading-tight truncate">{qs.name}</h3>
              {qs.publishStatus === 'PUBLISHED' && (
                <span className="qs-badge-status qs-badge-published shrink-0 ml-1">Pub</span>
              )}
              {qs.publishStatus !== 'PUBLISHED' && (
                <span className={`qs-badge-status ${badge.cls} shrink-0 ml-1`}>{badge.vi}</span>
              )}
            </div>
            {qs.coverScripture && (
              <div className="text-[10px] text-bq-ink2 mt-0.5 line-clamp-1">📍 {qs.coverScripture}</div>
            )}
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="text-[10px] text-bq-ink3">{qs.totalQuestions} câu</span>
              {diff && (
                <>
                  <span className="text-[10px] text-bq-ink3">·</span>
                  <span className={`text-[10px] font-semibold ${diff.cssClass}`}>{diff.vi}</span>
                </>
              )}
              {qs.playCount > 0 && (
                <>
                  <span className="text-[10px] text-bq-ink3">·</span>
                  <span className="text-[10px] text-bq-amberd font-bold">▶ {qs.playCount}x</span>
                </>
              )}
              {qs.averageRating != null && (
                <span className="text-[10px] text-bq-amberd ml-auto">⭐ {Number(qs.averageRating).toFixed(1)}</span>
              )}
            </div>
            {showActions && (
              <CardActionRow
                qs={qs}
                onPlayMultiplayer={onPlayMultiplayer!}
                onSchedule={onSchedule}
                canSchedule={canSchedule}
                stop={stop}
                compact
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function CardActionRow({
  qs, onPlayMultiplayer, onSchedule, canSchedule, stop, compact,
}: {
  qs: QuizSet;
  onPlayMultiplayer: (qs: QuizSet) => void;
  onSchedule?: (qs: QuizSet) => void;
  canSchedule?: boolean;
  stop: (e: React.MouseEvent) => void;
  compact?: boolean;
}) {
  const sizeCls = compact ? 'h-7 px-2 text-[10px]' : 'h-8 px-2.5 text-xs'
  return (
    <div className={`flex items-center gap-1.5 ${compact ? 'mt-1.5' : 'mt-2.5 pt-2.5 border-t border-bq-hair'}`}>
      <button
        type="button"
        onClick={e => { stop(e); onPlayMultiplayer(qs) }}
        title="Chơi cùng nhau"
        aria-label="Chơi cùng nhau với nhóm"
        className={`${sizeCls} rounded-lg bg-bq-amber/15 hover:bg-bq-amber/25 border border-bq-amber/30 text-bq-amberd font-semibold flex items-center gap-1`}
      >
        <span>👥</span><span>Chơi cùng</span>
      </button>
      {canSchedule && onSchedule && (
        <button
          type="button"
          onClick={e => { stop(e); onSchedule(qs) }}
          title="Đặt lịch quiz cho nhóm"
          aria-label="Đặt lịch quiz cho nhóm"
          className={`${sizeCls} rounded-lg bg-bq-sapphire/15 hover:bg-bq-sapphire/25 border border-bq-sapphire/30 text-bq-sapphire font-semibold flex items-center gap-1`}
        >
          <span>📅</span><span>Đặt lịch</span>
        </button>
      )}
    </div>
  )
}

function ModeBadgeRow({ suggestedMode }: { suggestedMode?: string | null }) {
  // Show all 5 mode badges; suggested one slightly emphasized.
  return (
    <div className="flex gap-1 mt-2">
      {MODE_BADGES.map(m => (
        <span
          key={m.key}
          className={`text-[9px] px-1.5 py-0.5 rounded ${m.cssClass} font-semibold ${
            suggestedMode === m.key ? 'ring-1 ring-bq-emerald/40' : ''
          }`}
        >{m.emoji}</span>
      ))}
    </div>
  )
}

function DraftCard({ groupId, qs }: { groupId: string; qs: QuizSet }) {
  const pct = Math.min(100, Math.round((qs.totalQuestions / 15) * 100))
  return (
    <Link
      to={`/groups/${groupId}/quiz-sets/${qs.id}`}
      className="block rounded-xl mb-2 overflow-hidden border border-bq-hair shadow-bq-soft qs-fade-in bg-bq-inset"
    >
      {/* Desktop: cover on top */}
      <div className="hidden md:block">
        <div className="h-28 relative bg-bq-white flex items-center justify-center">
          <div className="text-5xl opacity-30">📝</div>
          <div className="absolute top-2 left-2"><span className="qs-badge-status qs-badge-draft">Nháp</span></div>
        </div>
        <div className="p-3">
          <h3 className="font-extrabold text-bq-ink2 text-sm leading-tight font-display">{qs.name}</h3>
          <div className="text-[10px] text-bq-ink3 mt-1">
            {qs.totalQuestions > 0 ? `Mới có ${qs.totalQuestions}/15 câu` : 'Chưa có câu hỏi'}
            {qs.updatedAt && ` · Sửa cuối: ${formatRelative(qs.updatedAt)}`}
          </div>
          <div className="mt-2">
            <div className="bg-bq-inset rounded-full overflow-hidden h-1">
              <div className="bg-bq-amber h-1" style={{ width: `${pct}%` }} />
            </div>
            <div className="text-[10px] text-bq-ink3 mt-1">
              {pct}% hoàn thành
              {qs.totalQuestions < 5 && ` · Cần thêm ${5 - qs.totalQuestions} câu để xuất bản`}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: compact horizontal */}
      <div className="md:hidden flex p-3 gap-3">
        <div className="w-14 h-14 rounded-lg flex items-center justify-center text-2xl shrink-0 bg-bq-white">📝</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <h3 className="font-display font-bold text-bq-ink2 text-xs leading-tight truncate">{qs.name}</h3>
            <span className="qs-badge-status qs-badge-draft shrink-0 ml-1">Nháp</span>
          </div>
          <div className="text-[10px] text-bq-ink3 mt-0.5">
            {qs.totalQuestions > 0 ? `Mới có ${qs.totalQuestions} câu` : 'Chưa có câu hỏi'} · Sửa cuối: {qs.updatedAt ? formatRelative(qs.updatedAt) : '—'}
          </div>
          <div className="mt-1.5">
            <div className="bg-bq-inset rounded-full overflow-hidden h-1">
              <div className="bg-bq-amber h-1" style={{ width: `${pct}%` }} />
            </div>
            <div className="text-[10px] text-bq-ink3 mt-1">{pct}% hoàn thành</div>
          </div>
        </div>
      </div>
    </Link>
  )
}

function EmptyState({ groupId, hasSearch, t }: { groupId: string; hasSearch: boolean; t: any }) {
  return (
    <div className="rounded-xl p-8 text-center bg-bq-white border border-bq-hair shadow-bq-soft">
      <div className="text-5xl mb-3">📚</div>
      <p className="text-bq-ink2 mb-4 text-sm">
        {hasSearch ? t('quizSet.list.emptySearch') : t('quizSet.list.emptyAll')}
      </p>
      {!hasSearch && (
        <Link
          to={`/groups/${groupId}/quiz-sets/new`}
          className="inline-block px-4 py-2 rounded-lg bg-bq-action shadow-bq-action text-bq-ink font-bold text-sm"
        >{t('quizSet.list.createFirst')}</Link>
      )}
    </div>
  )
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 60) return `${min} phút trước`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} giờ trước`
  const day = Math.floor(hr / 24)
  if (day === 1) return 'hôm qua'
  if (day < 7) return `${day} ngày trước`
  return new Date(iso).toLocaleDateString('vi-VN')
}
