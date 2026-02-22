'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useWorkspaceStore } from '@/stores/workspace'
import { Key, Plus, Trash2, Copy, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { formatTime } from '@/lib/utils'

export default function ApiKeysPage() {
  const { currentWorkspace } = useWorkspaceStore()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKey, setNewKey] = useState<string | null>(null)

  const { data: keys } = useQuery({
    queryKey: ['api-keys', currentWorkspace?.id],
    queryFn: () => api.get(`/settings/api-keys?workspaceId=${currentWorkspace!.id}`).then(r => r.data),
    enabled: !!currentWorkspace?.id,
  })

  const createMutation = useMutation({
    mutationFn: () => api.post('/settings/api-keys', { workspaceId: currentWorkspace!.id, name: newKeyName }),
    onSuccess: (res) => {
      setNewKey(res.data.key)
      setNewKeyName('')
      setShowForm(false)
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
    },
    onError: () => toast.error('Failed to create API key'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/settings/api-keys/${id}`),
    onSuccess: () => { toast.success('Key revoked'); queryClient.invalidateQueries({ queryKey: ['api-keys'] }) },
  })

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key)
    toast.success('Copied to clipboard')
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">API Keys</h1>
          <p className="text-sm text-gray-500 mt-1">Authenticate API requests from external systems</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-whatsapp text-white rounded-xl text-sm font-semibold hover:bg-emerald-600 transition"
        >
          <Plus className="w-4 h-4" /> New Key
        </button>
      </div>

      {/* New key just created */}
      {newKey && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <p className="font-semibold text-amber-800 dark:text-amber-300 text-sm mb-2">⚠️ Copy your API key now — it won't be shown again</p>
          <div className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-lg p-3 font-mono text-sm border border-amber-200 dark:border-amber-700">
            <span className="flex-1 text-gray-800 dark:text-gray-200 break-all">{newKey}</span>
            <button onClick={() => copyKey(newKey)} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded flex-shrink-0">
              <Copy className="w-4 h-4" />
            </button>
          </div>
          <button onClick={() => setNewKey(null)} className="text-xs text-amber-600 hover:underline mt-2">I've saved it, close this</button>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-emerald-200 dark:border-emerald-800 p-5 space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Create API Key</h3>
          <div className="flex gap-3">
            <input
              value={newKeyName}
              onChange={e => setNewKeyName(e.target.value)}
              placeholder="Key name (e.g. Production App)"
              className="flex-1 px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-whatsapp"
              autoFocus
            />
            <button onClick={() => createMutation.mutate()} disabled={!newKeyName} className="px-5 py-2.5 bg-whatsapp text-white rounded-lg text-sm font-medium hover:bg-emerald-600 disabled:opacity-40 transition">Create</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-600 rounded-lg text-sm hover:bg-gray-200 transition">Cancel</button>
          </div>
        </div>
      )}

      {/* Keys list */}
      {!keys?.length && !showForm && !newKey && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-12 text-center">
          <Key className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="font-medium text-gray-700 dark:text-gray-300">No API keys</p>
          <p className="text-sm text-gray-400 mt-1">Create an API key to integrate Aimywhatsapp with other apps</p>
        </div>
      )}

      <div className="space-y-3">
        {keys?.map((key: any) => (
          <div key={key.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 flex items-center gap-4">
            <div className="w-9 h-9 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
              <Key className="w-4 h-4 text-gray-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-gray-900 dark:text-white">{key.name}</p>
              <div className="flex items-center gap-3 mt-0.5">
                <code className="text-xs text-gray-400 font-mono">{key.keyPreview}</code>
                <span className="text-xs text-gray-400">Created {formatTime(key.createdAt)}</span>
                {key.lastUsedAt && <span className="text-xs text-gray-400">Last used {formatTime(key.lastUsedAt)}</span>}
              </div>
            </div>
            <button
              onClick={() => deleteMutation.mutate(key.id)}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Docs */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 text-sm">
        <p className="font-medium text-gray-700 dark:text-gray-300 mb-2">Using the API</p>
        <p className="text-xs text-gray-500 mb-2">Include your API key in the Authorization header:</p>
        <code className="block bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-xs font-mono text-gray-700 dark:text-gray-300">
          Authorization: Bearer aimy_xxxxxxxxxxxxxxxx
        </code>
        <p className="text-xs text-gray-400 mt-2">Base URL: {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'}</p>
      </div>
    </div>
  )
}
