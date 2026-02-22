'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useWorkspaceStore } from '@/stores/workspace'
import { Megaphone, Plus, Send, Trash2, Clock, CheckCircle, XCircle, Users } from 'lucide-react'
import { toast } from 'sonner'
import { cn, formatTime } from '@/lib/utils'

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400', icon: Clock },
  SCHEDULED: { label: 'Scheduled', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: Clock },
  SENDING: { label: 'Sending...', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: Send },
  SENT: { label: 'Sent', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: CheckCircle },
  FAILED: { label: 'Failed', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: XCircle },
}

export default function BroadcastsPage() {
  const { currentWorkspace } = useWorkspaceStore()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    name: '',
    message: '',
    targetType: 'ALL' as 'ALL' | 'LABEL' | 'CONTACTS',
  })

  const { data: broadcasts, isLoading } = useQuery({
    queryKey: ['broadcasts', currentWorkspace?.id],
    queryFn: () => api.get(`/broadcasts?workspaceId=${currentWorkspace!.id}`).then(r => r.data),
    enabled: !!currentWorkspace?.id,
    refetchInterval: 10000,
  })

  const { data: labels } = useQuery({
    queryKey: ['labels', currentWorkspace?.id],
    queryFn: () => api.get(`/contacts/labels?workspaceId=${currentWorkspace!.id}`).then(r => r.data),
    enabled: !!currentWorkspace?.id,
  })

  const createMutation = useMutation({
    mutationFn: () => api.post('/broadcasts', { ...form, workspaceId: currentWorkspace!.id }),
    onSuccess: () => {
      setShowForm(false)
      setForm({ name: '', message: '', targetType: 'ALL' })
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] })
      toast.success('Broadcast created')
    },
    onError: () => toast.error('Failed to create broadcast'),
  })

  const sendMutation = useMutation({
    mutationFn: (id: string) => api.post(`/broadcasts/${id}/send`),
    onSuccess: () => {
      toast.success('Broadcast sending...')
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] })
    },
    onError: () => toast.error('Failed to send'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/broadcasts/${id}`),
    onSuccess: () => {
      toast.success('Deleted')
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] })
    },
  })

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Broadcasts</h1>
          <p className="text-sm text-gray-500 mt-0.5">Send bulk messages to your contacts</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-whatsapp text-white rounded-xl text-sm font-semibold hover:bg-emerald-600 transition"
        >
          <Plus className="w-4 h-4" /> New Broadcast
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-emerald-200 dark:border-emerald-800 p-6 space-y-5">
          <h3 className="font-semibold text-gray-900 dark:text-white">New Broadcast</h3>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Broadcast Name</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Summer Sale Announcement"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-whatsapp"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Message</label>
            <textarea
              value={form.message}
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              rows={4}
              placeholder="Hi {{name}}, we have exciting news..."
              className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-whatsapp resize-none"
            />
            <p className="text-xs text-gray-400 mt-1">Use {'{{name}}'} to personalize with contact name</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Send To</label>
            <div className="flex gap-3">
              {[
                { value: 'ALL', label: '👥 All Contacts', desc: 'Everyone who messaged you' },
                { value: 'LABEL', label: '🏷️ By Label', desc: 'Only contacts with specific labels' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setForm(f => ({ ...f, targetType: opt.value as any }))}
                  className={cn(
                    'flex-1 text-left p-3 rounded-xl border-2 transition',
                    form.targetType === opt.value
                      ? 'border-whatsapp bg-emerald-50 dark:bg-emerald-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                  )}
                >
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{opt.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => createMutation.mutate()}
              disabled={!form.name || !form.message || createMutation.isPending}
              className="px-5 py-2.5 bg-whatsapp text-white rounded-lg text-sm font-medium hover:bg-emerald-600 disabled:opacity-40 transition"
            >
              Save Draft
            </button>
            <button
              onClick={() => { setShowForm(false); setForm({ name: '', message: '', targetType: 'ALL' }) }}
              className="px-5 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-lg text-sm hover:bg-gray-200 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Broadcasts list */}
      {isLoading && <p className="text-sm text-gray-400 text-center py-8">Loading...</p>}

      {!isLoading && broadcasts?.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-12 text-center">
          <Megaphone className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="font-medium text-gray-700 dark:text-gray-300">No broadcasts yet</p>
          <p className="text-sm text-gray-400 mt-1">Create a broadcast to reach all your contacts at once</p>
        </div>
      )}

      <div className="space-y-3">
        {broadcasts?.map((bc: any) => {
          const statusCfg = STATUS_CONFIG[bc.status] || STATUS_CONFIG.DRAFT
          const StatusIcon = statusCfg.icon
          return (
            <div key={bc.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <p className="font-semibold text-gray-900 dark:text-white">{bc.name}</p>
                    <span className={cn('flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium', statusCfg.color)}>
                      <StatusIcon className="w-3 h-3" /> {statusCfg.label}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{bc.message}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {bc.targetType}</span>
                    <span>{formatTime(bc.createdAt)}</span>
                    {bc.stats && <span>✅ {bc.stats.sent}/{bc.stats.total} sent</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {bc.status === 'DRAFT' && (
                    <button
                      onClick={() => sendMutation.mutate(bc.id)}
                      disabled={sendMutation.isPending}
                      className="flex items-center gap-1.5 text-xs px-3 py-2 bg-whatsapp text-white rounded-lg hover:bg-emerald-600 transition font-medium"
                    >
                      <Send className="w-3 h-3" /> Send Now
                    </button>
                  )}
                  {['DRAFT', 'FAILED'].includes(bc.status) && (
                    <button
                      onClick={() => deleteMutation.mutate(bc.id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
