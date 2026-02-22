'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useWorkspaceStore } from '@/stores/workspace'
import { Search, Bot, User, UserX, Star, Shield, MoreVertical, Download } from 'lucide-react'
import { toast } from 'sonner'
import { formatTime, cn } from '@/lib/utils'

export default function ContactsPage() {
  const { currentWorkspace } = useWorkspaceStore()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['contacts', currentWorkspace?.id, search, page],
    queryFn: () => {
      const params = new URLSearchParams({
        workspaceId: currentWorkspace!.id,
        page: String(page),
        limit: '50',
      })
      if (search) params.set('search', search)
      return api.get(`/contacts?${params}`).then(r => r.data)
    },
    enabled: !!currentWorkspace?.id,
  })

  const toggleAutoReply = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.patch(`/contacts/${id}`, { autoreplyEnabled: enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contacts'] }),
  })

  const toggleBlock = useMutation({
    mutationFn: ({ id, block }: { id: string; block: boolean }) =>
      api[block ? 'post' : 'post'](`/contacts/${id}/${block ? 'block' : 'unblock'}`),
    onSuccess: (_, vars) => {
      toast.success(vars.block ? 'Contact blocked' : 'Contact unblocked')
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
    },
  })

  const toggleTakeover = useMutation({
    mutationFn: ({ id, takeover }: { id: string; takeover: boolean }) =>
      api.post(`/contacts/${id}/${takeover ? 'takeover' : 'release'}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contacts'] }),
  })

  return (
    <div className="p-6 space-y-5">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search contacts..."
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-whatsapp"
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-gray-500">{data?.pagination?.total ?? 0} contacts</span>
          <button className="flex items-center gap-2 px-3 py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 text-gray-600 dark:text-gray-400 transition">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900/50 text-left">
              {['Contact', 'Phone', 'Last Message', 'Auto-Reply', 'Status', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
            {isLoading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading contacts...</td></tr>
            )}
            {!isLoading && data?.data?.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No contacts yet. They'll appear here once someone messages you.</td></tr>
            )}
            {data?.data?.map((contact: any) => (
              <tr key={contact.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
                      <span className="text-emerald-700 dark:text-emerald-400 font-semibold text-xs">
                        {(contact.name || contact.phoneNumber || '?')[0].toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {contact.displayName || contact.name || 'Unknown'}
                      </p>
                      {contact.isVip && <span className="text-xs text-amber-500">⭐ VIP</span>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{contact.phoneNumber}</td>
                <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                  {contact.lastMessageAt ? formatTime(contact.lastMessageAt) : '—'}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleAutoReply.mutate({ id: contact.id, enabled: !contact.autoreplyEnabled })}
                    className={cn(
                      'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                      contact.autoreplyEnabled ? 'bg-whatsapp' : 'bg-gray-200 dark:bg-gray-600'
                    )}
                  >
                    <span className={cn(
                      'inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform',
                      contact.autoreplyEnabled ? 'translate-x-4.5' : 'translate-x-0.5'
                    )} />
                  </button>
                </td>
                <td className="px-4 py-3">
                  <span className={cn(
                    'text-xs px-2 py-1 rounded-full font-medium',
                    contact.isBlocked ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                    contact.humanTakeover ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  )}>
                    {contact.isBlocked ? '🚫 Blocked' : contact.humanTakeover ? '👤 Human' : '🤖 Bot'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      title={contact.humanTakeover ? 'Hand back to bot' : 'Take over (human)'}
                      onClick={() => toggleTakeover.mutate({ id: contact.id, takeover: !contact.humanTakeover })}
                      className="p-1.5 text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition"
                    >
                      {contact.humanTakeover ? <Bot className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      title={contact.isBlocked ? 'Unblock' : 'Block'}
                      onClick={() => toggleBlock.mutate({ id: contact.id, block: !contact.isBlocked })}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                    >
                      <Shield className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {data?.pagination && data.pagination.pages > 1 && (
          <div className="flex items-center justify-center gap-3 p-4 border-t border-gray-100 dark:border-gray-700">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 rounded-lg disabled:opacity-40 hover:bg-gray-200 transition"
            >
              Previous
            </button>
            <span className="text-xs text-gray-500">{page} / {data.pagination.pages}</span>
            <button
              onClick={() => setPage(p => Math.min(data.pagination.pages, p + 1))}
              disabled={page === data.pagination.pages}
              className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 rounded-lg disabled:opacity-40 hover:bg-gray-200 transition"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
