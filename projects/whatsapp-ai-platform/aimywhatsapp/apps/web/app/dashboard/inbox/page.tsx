'use client'
import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useWorkspaceStore } from '@/stores/workspace'
import { getSocket } from '@/lib/socket'
import { formatTime, cn } from '@/lib/utils'
import { Search, Filter, Bot, User } from 'lucide-react'
import Link from 'next/link'

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-emerald-400',
  WAITING_HUMAN: 'bg-amber-400',
  PENDING_APPROVAL: 'bg-blue-400',
  RESOLVED: 'bg-gray-300',
}

export default function InboxPage() {
  const { currentWorkspace } = useWorkspaceStore()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<string>('ALL')

  const { data, isLoading } = useQuery({
    queryKey: ['conversations', currentWorkspace?.id, filter, search],
    queryFn: () => {
      const params = new URLSearchParams({ workspaceId: currentWorkspace!.id, limit: '50' })
      if (filter !== 'ALL') params.set('status', filter)
      if (search) params.set('search', search)
      return api.get(`/conversations?${params}`).then(r => r.data)
    },
    enabled: !!currentWorkspace?.id,
    refetchInterval: 15000,
  })

  // Live updates via socket
  useEffect(() => {
    if (!currentWorkspace?.id) return
    const socket = getSocket()
    socket.emit('join_workspace', { workspaceId: currentWorkspace.id })
    socket.on('message:new', () => {
      queryClient.invalidateQueries({ queryKey: ['conversations', currentWorkspace.id] })
    })
    return () => { socket.off('message:new') }
  }, [currentWorkspace?.id, queryClient])

  const filters = [
    { label: 'All', value: 'ALL' },
    { label: 'Open', value: 'OPEN' },
    { label: 'Needs Human', value: 'WAITING_HUMAN' },
    { label: 'Approval', value: 'PENDING_APPROVAL' },
    { label: 'Resolved', value: 'RESOLVED' },
  ]

  return (
    <div className="flex h-full">
      {/* Left panel — full width on mobile, fixed 320px on desktop */}
      <div className="w-full lg:w-80 flex flex-col border-r border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        {/* Search */}
        <div className="p-3 border-b border-gray-100 dark:border-gray-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp focus:border-transparent"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {filters.map(f => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  'text-xs px-2.5 py-1 rounded-full font-medium transition',
                  filter === f.value
                    ? 'bg-whatsapp text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="p-6 text-center text-sm text-gray-400">Loading...</div>
          )}
          {!isLoading && data?.data?.length === 0 && (
            <div className="p-8 text-center text-gray-400 text-sm">
              <p>No conversations yet.</p>
            </div>
          )}
          {data?.data?.map((conv: any) => (
            <Link
              key={conv.id}
              href={`/dashboard/inbox/${conv.id}`}
              className="flex items-start gap-3 p-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 border-b border-gray-50 dark:border-gray-800 transition"
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold text-sm">
                    {(conv.contact?.name || conv.contact?.phoneNumber || '?')[0].toUpperCase()}
                  </span>
                </div>
                <span className={cn('absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-gray-900', STATUS_COLORS[conv.status] || 'bg-gray-300')} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {conv.contact?.displayName || conv.contact?.name || conv.contact?.phoneNumber}
                  </span>
                  <span className="text-xs text-gray-400 flex-shrink-0 ml-1">
                    {conv.lastMessageAt ? formatTime(conv.lastMessageAt) : ''}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                    {conv.messages?.[0]?.senderType === 'BOT' && <Bot className="w-3 h-3 flex-shrink-0 text-emerald-500" />}
                    {conv.messages?.[0]?.senderType === 'HUMAN' && <User className="w-3 h-3 flex-shrink-0 text-blue-500" />}
                    {conv.messages?.[0]?.content || 'No messages'}
                  </p>
                  {conv.unreadCount > 0 && (
                    <span className="ml-1 bg-whatsapp text-white text-xs rounded-full px-1.5 py-0.5 font-semibold flex-shrink-0">
                      {conv.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Right panel: hidden on mobile, visible on desktop */}
      <div className="hidden lg:flex flex-1 items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center text-gray-400">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Search className="w-7 h-7 opacity-40" />
          </div>
          <p className="font-medium">Select a conversation</p>
          <p className="text-sm mt-1">Choose from the list on the left</p>
        </div>
      </div>
    </div>
  )
}
