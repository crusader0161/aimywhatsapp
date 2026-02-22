'use client'
import { Bell, Search, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useState } from 'react'
import { usePathname } from 'next/navigation'

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/inbox': 'Inbox',
  '/dashboard/contacts': 'Contacts',
  '/dashboard/knowledge': 'Knowledge Base',
  '/dashboard/flows': 'Flow Builder',
  '/dashboard/broadcasts': 'Broadcasts',
  '/dashboard/analytics': 'Analytics',
  '/dashboard/settings': 'Settings',
  '/dashboard/settings/whatsapp': 'WhatsApp Connection',
  '/dashboard/settings/bot': 'Bot Settings',
  '/dashboard/settings/team': 'Team',
}

export function Header() {
  const { theme, setTheme } = useTheme()
  const pathname = usePathname()
  const title = Object.entries(pageTitles)
    .filter(([path]) => pathname.startsWith(path))
    .sort((a, b) => b[0].length - a[0].length)[0]?.[1] || 'Dashboard'

  return (
    <header className="h-14 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex items-center px-6 gap-4 flex-shrink-0">
      <h2 className="font-semibold text-gray-900 dark:text-white text-sm flex-1">{title}</h2>

      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Notifications placeholder */}
        <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition relative">
          <Bell className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}
