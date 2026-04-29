import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../store/authStore'
import { api } from '../api/client'

export default function AuthCallback() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [isProcessing, setIsProcessing] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { login } = useAuth()
  // Guard against React 18 StrictMode's double-invoke of useEffect in
  // dev. The OAuth `code` from Google is one-time-use — exchanging it
  // twice in parallel hits a 429 from the backend rate limiter on the
  // second call and the user is bounced back to /login. Refs persist
  // across StrictMode re-mounts, so checking + setting one is enough.
  const hasProcessedRef = useRef(false)

  useEffect(() => {
    if (hasProcessedRef.current) return
    hasProcessedRef.current = true

    const processAuthCallback = async () => {
      try {
        const code = searchParams.get('code');
        const errorParam = searchParams.get('error');

        console.log('[AUTH_CALLBACK] Processing callback:', {
          code: code ? 'present' : 'missing',
          error: errorParam
        });

        if (errorParam) {
          console.error('[AUTH_CALLBACK] OAuth error:', errorParam);
          setError(`OAuth error: ${errorParam}`);
          setTimeout(() => navigate('/login?error=oauth_failed'), 1000);
          return;
        }

        if (!code) {
          console.error('[AUTH_CALLBACK] No code received in URL');
          setError('No authentication code received');
          setTimeout(() => navigate('/login?error=no_tokens'), 1000);
          return;
        }

        // Exchange code for tokens via POST
        // The refresh token is set by the backend as an httpOnly cookie.
        // We only receive the accessToken and user profile in JSON.
        const response = await api.post('/api/auth/exchange', { code });
        const { accessToken, name, email, avatar, role } = response.data;

        if (accessToken) {
          login({
            accessToken,
            name: name || 'User',
            email: email || 'user@example.com',
            avatar: avatar || undefined,
            role
          });

          console.log('[AUTH_CALLBACK] User logged in via exchange success');
          setTimeout(() => navigate('/'), 500);
        } else {
          console.error('[AUTH_CALLBACK] Exchange failed: No access token in response');
          setError('Failed to retrieve authentication tokens');
          setTimeout(() => navigate('/login?error=no_tokens'), 1000);
        }
      } catch (err: any) {
        console.error('[AUTH_CALLBACK] Error processing callback:', err);
        const backendError = err.response?.data?.message || err.message;
        setError(`${t('auth.errorAuth')}: ${backendError}`);
        setTimeout(() => navigate('/login?error=processing_failed'), 1500);
      } finally {
        setIsProcessing(false);
      }
    };

    processAuthCallback()
  }, [searchParams, navigate, t])

  return (
    <div className="min-h-screen neon-bg flex items-center justify-center relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-20 left-20 text-5xl neon-green opacity-20 animate-pulse">🔐</div>
      <div className="absolute bottom-20 right-20 text-5xl neon-pink opacity-20 animate-pulse">⚡</div>

      <div className="text-center">
        <div className="neon-card p-8">
          {isProcessing ? (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-neon-blue mx-auto mb-4"></div>
              <p className="neon-text text-white">{t('auth.processing')}</p>
            </>
          ) : error ? (
            <>
              <div className="text-6xl mb-4">❌</div>
              <p className="neon-text text-red-400 mb-4">{error}</p>
              <p className="text-white opacity-70">{t('auth.redirectingLogin')}</p>
            </>
          ) : (
            <>
              <div className="text-6xl mb-4">✅</div>
              <p className="neon-text text-green-400 mb-4">{t('auth.loginSuccess')}</p>
              <p className="text-white opacity-70">{t('auth.redirectingHome')}</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
