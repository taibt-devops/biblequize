import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'
import type { UserProfile } from './types'
import { AVATAR_PRESETS, isPresetValue, toPresetValue } from '../../data/avatars'
import { isOAuthAvatarUrl, resolveAvatar } from '../../utils/avatar'
import { useAuthStore } from '../../store/authStore'

const NAME_MAX = 50
// "Khung Sáng" amber accent (light theme). amber-deep is contrast-safe on
// the white modal surface.
const GOLD = '#D97F06'

export function EditProfileModal({ open, onClose, profile }: {
  open: boolean
  onClose: () => void
  profile: UserProfile
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const updateProfile = useAuthStore(s => s.updateProfile)
  const initialAvatar = profile.avatarUrl ?? ''
  const [name, setName] = useState(profile.name)
  const [pendingAvatar, setPendingAvatar] = useState(initialAvatar)
  const [presetGridOpen, setPresetGridOpen] = useState(false)
  const [fieldError, setFieldError] = useState<string | null>(null)

  // Reset form whenever the modal is (re-)opened so a previously cancelled
  // edit doesn't bleed into the next session.
  useEffect(() => {
    if (open) {
      setName(profile.name)
      setPendingAvatar(profile.avatarUrl ?? '')
      setPresetGridOpen(false)
      setFieldError(null)
    }
  }, [open, profile.name, profile.avatarUrl])

  const mutation = useMutation({
    mutationFn: (updates: { name: string; avatarUrl: string }) =>
      api.patch('/api/me', updates).then(r => r.data),
    onSuccess: (data, variables) => {
      // Sync header dropdown + sidebar (read authStore.user) right away so the
      // new name/avatar don't lag behind the profile page until next reload.
      updateProfile({
        name: data?.name ?? variables.name,
        avatar: data?.avatarUrl ?? variables.avatarUrl,
      })
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      onClose()
    },
  })

  if (!open) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed.length === 0) { setFieldError(t('profile.editErrorEmpty')); return }
    if (trimmed.length > NAME_MAX) { setFieldError(t('profile.editErrorTooLong', { max: NAME_MAX })); return }
    setFieldError(null)
    mutation.mutate({ name: trimmed, avatarUrl: pendingAvatar })
  }

  const submitError = mutation.isError
    ? ((mutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('profile.editErrorGeneric'))
    : null

  // Google/Facebook OAuth picture from the original profile — surfaced as a
  // dedicated "use account photo" tile inside the preset grid.
  const googleAvatar = isOAuthAvatarUrl(profile.avatarUrl) ? profile.avatarUrl! : null
  const resolved = resolveAvatar(pendingAvatar, name)

  return (
    <div
      data-testid="edit-profile-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(29,43,34,0.45)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-md rounded-3xl bg-bq-white border border-bq-hair shadow-bq-soft p-6 md:p-7 space-y-5"
      >
        <button
          type="button"
          aria-label={t('profile.editClose')}
          data-testid="edit-profile-close"
          onClick={onClose}
          disabled={mutation.isPending}
          className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center hover:bg-bq-inset transition-colors disabled:opacity-50"
          style={{ color: GOLD }}
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        <h2 className="font-display text-xl font-extrabold text-bq-ink tracking-tight pr-10">
          {t('profile.editModalTitle')}
        </h2>

        {/* Avatar preview + change controls */}
        <div className="flex flex-col items-center gap-3">
          <div
            data-testid="edit-profile-avatar-preview"
            className="w-[92px] h-[92px] rounded-full overflow-hidden flex items-center justify-center shrink-0"
            style={{
              border: `2px solid ${GOLD}`,
              boxShadow: `0 0 24px ${GOLD}40, 0 8px 20px rgba(20,20,30,0.12)`,
              background: resolved.kind === 'preset' ? resolved.preset.bg : 'linear-gradient(135deg, #EFE3C3, #FFFFFF)',
            }}
          >
            {resolved.kind === 'img' && (
              <img alt="" src={resolved.src} className="w-full h-full object-cover" />
            )}
            {resolved.kind === 'preset' && (
              <span className="text-[72px] leading-none" aria-hidden>{resolved.preset.emoji}</span>
            )}
            {resolved.kind === 'initial' && (
              <span
                className="font-verse italic font-bold"
                style={{ color: GOLD, fontSize: '46px', lineHeight: 1 }}
                aria-hidden
              >
                {resolved.initial}
              </span>
            )}
          </div>

          <button
            type="button"
            data-testid="edit-profile-avatar-toggle"
            onClick={() => setPresetGridOpen(v => !v)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors"
            style={{ color: GOLD, border: `1px solid ${GOLD}66`, background: `${GOLD}14` }}
          >
            <span className="material-symbols-outlined text-[16px]">photo_camera</span>
            {t('profile.editAvatarChange')}
          </button>

          {presetGridOpen && (
            <div
              data-testid="edit-profile-preset-grid"
              className="w-full rounded-2xl bg-bq-inset p-3 mt-1"
              style={{ border: `1px solid ${GOLD}26` }}
            >
              <p className="text-[12.5px] font-bold text-bq-ink2 mb-2">
                {t('profile.editAvatarPresetsHeading')}
              </p>
              <div className="grid grid-cols-6 gap-2">
                {googleAvatar && (
                  <button
                    type="button"
                    data-testid="edit-profile-avatar-google"
                    aria-label={t('profile.editAvatarUseGoogle')}
                    onClick={() => setPendingAvatar(googleAvatar)}
                    className="relative w-full aspect-square rounded-full overflow-hidden transition-transform hover:scale-105"
                    style={{
                      border: pendingAvatar === googleAvatar ? `2px solid ${GOLD}` : '2px solid transparent',
                      boxShadow: pendingAvatar === googleAvatar ? `0 0 0 2px ${GOLD}55` : 'none',
                    }}
                  >
                    <img src={googleAvatar} alt="" className="w-full h-full object-cover" />
                    <span
                      className="absolute -bottom-0.5 -right-0.5 text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center"
                      style={{ background: GOLD, color: '#FFFFFF' }}
                      aria-hidden
                    >G</span>
                  </button>
                )}
                {AVATAR_PRESETS.map(p => {
                  const selected = isPresetValue(pendingAvatar) && pendingAvatar === toPresetValue(p.id)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      data-testid={`edit-profile-preset-${p.id}`}
                      aria-label={t(p.labelKey, { defaultValue: p.id })}
                      onClick={() => setPendingAvatar(toPresetValue(p.id))}
                      className="w-full aspect-square rounded-full flex items-center justify-center text-2xl transition-transform hover:scale-105"
                      style={{
                        background: p.bg,
                        border: selected ? `2px solid ${GOLD}` : `1px solid ${GOLD}26`,
                        boxShadow: selected ? `0 0 0 2px ${GOLD}55` : 'none',
                      }}
                    >
                      <span aria-hidden>{p.emoji}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Name field */}
        <label className="block">
          <span className="text-[13px] font-bold text-bq-ink2">
            {t('profile.editFieldName')}
          </span>
          <div
            className="mt-1 flex items-center gap-2 rounded-xl bg-bq-inset px-3 py-2 transition-colors focus-within:border-[color:var(--tw-ring-color)]"
            style={{
              border: `1px solid ${GOLD}26`,
            }}
          >
            <span className="material-symbols-outlined text-[18px]" style={{ color: GOLD }} aria-hidden>person</span>
            <input
              data-testid="edit-profile-name-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={NAME_MAX + 10}
              className="flex-1 bg-transparent outline-none text-bq-ink text-sm placeholder:text-bq-ink3"
              onFocus={(e) => { e.currentTarget.parentElement!.style.border = `1px solid ${GOLD}` }}
              onBlur={(e) => { e.currentTarget.parentElement!.style.border = `1px solid ${GOLD}26` }}
            />
            <span className="text-[10px] text-bq-ink2 tabular-nums">{name.length}/{NAME_MAX}</span>
          </div>
        </label>

        {/* Email read-only */}
        <div
          data-testid="edit-profile-email-row"
          className="flex items-center gap-2 rounded-xl bg-bq-inset px-3 py-2"
          style={{
            border: `1px dashed ${GOLD}40`,
          }}
        >
          <span className="material-symbols-outlined text-[18px] text-bq-ink2" aria-hidden>mail</span>
          <span className="text-sm text-bq-ink2 truncate flex-1">{profile.email}</span>
          <span
            className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{ background: `${GOLD}1a`, color: GOLD, border: `1px solid ${GOLD}40` }}
          >
            <span aria-hidden>🔒</span>
            <span>{t('profile.editEmailReadOnlyChip')}</span>
          </span>
        </div>

        {(fieldError || submitError) && (
          <p data-testid="edit-profile-error" className="text-sm text-error">{fieldError ?? submitError}</p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 hover:bg-bq-inset"
            style={{ border: `1px solid ${GOLD}40`, color: GOLD }}
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            data-testid="edit-profile-submit"
            disabled={mutation.isPending}
            className="rounded-xl py-2.5 text-sm font-bold text-bq-ink bg-bq-action shadow-bq-action disabled:opacity-50 transition-opacity hover:opacity-90"
            style={{ flex: '1.5 1 0' }}
          >
            {mutation.isPending ? t('profile.editSaving') : t('profile.editSubmit')}
          </button>
        </div>
      </form>
    </div>
  )
}
