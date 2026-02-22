'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useWorkspaceStore } from '@/stores/workspace'
import { useAuthStore } from '@/stores/auth'
import { Trash2, UserPlus, Crown, Shield, User, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const ROLE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  OWNER: { label: 'Owner', icon: Crown, color: 'text-amber-500' },
  ADMIN: { label: 'Admin', icon: Shield, color: 'text-blue-500' },
  AGENT: { label: 'Agent', icon: User, color: 'text-emerald-500' },
  VIEWER: { label: 'Viewer', icon: Eye, color: 'text-gray-400' },
}

export default function TeamPage() {
  const { currentWorkspace } = useWorkspaceStore()
  const { user } = useAuthStore()
  const queryClient = useQueryClient()

  const { data: members } = useQuery({
    queryKey: ['team', currentWorkspace?.id],
    queryFn: () => api.get(`/workspaces/${currentWorkspace!.id}/users`).then(r => r.data),
    enabled: !!currentWorkspace?.id,
  })

  const removeMutation = useMutation({
    mutationFn: (userId: string) => api.delete(`/workspaces/${currentWorkspace!.id}/users/${userId}`),
    onSuccess: () => {
      toast.success('Member removed')
      queryClient.invalidateQueries({ queryKey: ['team'] })
    },
    onError: () => toast.error('Failed to remove member'),
  })

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Team Members</h1>
        <p className="text-sm text-gray-500 mt-1">Manage who has access to your workspace</p>
      </div>

      {/* Members list */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700">
        {members?.map((member: any) => {
          const roleCfg = ROLE_CONFIG[member.role] || ROLE_CONFIG.AGENT
          const RoleIcon = roleCfg.icon
          const isMe = member.userId === user?.id || member.user?.id === user?.id

          return (
            <div key={member.id} className="flex items-center gap-4 p-4">
              <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold text-sm">
                  {(member.user?.name || 'U')[0].toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {member.user?.name || 'Unknown'}
                  </p>
                  {isMe && <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 px-1.5 py-0.5 rounded">You</span>}
                </div>
                <p className="text-xs text-gray-400">{member.user?.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn('flex items-center gap-1.5 text-xs font-medium', roleCfg.color)}>
                  <RoleIcon className="w-3.5 h-3.5" />
                  {roleCfg.label}
                </span>
                {!isMe && member.role !== 'OWNER' && (
                  <button
                    onClick={() => removeMutation.mutate(member.userId)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition ml-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Invite section */}
      <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <UserPlus className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm text-emerald-800 dark:text-emerald-300">Invite Team Members</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
              Team invite via email is coming in Phase 2. For now, team members can register and you can share workspace access through the API.
            </p>
          </div>
        </div>
      </div>

      {/* Role descriptions */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
        <h3 className="font-semibold text-sm text-gray-900 dark:text-white mb-4">Role Permissions</h3>
        <div className="space-y-3">
          {Object.entries(ROLE_CONFIG).map(([role, cfg]) => {
            const descriptions: Record<string, string> = {
              OWNER: 'Full access including billing and deletion. Cannot be removed.',
              ADMIN: 'Manage settings, contacts, flows, and knowledge bases.',
              AGENT: 'View and reply to conversations. Cannot change settings.',
              VIEWER: 'Read-only access to conversations and analytics.',
            }
            return (
              <div key={role} className="flex items-center gap-3">
                <cfg.icon className={cn('w-4 h-4 flex-shrink-0', cfg.color)} />
                <div>
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{cfg.label}</span>
                  <span className="text-xs text-gray-400 ml-2">{descriptions[role]}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
