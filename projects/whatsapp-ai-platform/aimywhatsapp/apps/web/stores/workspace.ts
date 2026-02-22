import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Workspace {
  id: string
  name: string
  slug: string
  logoUrl?: string
  role?: string
}

interface WorkspaceState {
  currentWorkspace: Workspace | null
  setCurrentWorkspace: (workspace: Workspace) => void
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      currentWorkspace: null,
      setCurrentWorkspace: (workspace) => set({ currentWorkspace: workspace }),
    }),
    { name: 'aimy-workspace' }
  )
)
