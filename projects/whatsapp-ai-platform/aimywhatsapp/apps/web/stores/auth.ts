import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: string
  name: string
  email: string
  avatarUrl?: string
}

interface Workspace {
  id: string
  name: string
  slug: string
  logoUrl?: string
  role?: string
}

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: User | null
  workspaces: Workspace[]
  isAuthenticated: boolean
  setAuth: (accessToken: string, refreshToken: string, user: User, workspaces: Workspace[]) => void
  updateTokens: (accessToken: string, refreshToken: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      workspaces: [],
      isAuthenticated: false,

      setAuth: (accessToken, refreshToken, user, workspaces) =>
        set({ accessToken, refreshToken, user, workspaces, isAuthenticated: true }),

      updateTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),

      logout: () =>
        set({ accessToken: null, refreshToken: null, user: null, workspaces: [], isAuthenticated: false }),
    }),
    {
      name: 'aimy-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        workspaces: state.workspaces,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
