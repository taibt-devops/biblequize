import { useState, useEffect, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../store/authStore'
import PageMeta from '../components/PageMeta'
import { PlaceBackdrop, lkClass } from '../components/lk/Place'
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
    <main className="relative flex flex-col md:flex-row min-h-dvh">
      <PlaceBackdrop place="gate" veil="soft" focus="30% 60%" />
      <PageMeta title={t('auth.login')} canonicalPath="/login" />
      {/* Left: the traveller at the village gate, welcome on a parchment note */}
      <section className="hidden md:flex md:w-[55%] lg:w-[60%] relative items-end p-10 lg:p-16">
        <div className="relative max-w-xl">
          <img src="/images/lk/hero.webp" alt="" aria-hidden className={`h-[170px] lg:h-[210px] mb-4 ml-6 ${lkClass.bob}`} />
          <div className="bg-bq-white/90 border-[3px] border-bq-ink rounded-bq shadow-bq-card p-7 lg:p-8">
            <h1 className="m-0 font-display text-[40px] lg:text-[48px] font-extrabold leading-[1.08] text-bq-ink">
              {t('auth.discoverWord')} {t('auth.throughGames')}
            </h1>
            <p className="m-0 mt-3 font-read text-[17px] text-bq-ink2 leading-relaxed">
              {t('auth.heroDesc')}
            </p>
            <p className="m-0 mt-5 pt-4 border-t-2 border-dashed border-bq-hair font-read italic text-[15px] text-bq-ink2">
              &ldquo;{t('landing.verseText')}&rdquo;
            </p>
          </div>
        </div>
      </section>

      {/* Right: the sign-in card */}
      <section className="w-full md:w-[45%] lg:w-[40%] flex flex-col justify-center items-center px-5 sm:px-10 lg:px-16 py-10 md:py-8 relative">
        <div className="w-full max-w-md space-y-6 bg-bq-white border-[3px] border-bq-ink shadow-bq-card rounded-bq p-7 sm:p-9">
          {/* Brand */}
          <div className="flex flex-col items-center">
            <img src="/images/lk/lantern-on.webp" alt="" aria-hidden className="h-16 mb-1" />
            <span className="font-display text-[28px] font-extrabold text-bq-ink leading-none">BibleQuiz</span>
          </div>

          <div className="space-y-1 text-center">
            <h2 className="m-0 font-display text-[28px] font-extrabold text-bq-ink">{t('auth.welcomeBack')}</h2>
            <p className="m-0 font-read text-[15px] text-bq-ink2">{t('auth.loginToContinue')}</p>
          </div>

          {/* Error Message */}
          {error && (
            <div data-testid="login-error-msg" className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-bq-white border-[3px] border-bq-ruby">
              <span className="material-symbols-outlined text-bq-ruby text-[18px] mt-0.5">error</span>
              <p className="m-0 text-[14px] font-bold text-bq-ruby">{error}</p>
            </div>
          )}

          <div className="space-y-5">
            {/* Google OAuth — keep Google branding (white surface + colored mark) */}
            <button
              data-testid="login-google-btn"
              onClick={handleGoogleLogin}
              disabled={isGoogleLoading || isLoading}
              className="lk-btn w-full !bg-bq-white text-bq-ink text-[16px] disabled:opacity-50"
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
              <div className="flex-1 border-t-2 border-dashed border-bq-ink/25" />
              <span className="text-[13px] text-bq-ink2 font-bold">
                {t('auth.orLoginWith')}
              </span>
              <div className="flex-1 border-t-2 border-dashed border-bq-ink/25" />
            </div>

            {/* Traditional Login Form */}
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[14px] font-extrabold text-bq-ink ml-1">
                  {t('auth.email')}
                </label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-bq-ink3 group-focus-within:text-bq-ink transition-colors">
                    mail
                  </span>
                  <input
                    data-testid="login-email-input"
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
                <div className="flex justify-between items-end ml-1">
                  <label className="text-[14px] font-extrabold text-bq-ink">
                    {t('auth.password')}
                  </label>
                  <a
                    href="#"
                    className="text-[13px] font-bold text-bq-ink2 underline decoration-bq-amber decoration-2 underline-offset-2 hover:text-bq-ink"
                  >
                    {t('auth.forgotPassword')}
                  </a>
                </div>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-bq-ink3 group-focus-within:text-bq-ink transition-colors">
                    lock
                  </span>
                  <input
                    data-testid="login-password-input"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full bg-bq-paper border-[3px] border-bq-ink/30 rounded-2xl py-3.5 pl-12 pr-4 text-[16px] text-bq-ink focus:outline-none focus:border-bq-ink focus:ring-2 focus:ring-bq-amber placeholder:text-bq-ink3 transition-colors"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                data-testid="login-submit-btn"
                type="submit"
                disabled={isLoading || isGoogleLoading}
                className="lk-btn w-full mt-3 text-bq-ink text-[17px]"
              >
                {isLoading ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                    {t('auth.loggingIn')}
                  </>
                ) : (
                  <>
                    {t('auth.login')}
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Footer Links */}
          <div className="pt-5 flex flex-col items-center gap-3 border-t-2 border-dashed border-bq-hair">
            <p className="m-0 text-[15px] text-bq-ink2">
              {t('auth.noAccount')}{' '}
              <Link
                to="/register"
                className="text-bq-ink font-extrabold underline decoration-bq-amber decoration-[3px] underline-offset-2 ml-1"
              >
                {t('auth.registerNow')}
              </Link>
            </p>
            <Link
              data-testid="login-guest-link"
              to="/"
              className="flex items-center gap-2 text-[14px] font-bold text-bq-ink py-1.5 px-4 rounded-full bg-bq-leaf border-2 border-bq-ink no-underline hover:brightness-105"
            >
              <img src="/images/lk/sword.webp" alt="" aria-hidden className="h-5" />
              {t('auth.guestPlay')}
            </Link>
          </div>
        </div>

        {/* Absolute Footer — desktop fixed, mobile static below content */}
        <footer className="lg:fixed lg:bottom-4 lg:right-4 mt-10 lg:mt-0 flex flex-wrap gap-x-4 gap-y-2 items-center justify-center">
          <a
            href="/privacy"
            className="text-[12.5px] font-bold text-bq-ink2 hover:text-bq-ink whitespace-nowrap px-2 py-0.5 rounded-full bg-bq-white/80"
          >
            {t('landing.privacy')}
          </a>
          <a
            href="/terms"
            className="text-[12.5px] font-bold text-bq-ink2 hover:text-bq-ink whitespace-nowrap px-2 py-0.5 rounded-full bg-bq-white/80"
          >
            {t('landing.terms')}
          </a>
          <span className="text-[12.5px] font-bold text-bq-ink2 whitespace-nowrap px-2 py-0.5 rounded-full bg-bq-white/80">
            &copy; 2026 BibleQuiz
          </span>
        </footer>
      </section>
    </main>
  )
}
