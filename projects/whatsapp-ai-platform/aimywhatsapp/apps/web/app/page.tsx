'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth'

export default function HomePage() {
  const router = useRouter()
  const { isAuthenticated } = useAuthStore()

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/dashboard')
    } else {
      router.replace('/auth/login')
    }
  }, [isAuthenticated, router])

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 bg-whatsapp rounded-xl flex items-center justify-center">
          <span className="text-white text-2xl">💬</span>
        </div>
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    </div>
  )
}
