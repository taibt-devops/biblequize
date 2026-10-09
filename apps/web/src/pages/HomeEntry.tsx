import AppLayout from '../layouts/AppLayout'
import { useAuthStore } from '../store/authStore'
import Home from './Home'
import GuestHome from './GuestHome'

/**
 * Frame of "/": AppLayout for everyone (visitors get its guest header with the sign-in button),
 * rendered only once the auth check is done so a signed-in player never sees the guest home flash.
 */
export function HomeShell() {
  const isLoading = useAuthStore(s => s.isLoading)
  if (isLoading) return null
  return <AppLayout />
}

/** "/": the player's Home, or the guest crossroads for visitors (both one screen). */
export function HomeIndex() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated)
  return isAuthenticated ? <Home /> : <GuestHome />
}
