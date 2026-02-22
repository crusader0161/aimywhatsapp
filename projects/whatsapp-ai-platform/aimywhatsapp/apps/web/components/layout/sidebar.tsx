'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useWorkspaceStore } from '@/stores/workspace'
import { useAuthStore } from '@/stores/auth'
import {
  MessageSquare, Users, Brain, GitBranch,
  Megaphone, BarChart2, Settings, LogOut,
  Wifi, WifiOff, X
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: BarChart2, exact: true },
  { href: '/dashboard/inbox', label: 'Inbox', icon: MessageSquare },
  { href: '/dashboard/contacts', label: 'Contacts', icon: Users },
  { href: '/dashboard/knowledge', label: 'Knowledge Base', icon: Brain },
  { href: '/dashboard/flows', label: 'Flows', icon: GitBranch },
  { href: '/dashboard/broadcasts', label: 'Broadcasts', icon: Megaphone },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart2 },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
]

interface SidebarProps {
  open?: boolean
  onClose?: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname()
  const { currentWorkspace } = useWorkspaceStore()
  const { user, logout } = useAuthStore()

  const { data: sessions } = useQuery({
    queryKey: ['whatsapp-sessions'],
    queryFn: () => api.get('/whatsapp/sessions').then(r => r.data),
    refetchInterval: 10000,
  })

  const connected = sessions?.some((s: any) => s.status === 'CONNECTED')

  const sidebarContent = (
    <aside className="w-64 flex flex-col bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 h-full">
      {/* Logo */}
      <div className="p-5 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-whatsapp rounded-lg flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-gray-900 dark:text-white text-sm leading-tight truncate">Aimywhatsapp</p>
              <p className="text-xs text-gray-400 truncate">{currentWorkspace?.name}</p>
            </div>
          </div>
          {/* Close button (mobile only) */}
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* WA status indicator */}
        <div className={cn(
          'flex items-center gap-1.5 mt-3 text-xs font-medium px-2.5 py-1.5 rounded-lg w-fit',
          connected
            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
            : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
        )}>
          {connected
            ? <><Wifi className="w-3 h-3" /> Connected</>
            : <><WifiOff className="w-3 h-3" /> Disconnected</>
          }
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User section */}
      <div className="p-3 border-t border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
            <span className="text-emerald-700 dark:text-emerald-400 font-semibold text-xs">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user?.name}</p>
            <p className="text-xs text-gray-400 truncate">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  )

  return (
    <>
      {/* Desktop sidebar — always visible on lg+ */}
      <div className="hidden lg:flex h-screen flex-shrink-0">
        {sidebarContent}
      </div>

      {/* Mobile drawer */}
      {open !== undefined && (
        <>
          {/* Backdrop */}
          <div
            className={cn(
              'fixed inset-0 z-40 bg-black/50 lg:hidden transition-opacity duration-200',
              open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            )}
            onClick={onClose}
          />
          {/* Drawer */}
          <div
            className={cn(
              'fixed inset-y-0 left-0 z-50 lg:hidden transition-transform duration-200 ease-in-out',
              open ? 'translate-x-0' : '-translate-x-full'
            )}
          >
            {sidebarContent}
          </div>
        </>
      )}
    </>
  )
}

// Bottom nav for mobile (shown on small screens)
export function BottomNav() {
  const pathname = usePathname()

  const bottomItems = [
    { href: '/dashboard', label: 'Home', icon: BarChart2, exact: true },
    { href: '/dashboard/inbox', label: 'Inbox', icon: MessageSquare },
    { href: '/dashboard/contacts', label: 'Contacts', icon: Users },
    { href: '/dashboard/knowledge', label: 'Knowledge', icon: Brain },
    { href: '/dashboard/settings', label: 'Settings', icon: Settings },
  ]

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 flex items-center justify-around h-16 px-2 safe-area-pb">
      {bottomItems.map(({ href, label, icon: Icon, exact }) => {
        const isActive = exact ? pathname === href : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors min-w-0',
              isActive
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-gray-400 dark:text-gray-500'
            )}
          >
            <Icon className={cn('w-5 h-5', isActive && 'text-emerald-600 dark:text-emerald-400')} />
            <span className="truncate text-[10px]">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
