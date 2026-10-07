import { useState, useEffect, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../store/authStore'
import { api } from '../api/client'
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
    <main className="flex min-h-dvh bg-bq-paper">
      <PageMeta title={t('auth.register', { defaultValue: 'Register' })} canonicalPath="/register" />

      {/* Left Hero (hidden on mobile) */}
      <section className="hidden md:flex md:w-[55%] lg:w-[60%] relative overflow-hidden bg-bq-paper">
        <div className="absolute inset-0 z-0">
          <div className="w-full h-full bg-gradient-to-br from-bq-amber/10 via-transparent to-bq-paper" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-bq-amber/10 rounded-full blur-[120px]" />
          {/* Spectrum wash at the top edge — refracted light identity */}
          <div className="absolute inset-x-0 top-0 h-1.5 bg-bq-spectrum opacity-80" />
        </div>
        <div className="relative z-10 flex flex-col justify-end p-20 w-full h-full">
          <div className="max-w-2xl">
            {/* Spectrum logo mark feel */}
            <div className="mb-8 inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-bq-spectrum shadow-bq-soft">
              <span
                className="material-symbols-outlined text-white text-4xl"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                menu_book
              </span>
            </div>
            <h1 className="font-display text-6xl font-extrabold tracking-tight leading-tight mb-6 text-bq-ink">
              {t('auth.joinUs', { defaultValue: 'Join the' })} <br />
              <span className="text-bq-amberd italic font-light">{t('auth.journeyBegins', { defaultValue: 'journey of faith' })}</span>
            </h1>
            <p className="text-xl text-bq-ink2 font-light max-w-lg leading-relaxed">
              {t('auth.registerHero', { defaultValue: 'Create your account to track progress, compete with others, and grow in scripture.' })}
            </p>
          </div>
          <div className="mt-12 flex items-center gap-4">
            <div className="h-12 w-1 bg-bq-spectrum rounded-full" />
            <p className="font-literata italic text-bq-ink2 font-medium">
              "{t('landing.verseText')}"
            </p>
          </div>
        </div>
      </section>

      {/* Right Form */}
      <section className="w-full md:w-[45%] lg:w-[40%] flex flex-col justify-center items-center px-8 sm:px-12 lg:px-24 py-12 md:py-0 bg-bq-paper relative">
        <div className="w-full max-w-md space-y-8 bg-bq-white border border-bq-hair shadow-bq-soft rounded-bq p-8 sm:p-10">
          <div className="flex flex-col items-center mb-10">
            <div className="w-16 h-16 rounded-xl bg-bq-spectrum flex items-center justify-center mb-4 shadow-bq-soft">
              <span className="material-symbols-outlined text-white text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                menu_book
              </span>
            </div>
            <span className="text-2xl font-bold text-bq-amberd uppercase tracking-[0.2em]">Bible Quiz</span>
          </div>

          <div className="space-y-2 text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight text-bq-ink">
              {t('auth.createAccount', { defaultValue: 'Create your account' })}
            </h2>
            <p className="text-bq-ink2">
              {t('auth.alreadyHaveAccount', { defaultValue: 'Already have an account?' })}{' '}
              <Link to="/login" className="text-bq-amberd font-bold hover:underline">
                {t('auth.login')}
              </Link>
            </p>
          </div>

          {error && (
            <div data-testid="register-error-msg" className="flex items-start gap-3 px-4 py-3 rounded-xl bg-bq-ruby/10 border border-bq-ruby/30">
              <span className="material-symbols-outlined text-bq-ruby text-sm mt-0.5">error</span>
              <p className="text-sm text-bq-ruby">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 mt-8">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-bq-ink2 ml-1">
                {t('auth.name', { defaultValue: 'Full Name' })}
              </label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-bq-ink3 group-focus-within:text-bq-sapphire transition-colors">
                  person
                </span>
                <input
                  data-testid="register-name-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full bg-bq-white border border-bq-hair rounded-xl py-4 pl-12 pr-4 text-bq-ink focus:ring-1 focus:ring-bq-sapphire placeholder:text-bq-ink3 transition-all"
                  placeholder={t('auth.namePlaceholder', { defaultValue: 'John Doe' })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-bq-ink2 ml-1">
                {t('auth.email')}
              </label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-bq-ink3 group-focus-within:text-bq-sapphire transition-colors">
                  mail
                </span>
                <input
                  data-testid="register-email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-bq-white border border-bq-hair rounded-xl py-4 pl-12 pr-4 text-bq-ink focus:ring-1 focus:ring-bq-sapphire placeholder:text-bq-ink3 transition-all"
                  placeholder="email@example.com"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-bq-ink2 ml-1">
                {t('auth.password')}
              </label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-bq-ink3 group-focus-within:text-bq-sapphire transition-colors">
                  lock
                </span>
                <input
                  data-testid="register-password-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full bg-bq-white border border-bq-hair rounded-xl py-4 pl-12 pr-4 text-bq-ink focus:ring-1 focus:ring-bq-sapphire placeholder:text-bq-ink3 transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-bq-ink2 ml-1">
                {t('auth.confirmPassword', { defaultValue: 'Confirm password' })}
              </label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-bq-ink3 group-focus-within:text-bq-sapphire transition-colors">
                  lock
                </span>
                <input
                  data-testid="register-confirm-password-input"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full bg-bq-white border border-bq-hair rounded-xl py-4 pl-12 pr-4 text-bq-ink focus:ring-1 focus:ring-bq-sapphire placeholder:text-bq-ink3 transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              data-testid="register-submit-btn"
              type="submit"
              disabled={isLoading}
              className="w-full py-4 mt-6 rounded-xl bg-bq-action text-bq-ink font-bold shadow-bq-action hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                  {t('auth.registering', { defaultValue: 'Registering...' })}
                </>
              ) : (
                <>
                  {t('auth.register', { defaultValue: 'Create account' })}
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </>
              )}
            </button>
          </form>

          <div className="pt-6 flex flex-col items-center gap-3 border-t border-bq-hair">
            <Link
              to="/"
              className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-bq-ink3 hover:text-bq-ink transition-colors py-2 px-4 rounded-full bg-bq-inset"
            >
              <span className="material-symbols-outlined text-sm">stadium</span>
              {t('auth.guestPlay')}
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
