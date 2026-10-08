import { useState, useEffect, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../store/authStore'
import { api } from '../api/client'
import { PlaceBackdrop, lkClass } from '../components/lk/Place'
import PageMeta from '../components/PageMeta'

export default function Register() {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { isAuthenticated, login } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true })
  }, [isAuthenticated, navigate])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError(t('auth.passwordMismatch', { defaultValue: 'Passwords do not match' }))
      return
    }
    if (password.length < 8) {
      setError(t('auth.passwordTooShort', { defaultValue: 'Password must be at least 8 characters' }))
      return
    }

    setIsLoading(true)
    try {
      const res = await api.post('/api/auth/register', {
        name: name.trim(),
        email: email.trim(),
        password,
      })
      const { accessToken, name: userName, email: userEmail, avatar, role } = res.data
      login({ accessToken, name: userName, email: userEmail, avatar: avatar || undefined, role })
      navigate('/', { replace: true })
    } catch (err: any) {
      const message = err.response?.data?.message
      setError(message || t('auth.errorRegister', { defaultValue: 'Registration failed' }))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="relative flex flex-col md:flex-row min-h-dvh">
      <PlaceBackdrop place="gate" veil="soft" focus="30% 60%" />
      <PageMeta title={t('auth.register', { defaultValue: 'Register' })} canonicalPath="/register" />

      {/* Left: the traveller setting off through the gate (hidden on mobile) */}
      <section className="hidden md:flex md:w-[55%] lg:w-[60%] relative items-end p-10 lg:p-16">
        <div className="relative max-w-xl">
          <img src="/images/lk/hero-cheer.webp" alt="" aria-hidden className={`h-[170px] lg:h-[210px] mb-4 ml-6 ${lkClass.bob}`} />
          <div className="bg-bq-white/90 border-[3px] border-bq-ink rounded-bq shadow-bq-card p-7 lg:p-8">
            <h1 className="m-0 font-display text-[40px] lg:text-[48px] font-extrabold leading-[1.08] text-bq-ink">
              {t('auth.joinUs', { defaultValue: 'Join the' })} {t('auth.journeyBegins', { defaultValue: 'journey of faith' })}
            </h1>
            <p className="m-0 mt-3 font-read text-[17px] text-bq-ink2 leading-relaxed">
              {t('auth.registerHero', { defaultValue: 'Create your account to track progress, compete with others, and grow in scripture.' })}
            </p>
            <p className="m-0 mt-5 pt-4 border-t-2 border-dashed border-bq-hair font-read italic text-[15px] text-bq-ink2">
              &ldquo;{t('landing.verseText')}&rdquo;
            </p>
          </div>
        </div>
      </section>

      {/* Right: the sign-up card */}
      <section className="w-full md:w-[45%] lg:w-[40%] flex flex-col justify-center items-center px-5 sm:px-10 lg:px-16 py-10 md:py-8 relative">
        <div className="w-full max-w-md space-y-6 bg-bq-white border-[3px] border-bq-ink shadow-bq-card rounded-bq p-7 sm:p-9">
          <div className="flex flex-col items-center">
            <img src="/images/lk/lantern-on.webp" alt="" aria-hidden className="h-16 mb-1" />
            <span className="font-display text-[28px] font-extrabold text-bq-ink leading-none">BibleQuiz</span>
          </div>

          <div className="space-y-1 text-center">
            <h2 className="m-0 font-display text-[28px] font-extrabold text-bq-ink">
              {t('auth.createAccount', { defaultValue: 'Create your account' })}
            </h2>
            <p className="m-0 font-read text-[15px] text-bq-ink2">
              {t('auth.alreadyHaveAccount', { defaultValue: 'Already have an account?' })}{' '}
              <Link to="/login" className="text-bq-ink font-extrabold underline decoration-bq-amber decoration-[3px] underline-offset-2">
                {t('auth.login')}
              </Link>
            </p>
          </div>

          {error && (
            <div data-testid="register-error-msg" className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-bq-white border-[3px] border-bq-ruby">
              <span className="material-symbols-outlined text-bq-ruby text-[18px] mt-0.5">error</span>
              <p className="m-0 text-[14px] font-bold text-bq-ruby">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 mt-8">
            <div className="space-y-1.5">
              <label className="text-[14px] font-extrabold text-bq-ink ml-1">
                {t('auth.name', { defaultValue: 'Full Name' })}
              </label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-bq-ink3 group-focus-within:text-bq-ink transition-colors">
                  person
                </span>
                <input
                  data-testid="register-name-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full bg-bq-paper border-[3px] border-bq-ink/30 rounded-2xl py-3.5 pl-12 pr-4 text-[16px] text-bq-ink focus:outline-none focus:border-bq-ink focus:ring-2 focus:ring-bq-amber placeholder:text-bq-ink3 transition-colors"
                  placeholder={t('auth.namePlaceholder', { defaultValue: 'John Doe' })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[14px] font-extrabold text-bq-ink ml-1">
                {t('auth.email')}
              </label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-bq-ink3 group-focus-within:text-bq-ink transition-colors">
                  mail
                </span>
                <input
                  data-testid="register-email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-bq-paper border-[3px] border-bq-ink/30 rounded-2xl py-3.5 pl-12 pr-4 text-[16px] text-bq-ink focus:outline-none focus:border-bq-ink focus:ring-2 focus:ring-bq-amber placeholder:text-bq-ink3 transition-colors"
                  placeholder="email@example.com"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[14px] font-extrabold text-bq-ink ml-1">
                {t('auth.password')}
              </label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-bq-ink3 group-focus-within:text-bq-ink transition-colors">
                  lock
                </span>
                <input
                  data-testid="register-password-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full bg-bq-paper border-[3px] border-bq-ink/30 rounded-2xl py-3.5 pl-12 pr-4 text-[16px] text-bq-ink focus:outline-none focus:border-bq-ink focus:ring-2 focus:ring-bq-amber placeholder:text-bq-ink3 transition-colors"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[14px] font-extrabold text-bq-ink ml-1">
                {t('auth.confirmPassword', { defaultValue: 'Confirm password' })}
              </label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-bq-ink3 group-focus-within:text-bq-ink transition-colors">
                  lock
                </span>
                <input
                  data-testid="register-confirm-password-input"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full bg-bq-paper border-[3px] border-bq-ink/30 rounded-2xl py-3.5 pl-12 pr-4 text-[16px] text-bq-ink focus:outline-none focus:border-bq-ink focus:ring-2 focus:ring-bq-amber placeholder:text-bq-ink3 transition-colors"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              data-testid="register-submit-btn"
              type="submit"
              disabled={isLoading}
              className="lk-btn w-full mt-4 text-bq-ink text-[17px]"
            >
              {isLoading ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                  {t('auth.registering', { defaultValue: 'Registering...' })}
                </>
              ) : (
                <>
                  {t('auth.register', { defaultValue: 'Create account' })}
                </>
              )}
            </button>
          </form>

          <div className="pt-5 flex flex-col items-center gap-3 border-t-2 border-dashed border-bq-hair">
            <Link
              to="/"
              className="flex items-center gap-2 text-[14px] font-bold text-bq-ink py-1.5 px-4 rounded-full bg-bq-leaf border-2 border-bq-ink no-underline hover:brightness-105"
            >
              <img src="/images/lk/sword.webp" alt="" aria-hidden className="h-5" />
              {t('auth.guestPlay')}
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
