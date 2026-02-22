'use client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useWorkspaceStore } from '@/stores/workspace'
import { MessageSquare, Users, Bot, TrendingUp, ArrowUpRight, Wifi, WifiOff } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const { currentWorkspace } = useWorkspaceStore()

  const { data: overview } = useQuery({
    queryKey: ['analytics', 'overview', currentWorkspace?.id],
    queryFn: () => api.get(`/analytics/overview?workspaceId=${currentWorkspace?.id}&days=30`).then((r) => r.data),
    enabled: !!currentWorkspace?.id,
    refetchInterval: 30000,
  })

  const { data: sessions } = useQuery({
    queryKey: ['whatsapp', 'sessions', currentWorkspace?.id],
    queryFn: () => api.get('/whatsapp/sessions').then((r) => r.data),
    refetchInterval: 10000,
  })

  const { data: recentConversations } = useQuery({
    queryKey: ['conversations', 'recent', currentWorkspace?.id],
    queryFn: () => api.get(`/conversations?workspaceId=${currentWorkspace?.id}&limit=5`).then((r) => r.data),
    enabled: !!currentWorkspace?.id,
    refetchInterval: 15000,
  })

  const connectedSessions = sessions?.filter((s: any) => s.status === 'CONNECTED') || []
  const isConnected = connectedSessions.length > 0

  const metrics = [
    {
      label: 'Total Messages',
      value: overview?.totalMessages ?? '—',
      icon: MessageSquare,
      color: 'text-blue-500',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      sub: 'Last 30 days',
    },
    {
      label: 'Contacts',
      value: overview?.totalContacts ?? '—',
      icon: Users,
      color: 'text-purple-500',
      bg: 'bg-purple-50 dark:bg-purple-900/20',
      sub: 'New this month',
    },
    {
      label: 'Bot Replies',
      value: overview?.botMessages ?? '—',
      icon: Bot,
      color: 'text-emerald-500',
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      sub: `${overview?.botResolutionRate ?? 0}% resolution rate`,
    },
    {
      label: 'Open Conversations',
      value: overview?.openConversations ?? '—',
      icon: TrendingUp,
      color: 'text-orange-500',
      bg: 'bg-orange-50 dark:bg-orange-900/20',
      sub: `${overview?.resolvedConversations ?? 0} resolved`,
    },
  ]

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
            Good {getGreeting()}, {currentWorkspace?.name} 👋
          </h1>
          <p className="text-gray-500 text-sm mt-1">Here's what's happening with your WhatsApp bot today.</p>
        </div>

        {/* Connection status */}
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
          isConnected
            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
            : 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'
        }`}>
          {isConnected ? (
            <><Wifi className="w-4 h-4" /> WhatsApp Connected</>
          ) : (
            <><WifiOff className="w-4 h-4" /> Not Connected</>
          )}
        </div>
      </div>

      {/* No WhatsApp connected banner */}
      {!isConnected && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-300">WhatsApp not connected</p>
            <p className="text-sm text-amber-600 dark:text-amber-400 mt-0.5">Connect your WhatsApp to start receiving and sending messages.</p>
          </div>
          <Link
            href="/dashboard/settings/whatsapp"
            className="flex items-center gap-1.5 px-4 py-2 bg-whatsapp text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition"
          >
            Connect Now <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{metric.label}</span>
              <div className={`w-9 h-9 rounded-lg ${metric.bg} flex items-center justify-center`}>
                <metric.icon className={`w-4 h-4 ${metric.color}`} />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{metric.value}</p>
            <p className="text-xs text-gray-400 mt-1">{metric.sub}</p>
          </div>
        ))}
      </div>

      {/* Recent Conversations */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-white">Recent Conversations</h2>
          <Link href="/dashboard/inbox" className="text-sm text-whatsapp hover:underline flex items-center gap-1">
            View all <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="divide-y divide-gray-50 dark:divide-gray-700">
          {recentConversations?.data?.length === 0 && (
            <div className="p-8 text-center text-gray-400">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No conversations yet. Messages will appear here once your WhatsApp is connected.</p>
            </div>
          )}
          {recentConversations?.data?.map((conv: any) => (
            <Link key={conv.id} href={`/dashboard/inbox/${conv.id}`} className="flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
              <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
                <span className="text-emerald-700 dark:text-emerald-400 font-medium text-sm">
                  {(conv.contact?.name || conv.contact?.phoneNumber || '?')[0].toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
                    {conv.contact?.displayName || conv.contact?.name || conv.contact?.phoneNumber}
                  </p>
                  <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                    {conv.messages?.[0]?.createdAt ? new Date(conv.messages[0].createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
                <p className="text-xs text-gray-500 truncate mt-0.5">
                  {conv.messages?.[0]?.senderType === 'BOT' ? '🤖 ' : ''}
                  {conv.messages?.[0]?.content || 'No messages yet'}
                </p>
              </div>
              {conv.unreadCount > 0 && (
                <span className="bg-whatsapp text-white text-xs rounded-full px-2 py-0.5 font-medium flex-shrink-0">
                  {conv.unreadCount}
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'evening'
}
