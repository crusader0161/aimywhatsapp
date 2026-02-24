import axios from 'axios'
import { useAuthStore } from '@/stores/auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Attach auth token to every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Auto-refresh on 401 — deduplicated to prevent race condition on concurrent 401s.
// Only one refresh call runs at a time; all other 401s wait for the same promise.
let refreshPromise: Promise<void> | null = null

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const { refreshToken, updateTokens, logout } = useAuthStore.getState()

      if (!refreshToken) {
        logout()
        window.location.href = '/auth/login'
        return Promise.reject(error)
      }

      // If a refresh is already in flight, wait for it; otherwise start one
      if (!refreshPromise) {
        refreshPromise = axios
          .post(`${API_URL}/auth/refresh`, { refreshToken })
          .then((res) => {
            updateTokens(res.data.accessToken, res.data.refreshToken)
          })
          .catch(() => {
            logout()
            window.location.href = '/auth/login'
          })
          .finally(() => {
            refreshPromise = null
          })
      }

      try {
        await refreshPromise
        const newToken = useAuthStore.getState().accessToken
        if (!newToken) return Promise.reject(error) // logout already handled
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)
      } catch {
        return Promise.reject(error)
      }
    }
    return Promise.reject(error)
  }
)
