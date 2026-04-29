import { create } from 'zustand'
import { setAccessToken } from '../api/tokenStore'
import { notifyRankedDataCleared } from '../utils/localStorageClearDetector'

interface User {
  name: string
  email: string
  avatar?: string
  role?: string
  currentStreak?: number
}

interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  isAdmin: boolean

  login: (tokens: { accessToken: string; name: string; email: string; avatar?: string; role?: string }) => void
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  isAdmin: false,

  setLoading: (loading: boolean) => set({ isLoading: loading }),

  login: (tokens) => {
    // Access token stored in memory only — not localStorage (XSS protection)
    setAccessToken(tokens.accessToken)
    // Only non-sensitive user profile data goes to localStorage
    localStorage.setItem('userName', tokens.name)
    localStorage.setItem('userEmail', tokens.email)
    if (tokens.avatar) {
      localStorage.setItem('userAvatar', tokens.avatar)
    }

    const normalizedRole = tokens.role?.toUpperCase()
    const user: User = {
      name: tokens.name,
      email: tokens.email,
      avatar: tokens.avatar,
      role: normalizedRole
    }

    set({
      user,
      isAuthenticated: true,
      isAdmin: normalizedRole === 'ADMIN'
    })

    // Restore ranked progress from database after login
    try {
      const today = new Date().toISOString().slice(0, 10)
      const currentSnapshot = localStorage.getItem('rankedSnapshot')
      if (!currentSnapshot || JSON.parse(currentSnapshot).date !== today) {
        if (import.meta.env.DEV) {
          console.log('[AUTH_STORE] Restoring ranked progress from database after login')
        }
        notifyRankedDataCleared()
      }
    } catch (error) {
      console.warn('[AUTH_STORE] Failed to restore ranked progress after login:', error)
    }

    if (import.meta.env.DEV) {
      console.log('[AUTH_STORE] User logged in:', tokens.name)
    }
  },

  logout: async () => {
    // Sync ranked progress before logout
    try {
      const rankedSnapshot = localStorage.getItem('rankedSnapshot')
      if (rankedSnapshot) {
        const data = JSON.parse(rankedSnapshot)
        if (data.questionsCounted > 0 || data.pointsToday > 0) {
          if (import.meta.env.DEV) {
            console.log('[AUTH_STORE] Syncing ranked progress before logout:', data)
          }
          const { api } = await import('../api/client')
          await api.post('/api/ranked/sync-progress')
        }
      }
    } catch (error) {
      console.warn('[AUTH_STORE] Failed to sync ranked progress before logout:', error)
    }

    // Blacklist current access token and clear the httpOnly refresh cookie
    try {
      const { api } = await import('../api/client')
      await api.post('/api/auth/logout')
    } catch (error) {
      console.warn('[AUTH_STORE] Logout request failed:', error)
    }

    // Clear in-memory access token
    setAccessToken(null)
    // Clear profile data from localStorage
    localStorage.removeItem('userName')
    localStorage.removeItem('userEmail')
    localStorage.removeItem('userAvatar')

    set({ user: null, isAuthenticated: false, isAdmin: false })

    if (import.meta.env.DEV) {
      console.log('[AUTH_STORE] User logged out')
    }
  },

  checkAuth: async () => {
    // Skip refresh if user was never logged in (no cached profile)
    // This avoids a 401 console error on guest/landing pages
    const hadSession = localStorage.getItem('userName')
    if (!hadSession) {
      set({ user: null, isAuthenticated: false, isAdmin: false, isLoading: false })
      return
    }

    try {
      const { api } = await import('../api/client')
      if (import.meta.env.DEV) {
        console.log('[AUTH_STORE] Attempting token refresh on startup')
      }
      const refreshRes = await api.post('/api/auth/refresh')
      const { accessToken } = refreshRes.data
      setAccessToken(accessToken)

      // Fetch fresh profile
      const meRes = await api.get('/api/me')
      const normalizedRole = (meRes.data?.role as string | undefined)?.toUpperCase()
      const name = localStorage.getItem('userName')
      const email = localStorage.getItem('userEmail')
      const avatar = localStorage.getItem('userAvatar')

      const user: User = {
        name: meRes.data?.name ?? name ?? 'User',
        email: meRes.data?.email ?? email ?? '',
        avatar: meRes.data?.avatarUrl ?? avatar ?? undefined,
        role: normalizedRole,
        currentStreak: typeof meRes.data?.currentStreak === 'number' ? meRes.data.currentStreak : undefined,
      }
      // Update localStorage profile cache
      localStorage.setItem('userName', user.name)
      localStorage.setItem('userEmail', user.email)
      if (user.avatar) localStorage.setItem('userAvatar', user.avatar)

      set({
        user,
        isAuthenticated: true,
        isAdmin: normalizedRole === 'ADMIN'
      })

      if (import.meta.env.DEV) {
        console.log('[AUTH_STORE] Session restored, role:', normalizedRole)
      }
    } catch {
      // No valid session (refresh token missing or expired)
      setAccessToken(null)
      set({ user: null, isAuthenticated: false, isAdmin: false })
      if (import.meta.env.DEV) {
        console.log('[AUTH_STORE] No valid session found')
      }
    } finally {
      set({ isLoading: false })
    }
  }
}))

// Backward-compatible hook name
export const useAuth = () => useAuthStore()
