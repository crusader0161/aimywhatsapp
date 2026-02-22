'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bot, Smartphone, Users, Webhook, Key, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

const tabs = [
  { href: '/dashboard/settings', label: 'Bot Settings', icon: Bot, exact: true },
  { href: '/dashboard/settings/whatsapp', label: 'WhatsApp', icon: Smartphone },
  { href: '/dashboard/settings/team', label: 'Team', icon: Users },
  { href: '/dashboard/settings/webhooks', label: 'Webhooks', icon: Webhook },
  { href: '/dashboard/settings/api-keys', label: 'API Keys', icon: Key },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex h-full">
      {/* Settings sidebar */}
      <aside className="w-48 border-r border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 space-y-0.5 flex-shrink-0">
        <p className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">Settings</p>
        {tabs.map(({ href, label, icon: Icon, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition',
                isActive
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          )
        })}
      </aside>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
