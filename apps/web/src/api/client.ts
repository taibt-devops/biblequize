import axios, { AxiosRequestConfig, AxiosResponse } from 'axios'
import i18n from 'i18next'
import { getApiBaseUrl, isDebug } from './config'
import { getAccessToken, setAccessToken } from './tokenStore'
import { isCapacitor } from '../platform/capacitor'

export const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 10000,
  withCredentials: true // Required so httpOnly refresh_token cookie is sent
})

// Shared request interceptor factory
function addAuthInterceptor(instance: typeof api) {
  instance.interceptors.request.use(
    (config: any) => {
      const token = getAccessToken()
      if (isDebug()) {
        console.log('=== API CLIENT: Request Interceptor ===')
        console.log('URL:', config.url)
        console.log('Token exists:', !!token)
      }
      if (token && config.headers) config.headers.Authorization = `Bearer ${token}`
      // Let the backend localize server-generated messages (MessageSource).
      if (config.headers) config.headers['Accept-Language'] = i18n.language === 'en' ? 'en' : 'vi'
      return config
    },
    (error) => Promise.reject(error)
  )
}
addAuthInterceptor(api)

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response
  },
  async (error) => {
    const originalRequest = error.config as (AxiosRequestConfig & { _retry?: boolean })

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/api/auth/refresh')
    ) {
      originalRequest._retry = true

      try {
        let accessToken: string | undefined

        if (isCapacitor()) {
          // Mobile: refresh via the stored refresh token (no cookie).
          const { mobileRefresh } = await import('./mobileAuth')
          const result = await mobileRefresh()
          if (!result) throw new Error('mobile refresh failed')
          accessToken = result.accessToken
        } else {
          // Web: refresh token is in httpOnly cookie — no body needed.
          const response = await axios.post(`${api.defaults.baseURL}/api/auth/refresh`, {}, {
            withCredentials: true
          })
          accessToken = response.data?.accessToken
        }

        setAccessToken(accessToken ?? null)

        // Retry the original request with new token
        if (!originalRequest.headers) originalRequest.headers = {}
        originalRequest.headers.Authorization = `Bearer ${accessToken}`
        return api(originalRequest)
      } catch (refreshError) {
        // Refresh failed — notify the app to handle session expiry via React Router
        setAccessToken(null)
        window.dispatchEvent(new CustomEvent('auth:session-expired'))
      }
    }

    // Attach user-friendly error message (i18n)
    const t = i18n.t.bind(i18n)
    if (!error.response) {
      error.userMessage = t('errors.networkError')
    } else {
      switch (error.response.status) {
        case 401:
          error.userMessage = t('errors.sessionExpired')
          break
        case 403:
          error.userMessage = t('errors.forbidden')
          break
        case 404:
          error.userMessage = t('errors.resourceNotFound')
          break
        case 429:
          error.userMessage = t('errors.tooManyRequests')
          break
        case 500:
          error.userMessage = t('errors.serverError')
          break
        default:
          error.userMessage = error.response.data?.message ?? t('errors.generic')
      }
    }

    return Promise.reject(error)
  }
)
