'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useWorkspaceStore } from '@/stores/workspace'
import { Webhook, Plus, Trash2, ToggleLeft, ToggleRight, CheckCircle, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const WEBHOOK_EVENTS = [
  'message.inbound', 'message.outbound', 'contact.new',
  'conversation.opened', 'conversation.resolved',
  'bot.escalation', 'broadcast.sent',
]

export default function WebhooksPage() {
  const { currentWorkspace } = useWorkspaceStore()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', url: '', secret: '', events: [] as string[] })

  const { data: webhooks } = useQuery({
    queryKey: ['webhooks', currentWorkspace?.id],
    queryFn: () => api.get(`/settings/webhooks?workspaceId=${currentWorkspace!.id}`).then(r => r.data),
    enabled: !!currentWorkspace?.id,
  })

  const createMutation = useMutation({
    mutationFn: () => api.post('/settings/webhooks', { ...form, workspaceId: currentWorkspace!.id }),
    onSuccess: () => {
      setShowForm(false)
      setForm({ name: '', url: '', secret: '', events: [] })
      queryClient.invalidateQueries({ queryKey: ['webhooks'] })
      toast.success('Webhook created')
    },
    onError: () => toast.error('Failed to create webhook'),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.patch(`/settings/webhooks/${id}`, { isActive: active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['webhooks'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/settings/webhooks/${id}`),
    onSuccess: () => { toast.success('Deleted'); queryClient.invalidateQueries({ queryKey: ['webhooks'] }) },
  })

  const toggleEvent = (event: string) => {
    setForm(f => ({
      ...f,
      events: f.events.includes(event) ? f.events.filter(e => e !== event) : [...f.events, event],
    }))
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Webhooks</h1>
          <p className="text-sm text-gray-500 mt-1">Get notified at your URL when events happen</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-whatsapp text-white rounded-xl text-sm font-semibold hover:bg-emerald-600 transition"
        >
          <Plus className="w-4 h-4" /> Add Webhook
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-emerald-200 dark:border-emerald-800 p-6 space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">New Webhook</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="My Webhook" className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-whatsapp" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Secret (optional)</label>
              <input value={form.secret} onChange={e => setForm(f => ({ ...f, secret: e.target.value }))} placeholder="For HMAC signature" className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-whatsapp" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">URL</label>
            <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://your-server.com/webhook" className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-whatsapp" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Events</label>
            <div className="flex flex-wrap gap-2">
              {WEBHOOK_EVENTS.map(event => (
                <button
                  key={event}
                  onClick={() => toggleEvent(event)}
                  className={cn(
                    'text-xs px-3 py-1.5 rounded-lg font-medium transition',
                    form.events.includes(event)
                      ? 'bg-whatsapp text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                  )}
                >
                  {event}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => createMutation.mutate()} disabled={!form.name || !form.url || !form.events.length} className="px-5 py-2 bg-whatsapp text-white rounded-lg text-sm font-medium hover:bg-emerald-600 disabled:opacity-40 transition">Create</button>
            <button onClick={() => setShowForm(false)} className="px-5 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-lg text-sm hover:bg-gray-200 transition">Cancel</button>
          </div>
        </div>
      )}

      {!webhooks?.length && !showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-12 text-center">
          <Webhook className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="font-medium text-gray-700 dark:text-gray-300">No webhooks yet</p>
          <p className="text-sm text-gray-400 mt-1">Connect external services to receive real-time events</p>
        </div>
      )}

      <div className="space-y-3">
        {webhooks?.map((wh: any) => (
          <div key={wh.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-sm text-gray-900 dark:text-white">{wh.name}</p>
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', wh.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500')}>
                    {wh.isActive ? 'Active' : 'Inactive'}
                  </span>
                  {wh.failureCount > 0 && <span className="text-xs text-red-500">⚠️ {wh.failureCount} failures</span>}
                </div>
                <p className="text-xs text-gray-400 truncate">{wh.url}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {wh.events?.map((ev: string) => (
                    <span key={ev} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 px-2 py-0.5 rounded">{ev}</span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <button onClick={() => toggleMutation.mutate({ id: wh.id, active: !wh.isActive })} className="text-gray-400 hover:text-whatsapp transition">
                  {wh.isActive ? <ToggleRight className="w-5 h-5 text-whatsapp" /> : <ToggleLeft className="w-5 h-5" />}
                </button>
                <button onClick={() => deleteMutation.mutate(wh.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
