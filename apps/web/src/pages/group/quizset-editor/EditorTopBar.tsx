import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type { PublishStatus } from '../../../api/quizSets'
import { ACTION_BG, ACTION_BG_DISABLED, ACTION_FG, ACTION_SHADOW, COLOR, INSET_BG } from './styles'

interface Props {
  backHref: string
  ownerName?: string
  quizSetName: string
  status: PublishStatus
  lastSavedAgoSec: number | null
  saving: boolean
  questionCount: number
  /** Omit to hide the AI quota badge (personal scope in Phase 1). */
  aiUsed?: number
  aiLimit?: number
  onPublish: () => void
  onSaveDraft: () => void
  canPublish: boolean
}

function statusBadge(t: TFunction, status: PublishStatus, savedAgo: number | null, saving: boolean) {
  if (status === 'DRAFT') {
    let label: string
    if (saving) label = t('quizSet.editor.topbar.saving')
    else if (savedAgo == null) label = t('quizSet.editor.topbar.draft')
    else label = t('quizSet.editor.topbar.draftSavedAgo', { ago: formatAgo(t, savedAgo) })
    return { bg: 'rgba(245,158,11,0.12)', color: COLOR.warning, label }
  }
  if (status === 'PUBLISHED') return { bg: 'rgba(46,125,79,0.12)', color: COLOR.success, label: t('quizSet.editor.topbar.published') }
  if (status === 'ARCHIVED')  return { bg: 'rgba(168,166,156,0.16)', color: COLOR.textMuted, label: t('quizSet.editor.topbar.archived') }
  return { bg: 'rgba(179,69,47,0.12)', color: COLOR.danger, label: t('quizSet.editor.topbar.deleted') }
}

function formatAgo(t: TFunction, sec: number): string {
  if (sec < 60) return t('quizSet.editor.topbar.agoSec', { n: sec })
  if (sec < 3600) return t('quizSet.editor.topbar.agoMin', { n: Math.floor(sec / 60) })
  return t('quizSet.editor.topbar.agoHour', { n: Math.floor(sec / 3600) })
}

export default function EditorTopBar({
  backHref, ownerName, quizSetName, status, lastSavedAgoSec, saving,
  questionCount, aiUsed, aiLimit, onPublish, onSaveDraft, canPublish,
}: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const badge = statusBadge(t, status, lastSavedAgoSec, saving)
  const showAi = typeof aiUsed === 'number' && typeof aiLimit === 'number' && aiLimit > 0

  return (
    <div style={{
      background: COLOR.bgPanel,
      borderBottom: `1px solid ${COLOR.borderXSubtle}`,
      padding: '14px 24px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      flexWrap: 'wrap',
    }}>
      <button
        onClick={() => navigate(backHref)}
        style={{
          background: 'transparent', border: 'none', color: COLOR.textMuted, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, padding: '6px 10px', borderRadius: 6,
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 16 }} aria-hidden>arrow_back</span> {t('quizSet.editor.topbar.back')}
      </button>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, minWidth: 200 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 18, color: COLOR.gold }} aria-hidden>menu_book</span>
        <div style={{ fontSize: 14, color: COLOR.textPrimary, fontWeight: 500 }}>
          {quizSetName || t('quizSet.editor.topbar.defaultName')}
        </div>
        {ownerName && (
          <>
            <span style={{ color: COLOR.textDisabled, fontSize: 12 }}>·</span>
            <div style={{ fontSize: 12, color: COLOR.textMuted }}>{ownerName}</div>
          </>
        )}
        <span style={{
          background: badge.bg, color: badge.color,
          fontSize: 10, padding: '3px 8px', borderRadius: 999,
          fontWeight: 500, letterSpacing: 0.5, marginLeft: 4, whiteSpace: 'nowrap',
        }}>{badge.label}</span>
      </div>

      {showAi && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          background: COLOR.goldBg, border: `1px solid rgba(245,158,11,0.30)`,
          padding: '4px 9px', borderRadius: 999, fontSize: 11, color: COLOR.gold,
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 12 }} aria-hidden>auto_awesome</span>
          <span>AI: {aiUsed}/{aiLimit}</span>
        </div>
      )}

      <button onClick={onSaveDraft} disabled={saving} style={{
        background: INSET_BG, color: COLOR.textSecondary,
        border: `1px solid ${COLOR.borderSubtle}`,
        padding: '8px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
        opacity: saving ? 0.6 : 1,
      }}>{t('quizSet.editor.topbar.saveDraft')}</button>

      {(() => {
        // Button has 2 modes:
        //   DRAFT     → "Publish (N qs)" — enabled only when canPublish (≥5 qs + name ≥3 chars)
        //   PUBLISHED → "Save changes"   — enabled whenever not currently saving
        const enabled = status === 'PUBLISHED' ? !saving : canPublish
        return (
          <button onClick={onPublish} disabled={!enabled} style={{
            background: enabled ? ACTION_BG : ACTION_BG_DISABLED,
            color: ACTION_FG, border: 'none', padding: '8px 18px', borderRadius: 8,
            fontSize: 13, fontWeight: 600, cursor: enabled ? 'pointer' : 'not-allowed',
            display: 'inline-flex', alignItems: 'center', gap: 5,
            boxShadow: enabled ? ACTION_SHADOW : 'none',
            opacity: enabled ? 1 : 0.6,
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }} aria-hidden>
              {status === 'PUBLISHED' ? 'save' : 'rocket_launch'}
            </span>
            {status === 'PUBLISHED'
              ? t('quizSet.editor.topbar.saveChanges')
              : t('quizSet.editor.topbar.publishWithCount', { count: questionCount })}
          </button>
        )
      })()}
    </div>
  )
}
