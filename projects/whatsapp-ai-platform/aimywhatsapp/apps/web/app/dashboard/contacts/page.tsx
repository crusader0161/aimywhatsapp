'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useWorkspaceStore } from '@/stores/workspace'
import { Search, Bot, User, Shield, Download, UserPlus, X } from 'lucide-react'
import { toast } from 'sonner'
import { formatTime, cn } from '@/lib/utils'

// ─── Add Contact Modal ─────────────────────────────────────────────────────

function AddContactModal({ workspaceId, sessionId, onClose }: {
  workspaceId: string
  sessionId: string
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ phoneNumber: '', name: '', notes: '' })

  const addMutation = useMutation({
    mutationFn: () => api.post('/contacts', {
      workspaceId,
      sessionId,
      phoneNumber: form.phoneNumber.trim(),
      name: form.name.trim() || undefined,
      notes: form.notes.trim() || undefined,
    }),
    onSuccess: () => {
      toast.success('Contact added')
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      onClose()
    },
    onError: () => toast.error('Failed to add contact'),
  })

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-900 dark:text-white">Add Contact</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400">
          Manually added contacts can receive AI auto-replies even in <strong>Contacts Only</strong> mode.
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <input
              value={form.phoneNumber}
              onChange={e => setForm(f => ({ ...f, phoneNumber: e.target.value }))}
              placeholder="+91 98765 43210"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-whatsapp"
            />
            <p className="text-xs text-gray-400 mt-1">Include country code, e.g. +91 for India</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Name (optional)</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Rahul Sharma"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-whatsapp"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Notes (optional)</label>
            <input
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Any notes about this contact..."
              className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-whatsapp"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
          >
            Cancel
          </button>
          <button
            onClick={() => addMutation.mutate()}
            disabled={!form.phoneNumber.trim() || addMutation.isPending}
            className="flex-1 px-4 py-2.5 text-sm bg-whatsapp text-white rounded-xl font-semibold hover:bg-emerald-600 disabled:opacity-50 transition"
          >
            {addMutation.isPending ? 'Adding...' : 'Add Contact'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function ContactsPage() {
  const { currentWorkspace } = useWorkspaceStore()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showAddModal, setShowAddModal] = useState(false)

  const { data: sessionsData } = useQuery({
    queryKey: ['whatsapp-sessions', currentWorkspace?.id],
    queryFn: () => api.get(`/whatsapp/sessions?workspaceId=${currentWorkspace!.id}`).then(r => r.data),
    enabled: !!currentWorkspace?.id,
  })

  // Get the first connected session id for new contact creation
  const activeSessionId = sessionsData?.find((s: any) => s.status === 'CONNECTED')?.id || sessionsData?.[0]?.id

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
      api.post(`/contacts/${id}/${block ? 'block' : 'unblock'}`),
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
      {showAddModal && currentWorkspace && (
        <AddContactModal
          workspaceId={currentWorkspace.id}
          sessionId={activeSessionId || ''}
          onClose={() => setShowAddModal(false)}
        />
      )}

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
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-3 py-2.5 text-sm bg-whatsapp text-white rounded-lg hover:bg-emerald-600 transition font-medium"
          >
            <UserPlus className="w-4 h-4" /> Add Contact
          </button>
          <button className="flex items-center gap-2 px-3 py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 text-gray-600 dark:text-gray-400 transition">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50 text-left">
                {['Contact', 'Phone', 'Last Message', 'Auto-Reply', 'Status', 'Added By', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {isLoading && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading contacts...</td></tr>
              )}
              {!isLoading && data?.data?.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center">
                    <p className="text-gray-400 text-sm mb-2">No contacts yet.</p>
                    <p className="text-gray-400 text-xs">They appear here when someone messages you, or you can add them manually.</p>
                  </td>
                </tr>
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
                      contact.isBlocked
                        ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                        : contact.humanTakeover
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    )}>
                      {contact.isBlocked ? '🚫 Blocked' : contact.humanTakeover ? '👤 Human' : '🤖 Bot'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full',
                      contact.isManuallyAdded
                        ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                    )}>
                      {contact.isManuallyAdded ? '✋ Manual' : '📩 Auto'}
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
        </div>

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
