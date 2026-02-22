'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useWorkspaceStore } from '@/stores/workspace'
import { GitBranch, Plus, Play, Pause, Trash2, Pencil, Zap, MessageSquare, Tag, Clock, Globe } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const TRIGGER_ICONS: Record<string, any> = {
  FIRST_MESSAGE: MessageSquare,
  KEYWORD: Zap,
  LABEL_ADDED: Tag,
  INBOUND_MEDIA: Globe,
  SCHEDULED: Clock,
  API: Globe,
}

const TRIGGER_LABELS: Record<string, string> = {
  FIRST_MESSAGE: 'First message',
  KEYWORD: 'Keyword match',
  LABEL_ADDED: 'Label added',
  INBOUND_MEDIA: 'Media received',
  SCHEDULED: 'Scheduled',
  API: 'API trigger',
}

export default function FlowsPage() {
  const { currentWorkspace } = useWorkspaceStore()
  const queryClient = useQueryClient()
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newTrigger, setNewTrigger] = useState('KEYWORD')

  const { data: flows, isLoading } = useQuery({
    queryKey: ['flows', currentWorkspace?.id],
    queryFn: () => api.get(`/flows?workspaceId=${currentWorkspace!.id}`).then(r => r.data),
    enabled: !!currentWorkspace?.id,
  })

  const createMutation = useMutation({
    mutationFn: () => api.post('/flows', {
      workspaceId: currentWorkspace!.id,
      name: newName,
      triggerType: newTrigger,
      triggerConfig: {},
      nodes: [],
      edges: [],
    }),
    onSuccess: (res) => {
      setShowNew(false)
      setNewName('')
      queryClient.invalidateQueries({ queryKey: ['flows'] })
      toast.success('Flow created')
    },
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.post(`/flows/${id}/${active ? 'activate' : 'deactivate'}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['flows'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/flows/${id}`),
    onSuccess: () => {
      toast.success('Flow deleted')
      queryClient.invalidateQueries({ queryKey: ['flows'] })
    },
  })

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Flow Builder</h1>
          <p className="text-sm text-gray-500 mt-0.5">Automate conversations with visual flows</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-whatsapp text-white rounded-xl text-sm font-semibold hover:bg-emerald-600 transition"
        >
          <Plus className="w-4 h-4" /> New Flow
        </button>
      </div>

      {/* New flow form */}
      {showNew && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-emerald-200 dark:border-emerald-800 p-5 space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Create New Flow</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Flow Name</label>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g. Welcome Flow"
                className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-whatsapp"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Trigger</label>
              <select
                value={newTrigger}
                onChange={e => setNewTrigger(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-whatsapp"
              >
                {Object.entries(TRIGGER_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => createMutation.mutate()}
              disabled={!newName || createMutation.isPending}
              className="px-5 py-2 bg-whatsapp text-white rounded-lg text-sm font-medium hover:bg-emerald-600 disabled:opacity-40 transition"
            >
              Create Flow
            </button>
            <button
              onClick={() => { setShowNew(false); setNewName('') }}
              className="px-5 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-lg text-sm hover:bg-gray-200 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Flow cards */}
      {isLoading && <p className="text-sm text-gray-400 text-center py-8">Loading flows...</p>}

      {!isLoading && flows?.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-12 text-center">
          <GitBranch className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="font-medium text-gray-700 dark:text-gray-300">No flows yet</p>
          <p className="text-sm text-gray-400 mt-1">Create a flow to automate conversations without AI</p>
          <button
            onClick={() => setShowNew(true)}
            className="mt-4 px-4 py-2 bg-whatsapp text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition"
          >
            Create your first flow
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {flows?.map((flow: any) => {
          const TriggerIcon = TRIGGER_ICONS[flow.triggerType] || Zap
          return (
            <div key={flow.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 hover:border-emerald-200 dark:hover:border-emerald-800 transition group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
                    <TriggerIcon className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-900 dark:text-white">{flow.name}</p>
                    <p className="text-xs text-gray-400">{TRIGGER_LABELS[flow.triggerType]}</p>
                  </div>
                </div>
                <span className={cn(
                  'text-xs px-2 py-1 rounded-full font-medium',
                  flow.isActive
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                    : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                )}>
                  {flow.isActive ? '● Active' : '○ Inactive'}
                </span>
              </div>

              {flow.stats && (
                <div className="flex gap-4 mb-4 text-xs text-gray-500 dark:text-gray-400">
                  <span>{flow.stats.totalEntered} entered</span>
                  <span>{flow.stats.totalCompleted} completed</span>
                </div>
              )}

              <div className="flex items-center gap-2 mt-auto pt-3 border-t border-gray-50 dark:border-gray-700">
                <Link
                  href={`/dashboard/flows/${flow.id}`}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-200 transition font-medium"
                >
                  <Pencil className="w-3 h-3" /> Edit
                </Link>
                <button
                  onClick={() => toggleMutation.mutate({ id: flow.id, active: !flow.isActive })}
                  className={cn(
                    'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition',
                    flow.isActive
                      ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400'
                  )}
                >
                  {flow.isActive ? <><Pause className="w-3 h-3" /> Pause</> : <><Play className="w-3 h-3" /> Activate</>}
                </button>
                <button
                  onClick={() => deleteMutation.mutate(flow.id)}
                  className="ml-auto p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
