import { isCapacitor } from '../platform/capacitor'

/** The backend's Google OAuth2 entry point (Spring Security), same origin unless an API base is set. */
export function googleAuthUrl(): string {
  return `${import.meta.env.VITE_API_BASE_URL || ''}/oauth2/authorization/google`
}

/**
 * Start Google sign-in from anywhere in the app. Web: hand off to the backend's OAuth2 flow.
 * Mobile (Capacitor): Google sign-in is native and lives on /login, so go there.
 */
export function startGoogleLogin(navigate: (to: string) => void): void {
  if (isCapacitor()) {
    navigate('/login')
    return
  }
  window.location.href = googleAuthUrl()
}
