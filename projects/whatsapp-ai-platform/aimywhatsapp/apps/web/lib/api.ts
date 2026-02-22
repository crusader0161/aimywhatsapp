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

// Auto-refresh on 401
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
      try {
        const res = await axios.post(`${API_URL}/auth/refresh`, { refreshToken })
        updateTokens(res.data.accessToken, res.data.refreshToken)
        original.headers.Authorization = `Bearer ${res.data.accessToken}`
        return api(original)
      } catch {
        logout()
        window.location.href = '/auth/login'
        return Promise.reject(error)
      }
    }
    return Promise.reject(error)
  }
)
