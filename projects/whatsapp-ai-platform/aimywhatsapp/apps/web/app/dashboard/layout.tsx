'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuthStore } from '@/stores/auth'
import { Sidebar, BottomNav } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { isAuthenticated } = useAuthStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Wait for client-side mount before checking auth.
  // Zustand persist rehydrates from localStorage after the first render,
  // so we must not redirect until mounted (hydration complete).
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted && !isAuthenticated) router.replace('/auth/login')
  }, [mounted, isAuthenticated, router])

  // Close mobile sidebar on route change
  useEffect(() => {
    setSidebarOpen(false)
  }, [pathname])

  // Show nothing while waiting for hydration (avoids flash of redirect)
  if (!mounted) return null

  if (!isAuthenticated) return null

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {/* Desktop sidebar */}
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-auto min-h-0 pb-16 lg:pb-0">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <BottomNav />
    </div>
  )
}
