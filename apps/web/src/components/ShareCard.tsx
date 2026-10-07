import { useTranslation } from 'react-i18next'
import i18n from '../i18n'
import { getApiBaseUrl } from '../api/config'

const FILL_1: React.CSSProperties = { fontVariationSettings: "'FILL' 1" }

function localeTag(): string {
  return i18n.language?.startsWith('en') ? 'en-US' : 'vi-VN'
}

interface ShareCardProps {
  sessionId?: string
  score?: number
  correct?: number
  total?: number
  userName: string
  tierName?: string
  oldTierName?: string
  date?: string
  percentile?: number
  type?: 'session' | 'daily' | 'tier_up'
  referenceId?: string
}

export default function ShareCard({
  sessionId,
  score = 0,
  correct = 0,
  total = 5,
  userName,
  tierName,
  oldTierName,
  date,
  percentile,
  type = 'session',
  referenceId,
}: ShareCardProps) {
  const { t } = useTranslation()
  const apiBase = getApiBaseUrl()
  const shareUrl =
    type === 'tier_up' && referenceId
      ? `${apiBase}/api/share/render/tier-up/${referenceId}`
      : type === 'daily'
        ? `${apiBase}/api/share/render/daily/${date || new Date().toISOString().slice(0, 10)}`
        : `${apiBase}/api/share/render/session/${sessionId}`

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
    } catch {
      // fallback
    }
  }

  const handleShare = async () => {
    const shareText = type === 'tier_up'
      ? t('components.shareCard.shareTextTierUp', { tier: tierName ?? '' })
      : t('components.shareCard.shareTextResult', { correct, total })
    if (navigator.share) {
      try {
        await navigator.share({ title: 'BibleQuiz', text: shareText, url: shareUrl })
      } catch { /* cancelled */ }
    } else {
      handleCopyUrl()
    }
  }

  const handleDownload = () => {
    window.open(shareUrl, '_blank')
  }

  const pct = total > 0 ? (correct / total) * 100 : 0
  const circumference = 2 * Math.PI * 45
  const strokeOffset = circumference - (pct / 100) * circumference

  return (
    <div className="space-y-4">
      {/* Card preview */}
      <div className="max-w-sm mx-auto rounded-2xl overflow-hidden border border-bq-hair shadow-bq-soft">
        {/* Card background */}
        <div className="bg-bq-white p-6 space-y-5">
          {/* Logo header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-bq-amberd text-lg" style={FILL_1}>menu_book</span>
              <span className="text-bq-amberd font-black text-sm tracking-tight">BibleQuiz</span>
            </div>
            <div className="h-px flex-1 mx-3 bg-bq-amber/20" />
          </div>

          {type === 'tier_up' ? (
            /* ── Tier Up Variant ── */
            <div className="text-center space-y-4 py-4">
              <span className="material-symbols-outlined text-5xl text-bq-amberd" style={FILL_1}>celebration</span>
              <div>
                <p className="text-xs font-bold text-bq-ink2 uppercase tracking-widest mb-1">{t('components.shareCard.tierUpLabel')}</p>
                <p className="text-2xl font-black text-bq-ink">{oldTierName}</p>
                <span className="material-symbols-outlined text-bq-amberd text-2xl my-2">arrow_downward</span>
                <p className="text-3xl font-black text-bq-amberd">{tierName}</p>
              </div>
            </div>
          ) : type === 'daily' ? (
            /* ── Daily Challenge Variant ── */
            <div className="text-center space-y-4 py-2">
              <p className="text-xs font-bold text-bq-ink2 uppercase tracking-widest">
                {t('components.shareCard.dailyLabelPrefix', { date: date || new Date().toLocaleDateString(localeTag()) })}
              </p>
              {/* Stars */}
              <div className="flex justify-center gap-1.5">
                {Array.from({ length: total }).map((_, i) => (
                  <span
                    key={i}
                    className={`material-symbols-outlined text-3xl ${i < correct ? 'text-bq-amberd' : 'text-bq-ink3/30'}`}
                    style={FILL_1}
                  >
                    star
                  </span>
                ))}
              </div>
              <p className="text-bq-ink font-bold text-lg">{t('components.shareCard.correctCount', { correct, total })}</p>
              {percentile && (
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-bq-amber/10 border border-bq-amber/20">
                  <span className="material-symbols-outlined text-bq-amberd text-sm" style={FILL_1}>emoji_events</span>
                  <span className="text-sm font-bold text-bq-amberd">{t('components.shareCard.percentileBadge', { percentile })}</span>
                </div>
              )}
            </div>
          ) : (
            /* ── Quiz Result Variant (default) ── */
            <div className="text-center space-y-4 py-2">
              {/* Score circle */}
              <div className="relative w-28 h-28 mx-auto">
                <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="transparent" stroke="#E7E4DA" strokeWidth="6" />
                  <circle
                    cx="50" cy="50" r="45" fill="transparent"
                    stroke="#F59E0B" strokeWidth="6" strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeOffset}
                    className="transition-all duration-700"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-black text-bq-ink">{correct}/{total}</span>
                </div>
              </div>
              <p className="text-xs font-bold text-bq-ink2 uppercase tracking-widest">
                {pct >= 90
                  ? t('components.shareCard.ratingExcellent')
                  : pct >= 70
                    ? t('components.shareCard.ratingGood')
                    : t('components.shareCard.ratingTryHarder')}
              </p>
              {score > 0 && (
                <p className="text-sm text-bq-amberd font-bold">+{score} XP</p>
              )}
            </div>
          )}

          {/* User info */}
          <div className="flex items-center gap-3 pt-2 border-t border-bq-hair">
            <div className="w-8 h-8 rounded-full bg-bq-amber/15 flex items-center justify-center">
              <span className="material-symbols-outlined text-bq-amberd text-sm" style={FILL_1}>person</span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-bq-ink">{userName}</p>
              {tierName && type !== 'tier_up' && (
                <p className="text-[10px] text-bq-amberd font-bold uppercase tracking-wider">{tierName}</p>
              )}
            </div>
          </div>

          {/* Watermark */}
          <p className="text-center text-[10px] text-bq-ink2/50 font-medium">forbible.org</p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 justify-center max-w-sm mx-auto">
        <button
          onClick={handleShare}
          className="flex-1 py-3 bg-bq-action text-bq-ink font-bold rounded-xl shadow-bq-action active:scale-95 transition-all flex items-center justify-center gap-2 text-sm"
        >
          <span className="material-symbols-outlined text-lg">share</span>
          {t('components.shareCard.shareButton')}
        </button>
        <button
          onClick={handleCopyUrl}
          className="py-3 px-5 bg-bq-inset border border-bq-hair text-bq-ink2 font-bold rounded-xl hover:text-bq-ink transition-colors flex items-center justify-center gap-2 text-sm"
        >
          <span className="material-symbols-outlined text-lg">content_copy</span>
        </button>
        <button
          onClick={handleDownload}
          className="py-3 px-5 bg-bq-inset border border-bq-hair text-bq-ink2 font-bold rounded-xl hover:text-bq-ink transition-colors flex items-center justify-center gap-2 text-sm"
        >
          <span className="material-symbols-outlined text-lg">download</span>
        </button>
      </div>
    </div>
  )
}
