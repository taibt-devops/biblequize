import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../../api/client'
import { useAuthStore } from '../../store/authStore'

export function DeleteAccountSection() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [showModal, setShowModal] = useState(false)
  const [confirmPhrase, setConfirmPhrase] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const expectedPhrase = t('profile.deleteAccountConfirmPhrase')
  const isValid = confirmPhrase === expectedPhrase

  const handleDelete = async () => {
    setDeleting(true)
    setError('')
    try {
      await api.delete('/api/me/account', { data: { confirmPhrase } })
      useAuthStore.getState().logout()
      localStorage.clear()
      navigate('/login')
    } catch (e: any) {
      setError(e.response?.data?.error ?? e.userMessage ?? t('common.error'))
      setDeleting(false)
    }
  }

  return (
    <section className="rounded-2xl p-5 bg-error/[0.04] border border-error/20 flex flex-col sm:flex-row items-start sm:items-center gap-4">
      <div className="w-10 h-10 rounded-xl bg-error/15 text-error flex items-center justify-center shrink-0">
        <span className="material-symbols-outlined">warning</span>
      </div>
      <div className="flex-1">
        <p className="text-[13px] font-bold text-error">{t('profile.dangerZone')}</p>
        <p className="text-[11px] text-bq-ink2 mt-1">{t('profile.dangerDesc')}</p>
      </div>
      <button
        data-testid="profile-delete-account-btn"
        onClick={() => setShowModal(true)}
        className="h-10 px-4 rounded-xl bg-error/10 border border-error/30 text-error text-sm font-semibold hover:bg-error/20 transition-colors inline-flex items-center gap-1.5 self-start sm:self-auto"
      >
        <span className="material-symbols-outlined text-[18px]">delete_forever</span>
        {t('profile.deleteAccount')}
      </button>

      {showModal && (
        <div data-testid="delete-account-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(29,43,34,0.45)] backdrop-blur-sm p-4">
          <div className="bg-bq-white border border-bq-hair shadow-bq-soft rounded-2xl max-w-md w-full p-6 space-y-4">
            <h2 className="font-display text-xl font-bold text-error">{t('profile.deleteAccountTitle')}</h2>
            <div className="bg-error/10 border border-error/30 rounded-lg p-4">
              <p className="text-sm text-error">{t('profile.deleteAccountWarning')}</p>
              <ul className="text-sm text-error/80 mt-2 space-y-1 list-disc pl-5">
                <li>{t('profile.deleteAccountData1')}</li>
                <li>{t('profile.deleteAccountData2')}</li>
                <li>{t('profile.deleteAccountData3')}</li>
                <li>{t('profile.deleteAccountData4')}</li>
              </ul>
            </div>
            <p className="text-sm text-bq-ink2">
              {t('profile.deleteAccountConfirmLabel', { phrase: expectedPhrase })}
            </p>
            <input
              data-testid="profile-delete-confirm-input"
              type="text"
              value={confirmPhrase}
              onChange={(e) => setConfirmPhrase(e.target.value)}
              placeholder={expectedPhrase}
              className="w-full bg-bq-inset border border-bq-hair rounded-lg px-3 py-2 text-bq-ink text-sm focus:border-error outline-none"
            />
            {error && <p className="text-sm text-error">{error}</p>}
            <div className="flex gap-3">
              <button
                data-testid="delete-account-cancel-btn"
                onClick={() => { setShowModal(false); setConfirmPhrase(''); setError('') }}
                className="flex-1 px-4 py-2 rounded-lg border border-bq-hair text-bq-ink2 text-sm hover:bg-bq-inset"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleDelete}
                disabled={!isValid || deleting}
                className="flex-1 bg-error text-on-error rounded-lg py-2 text-sm font-semibold disabled:opacity-30 transition-opacity"
              >
                {deleting ? t('profile.deleteAccountDeleting') : t('profile.deleteAccountBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
