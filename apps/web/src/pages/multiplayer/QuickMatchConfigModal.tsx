// QP-6.5 — Modal popup mở khi user bấm "Đấu Nhanh" trên hero card
// (QP-6) hoặc empty state (QP-8). User chọn mode + scope + count + time
// + source rồi submit → POST /api/rooms/quick-match (QP-11) → navigate
// /room/{id}/lobby (QP-10 sẽ render indigo banner thay Quản trò).
//
// Pattern: controlled form trong overlay, Esc + click backdrop dismiss.

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { MODE_LIST, MODE_META, type RoomModeId } from '../create-room/modeMeta'
import BookScopeOptions from '../create-room/BookScopeOptions'
import {
  describeQuickMatchError, triggerQuickMatch,
  type QuickMatchConfig, type QuickMatchSource,
} from '../../api/quickMatch'

const COUNT_OPTIONS = [5, 10, 15, 20]
const TIME_OPTIONS = [15, 20, 30]
const MAX_PLAYER_OPTIONS = [10, 20, 50, 100]
const INDIGO = '#2F6FB0'

interface Props {
  open: boolean
  onClose: () => void
  /** Required to gate AI source. Pass tier level from auth store. */
  userTier?: number
}

export default function QuickMatchConfigModal({ open, onClose, userTier = 1 }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [mode, setMode] = useState<RoomModeId>('SPEED_RACE')
  const [bookScope, setBookScope] = useState('ALL')
  const [count, setCount] = useState(10)
  const [time, setTime] = useState(30)
  const [maxPlayers, setMaxPlayers] = useState(10)
  const [language, setLanguage] = useState<'vi' | 'en'>('vi')
  const [source, setSource] = useState<QuickMatchSource>('DATABASE')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const aiUnlocked = userTier >= 4

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const handleSubmit = async () => {
    setSubmitting(true); setError(null)
    try {
      const config: QuickMatchConfig = {
        mode, bookScope,
        questionCount: count,
        timePerQuestion: time,
        maxPlayers,
        source: aiUnlocked ? source : 'DATABASE',
        language,
      }
      const res = await triggerQuickMatch(config)
      navigate(`/room/${res.room.id}/lobby`)
    } catch (e) {
      setError(describeQuickMatchError(e).message)
      setSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="qm-modal-backdrop"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8 overflow-y-auto"
      style={{ background: 'rgba(29,43,34,0.5)', backdropFilter: 'blur(4px)' }}
    >
      <div
        data-testid="qm-modal"
        onClick={e => e.stopPropagation()}
        className="w-full max-w-[520px] rounded-2xl bg-bq-white"
        style={{
          border: `1px solid #C9B58C`,
          boxShadow: `var(--bq-shadow-sap)`,
        }}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-3 flex items-start justify-between">
          <div>
            <div className="text-[12px] font-bold mb-1" style={{ color: '#2F6FB0' }}>
              {t('multiplayer.config.kicker')}
            </div>
            <h2 className="font-display text-[20px] font-extrabold text-bq-ink">{t('multiplayer.config.title')}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-bq-ink2 hover:text-bq-ink hover:bg-bq-inset"
            aria-label={t('multiplayer.config.close')}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>

        <div className="px-6 pb-6 space-y-5">
          {/* Mode */}
          <Section label={t('multiplayer.config.sectionMode')}>
            <div className="grid grid-cols-2 gap-2">
              {MODE_LIST.map(m => {
                const active = mode === m.id
                return (
                  <button
                    key={m.id}
                    type="button"
                    data-testid={`qm-mode-${m.id}`}
                    data-active={active}
                    onClick={() => setMode(m.id)}
                    className="flex items-center gap-2 px-3 h-10 rounded-lg text-[12px] font-semibold transition-colors text-left"
                    style={{
                      background: active ? hexAlpha(m.color, 0.14) : '#EFE3C3',
                      border: `1px solid ${active ? m.color : '#C9B58C'}`,
                      color: active ? '#1D2B22' : '#4D3A1F',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: m.color }}>{m.icon}</span>
                    {modeLabel(m.id)}
                  </button>
                )
              })}
            </div>
          </Section>

          {/* Scope + Language */}
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <Section label={t('multiplayer.config.sectionScope')}>
              <select
                value={bookScope}
                onChange={e => setBookScope(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg text-[13px] text-bq-ink outline-none appearance-none cursor-pointer"
                style={{
                  background: '#EFE3C3',
                  border: '1px solid #C9B58C',
                }}
              >
                <BookScopeOptions />
              </select>
            </Section>
            <Section label={t('multiplayer.config.sectionLanguage')}>
              <ChipGroup
                options={[
                  { value: 'vi', label: 'VN' },
                  { value: 'en', label: 'EN' },
                ]}
                value={language}
                onChange={setLanguage}
              />
            </Section>
          </div>

          {/* Count + Time */}
          <div className="grid grid-cols-2 gap-3">
            <Section label={t('multiplayer.config.sectionCount')}>
              <ChipGroup options={COUNT_OPTIONS.map(n => ({ value: n, label: String(n) }))} value={count} onChange={setCount} />
            </Section>
            <Section label={t('multiplayer.config.sectionTime')}>
              <ChipGroup options={TIME_OPTIONS.map(s => ({ value: s, label: `${s}s` }))} value={time} onChange={setTime} />
            </Section>
          </div>

          {/* Max players */}
          <Section label={t('multiplayer.config.sectionMaxPlayers')}>
            <ChipGroup options={MAX_PLAYER_OPTIONS.map(n => ({ value: n, label: String(n) }))} value={maxPlayers} onChange={setMaxPlayers} />
          </Section>

          {/* Source */}
          <Section label={t('multiplayer.config.sectionSource')}>
            <div className="grid grid-cols-2 gap-2">
              <SourceButton
                testId="qm-source-database"
                active={source === 'DATABASE'}
                onClick={() => setSource('DATABASE')}
                icon="storage"
                title={t('multiplayer.config.sourceDatabase')}
                desc={t('multiplayer.config.sourceDatabaseDesc')}
              />
              <SourceButton
                testId="qm-source-ai"
                active={source === 'AI_GENERATED'}
                onClick={() => aiUnlocked && setSource('AI_GENERATED')}
                disabled={!aiUnlocked}
                icon="auto_awesome"
                title={t('multiplayer.config.sourceAi')}
                desc={aiUnlocked ? t('multiplayer.config.sourceAiUnlocked') : t('multiplayer.config.sourceAiLocked')}
              />
            </div>
          </Section>

          {error && (
            <div
              data-testid="qm-error"
              className="px-3 py-2 rounded-lg text-[12px]"
              style={{ background: 'rgba(179,69,47,0.10)', border: '1px solid rgba(179,69,47,0.25)', color: '#B3452F' }}
            >
              ⚠ {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="button"
            data-testid="qm-submit"
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-lg text-[14px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: `linear-gradient(135deg, ${INDIGO} 0%, #2F6FB0 100%)` }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>rocket_launch</span>
            {submitting ? t('multiplayer.config.submitting') : t('multiplayer.config.submit')}
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
          </button>
          <p className="text-[10.5px] text-center text-bq-ink3 mt-1">
            {t('multiplayer.config.footer')}
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Local subs ───────────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[12px] font-bold text-bq-ink2 mb-1.5">{label}</div>
      {children}
    </div>
  )
}

function ChipGroup<T extends string | number>({
  options, value, onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex gap-1 p-1 rounded-lg" style={{ background: '#EFE3C3', border: '1px solid #C9B58C' }}>
      {options.map(o => {
        const active = o.value === value
        return (
          <button
            key={String(o.value)}
            type="button"
            onClick={() => onChange(o.value)}
            className="flex-1 py-1.5 rounded-md text-[12px] transition-all"
            style={{
              background: active ? `linear-gradient(135deg, ${INDIGO}, #2F6FB0)` : 'transparent',
              color: active ? '#fff' : '#4D3A1F',
              fontWeight: active ? 700 : 500,
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function SourceButton({
  active, onClick, disabled, icon, title, desc, testId,
}: {
  active: boolean; onClick: () => void; disabled?: boolean;
  icon: string; title: string; desc: string; testId?: string
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      data-active={active}
      data-disabled={disabled ? 'true' : undefined}
      onClick={onClick}
      disabled={disabled}
      className="flex items-start gap-2 p-3 rounded-lg text-left transition-colors disabled:cursor-not-allowed"
      style={{
        background: active ? hexAlpha(INDIGO, 0.12) : '#EFE3C3',
        border: `1px solid ${active ? INDIGO : '#C9B58C'}`,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span
        className="material-symbols-outlined flex-shrink-0"
        style={{ fontSize: 18, color: active ? INDIGO : '#2F6FB0', fontVariationSettings: "'FILL' 1" }}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <div className={`text-[12px] font-bold ${active ? 'text-bq-ink' : 'text-bq-ink2'}`}>{title}</div>
        <div className="text-[10px] text-bq-ink3 mt-0.5">{desc}</div>
      </div>
    </button>
  )
}

function modeLabel(id: RoomModeId): string {
  switch (id) {
    case 'SPEED_RACE':    return 'Speed Race'
    case 'BATTLE_ROYALE': return 'Battle Royale'
    case 'TEAM_VS_TEAM':  return 'Team vs Team'
    case 'SUDDEN_DEATH':  return 'Đấu vương'
  }
}

function hexAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`
}

// Reference MODE_META to satisfy unused-import lint (we use MODE_LIST/MODE_META.icon).
void MODE_META
