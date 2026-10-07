import { useState, useEffect, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../store/authStore'
import PageMeta from '../components/PageMeta'
import { isCapacitor } from '../platform/capacitor'

export default function Login() {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchParams] = useSearchParams()
  const { isAuthenticated, login } = useAuth()
  const navigate = useNavigate()

  // Form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    const errorParam = searchParams.get('error')
    if (errorParam) {
      switch (errorParam) {
        case 'oauth_failed':
          setError(t('auth.errorOAuthFailed'))
          break
        case 'no_tokens':
          setError(t('auth.errorNoTokens'))
          break
        case 'processing_failed':
          setError(t('auth.errorProcessingFailed'))
          break
        default:
          setError(t('auth.errorDefault'))
      }
    }
  }, [searchParams, t])

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true })
    }
  }, [isAuthenticated, navigate])

  const handleGoogleLogin = async () => {
    setError(null)
    setIsGoogleLoading(true)

    // Mobile (Capacitor): native Google Sign-In → idToken → backend verify.
    // A full-page OAuth redirect would navigate the WebView away from the app.
    if (isCapacitor()) {
      try {
        const { nativeGoogleIdToken } = await import('../api/nativeGoogleAuth')
        const { mobileGoogle } = await import('../api/mobileAuth')
        const idToken = await nativeGoogleIdToken()
        const result = await mobileGoogle(idToken)
        login({
          accessToken: result.accessToken,
          name: result.name,
          email: result.email,
          avatar: result.avatar || undefined,
          role: result.role,
        })
        navigate('/', { replace: true })
      } catch (err: any) {
        setError(err?.message || t('auth.errorOAuthFailed'))
      } finally {
        setIsGoogleLoading(false)
      }
      return
    }

    // Web: redirect to the backend's OAuth2 authorization endpoint.
    window.location.href = `${import.meta.env.VITE_API_BASE_URL || ''}/oauth2/authorization/google`
  }

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      if (isCapacitor()) {
        // Mobile: token-in-body login endpoint (persists refresh token).
        const { mobileLogin } = await import('../api/mobileAuth')
        const result = await mobileLogin(email.trim(), password)
        login({
          accessToken: result.accessToken,
          name: result.name,
          email: result.email,
          avatar: result.avatar || undefined,
          role: result.role,
        })
        navigate('/', { replace: true })
        return
      }

      const { api } = await import('../api/client')
      const res = await api.post('/api/auth/login', {
        email: email.trim(),
        password,
      })
      const { accessToken, name: userName, email: userEmail, avatar, role } = res.data
      login({ accessToken, name: userName, email: userEmail, avatar: avatar || undefined, role })
      navigate('/', { replace: true })
    } catch (err: any) {
      const message = err.response?.data?.message
      setError(message || t('auth.errorInvalid'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="flex min-h-dvh bg-bq-paper">
      <PageMeta title={t('auth.login')} canonicalPath="/login" />
      {/* Left Side: Hero Section (60%) */}
      <section className="hidden md:flex md:w-[55%] lg:w-[60%] relative overflow-hidden bg-bq-paper">
        <div className="absolute inset-0 z-0">
          {/* Light-well glow */}
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
              {t('auth.discoverWord')} <br />
              <span className="text-bq-amberd italic font-light">{t('auth.throughGames')}</span>
            </h1>
            <p className="text-xl text-bq-ink2 font-light max-w-lg leading-relaxed">
              {t('auth.heroDesc')}
            </p>
          </div>
          {/* Scriptural Accent Block */}
          <div className="mt-12 flex items-center gap-4">
            <div className="h-12 w-1 bg-bq-spectrum rounded-full" />
            <p className="font-literata italic text-bq-ink2 font-medium">
              "{t('landing.verseText')}"
            </p>
          </div>
        </div>
      </section>

      {/* Right Side: Login Form (40%) */}
      <section className="w-full md:w-[45%] lg:w-[40%] flex flex-col justify-center items-center px-5 sm:px-12 lg:px-24 py-12 md:py-0 bg-bq-paper relative">
        <div className="w-full max-w-md space-y-6 sm:space-y-8 bg-bq-white border border-bq-hair shadow-bq-soft rounded-bq p-8 sm:p-10">
          {/* Brand Anchor */}
          <div className="flex flex-col items-center mb-10">
            <div className="w-16 h-16 rounded-xl bg-bq-spectrum flex items-center justify-center mb-4 shadow-bq-soft">
              <span
                className="material-symbols-outlined text-white text-4xl"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                menu_book
              </span>
            </div>
            <span className="text-2xl font-bold text-bq-amberd uppercase tracking-[0.2em]">
              Bible Quiz
            </span>
          </div>

          <div className="space-y-2 text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight text-bq-ink">{t('auth.welcomeBack')}</h2>
            <p className="text-bq-ink2">{t('auth.loginToContinue')}</p>
          </div>

          {/* Error Message */}
          {error && (
            <div data-testid="login-error-msg" className="flex items-start gap-3 px-4 py-3 rounded-xl bg-bq-ruby/10 border border-bq-ruby/30">
              <span className="material-symbols-outlined text-bq-ruby text-sm mt-0.5">error</span>
              <p className="text-sm text-bq-ruby">{error}</p>
            </div>
          )}

          <div className="mt-8 space-y-6">
            {/* Google OAuth — keep Google branding (white surface + colored mark) */}
            <button
              data-testid="login-google-btn"
              onClick={handleGoogleLogin}
              disabled={isGoogleLoading || isLoading}
              className="w-full py-3.5 px-4 rounded-xl bg-bq-white border border-bq-hair text-bq-ink font-bold flex items-center justify-center gap-3 transition-all duration-300 hover:scale-[1.02] hover:bg-bq-inset active:scale-95 shadow-bq-soft disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isGoogleLoading ? (
                <span className="material-symbols-outlined animate-spin text-xl text-bq-amberd">progress_activity</span>
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
              )}
              {isGoogleLoading ? t('auth.loggingIn') : t('auth.continueWithGoogle')}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-4">
              <div className="h-[1px] flex-1 bg-bq-hair" />
              <span className="text-xs uppercase tracking-widest text-bq-ink3 font-bold">
                {t('auth.orLoginWith')}
              </span>
              <div className="h-[1px] flex-1 bg-bq-hair" />
            </div>

            {/* Traditional Login Form */}
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-bq-ink2 ml-1">
                  {t('auth.email')}
                </label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-bq-ink3 group-focus-within:text-bq-sapphire transition-colors">
                    mail
                  </span>
                  <input
                    data-testid="login-email-input"
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
                <div className="flex justify-between items-end ml-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-bq-ink2">
                    {t('auth.password')}
                  </label>
                  <a
                    href="#"
                    className="text-[10px] uppercase tracking-tighter font-bold text-bq-amberd/70 hover:text-bq-amberd transition-colors"
                  >
                    {t('auth.forgotPassword')}
                  </a>
                </div>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-bq-ink3 group-focus-within:text-bq-sapphire transition-colors">
                    lock
                  </span>
                  <input
                    data-testid="login-password-input"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full bg-bq-white border border-bq-hair rounded-xl py-4 pl-12 pr-4 text-bq-ink focus:ring-1 focus:ring-bq-sapphire placeholder:text-bq-ink3 transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                data-testid="login-submit-btn"
                type="submit"
                disabled={isLoading || isGoogleLoading}
                className="w-full py-4 mt-4 rounded-xl bg-bq-action text-bq-ink font-bold shadow-bq-action hover:scale-[1.02] transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {isLoading ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                    {t('auth.loggingIn')}
                  </>
                ) : (
                  <>
                    {t('auth.login')}
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Footer Links */}
          <div className="pt-8 flex flex-col items-center gap-4 border-t border-bq-hair">
            <p className="text-sm text-bq-ink2">
              {t('auth.noAccount')}{' '}
              <Link
                to="/register"
                className="text-bq-amberd font-bold hover:underline decoration-bq-amberd/30 underline-offset-4 ml-1"
              >
                {t('auth.registerNow')}
              </Link>
            </p>
            <Link
              data-testid="login-guest-link"
              to="/"
              className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-bq-ink3 hover:text-bq-ink transition-colors py-2 px-4 rounded-full bg-bq-inset"
            >
              <span className="material-symbols-outlined text-sm">stadium</span>
              {t('auth.guestPlay')}
            </Link>
          </div>
        </div>

        {/* Absolute Footer — desktop fixed, mobile static below content */}
        <footer className="lg:fixed lg:bottom-4 lg:right-4 mt-10 lg:mt-0 flex flex-wrap gap-x-4 gap-y-2 items-center justify-center">
          <a
            href="/privacy"
            className="text-[10px] sm:text-xs tracking-widest uppercase text-bq-ink3 hover:text-bq-amberd transition-opacity opacity-100 hover:opacity-80 whitespace-nowrap"
          >
            {t('landing.privacy')}
          </a>
          <a
            href="/terms"
            className="text-[10px] sm:text-xs tracking-widest uppercase text-bq-ink3 hover:text-bq-amberd transition-opacity opacity-100 hover:opacity-80 whitespace-nowrap"
          >
            {t('landing.terms')}
          </a>
          <span className="text-[10px] sm:text-xs tracking-widest uppercase text-bq-ink3 opacity-60 whitespace-nowrap">
            &copy; 2024 Bible Quiz
          </span>
        </footer>
      </section>
    </main>
  )
}
