'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import Link from 'next/link'
import { ArrowLeft, MessageSquare, Bot, User, Shield, Star } from 'lucide-react'
import { formatTime, cn } from '@/lib/utils'

export default function ContactDetailPage({ params }: { params: { id: string } }) {
  const queryClient = useQueryClient()

  const { data: contact, isLoading } = useQuery({
    queryKey: ['contact', params.id],
    queryFn: () => api.get(`/contacts/${params.id}`).then(r => r.data),
  })

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.patch(`/contacts/${params.id}`, data),
    onSuccess: () => {
      toast.success('Saved')
      queryClient.invalidateQueries({ queryKey: ['contact', params.id] })
    },
  })

  if (isLoading) return <div className="p-8 text-gray-400 text-sm text-center">Loading...</div>
  if (!contact) return <div className="p-8 text-gray-400 text-sm text-center">Contact not found</div>

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <Link href="/dashboard/contacts" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
        <ArrowLeft className="w-4 h-4" /> Back to Contacts
      </Link>

      {/* Contact header */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
            <span className="text-emerald-700 dark:text-emerald-400 font-bold text-2xl">
              {(contact.name || contact.phoneNumber || '?')[0].toUpperCase()}
            </span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                {contact.displayName || contact.name || 'Unknown Contact'}
              </h1>
              {contact.isVip && <span className="text-sm text-amber-500">⭐ VIP</span>}
              {contact.isBlocked && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">Blocked</span>}
            </div>
            <p className="text-gray-500 font-mono text-sm">{contact.phoneNumber}</p>
            <p className="text-xs text-gray-400 mt-1">First seen {formatTime(contact.firstSeenAt)} · Last message {contact.lastMessageAt ? formatTime(contact.lastMessageAt) : 'never'}</p>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href={`/dashboard/inbox${contact.conversations?.[0]?.id ? '/' + contact.conversations[0].id : ''}`}
          className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-whatsapp transition"
        >
          <MessageSquare className="w-5 h-5 text-whatsapp" />
          <div>
            <p className="font-semibold text-sm text-gray-900 dark:text-white">View Conversations</p>
            <p className="text-xs text-gray-400">{contact.conversations?.length || 0} total</p>
          </div>
        </Link>
        <button
          onClick={() => updateMutation.mutate({ isVip: !contact.isVip })}
          className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-amber-200 transition text-left"
        >
          <Star className={cn('w-5 h-5', contact.isVip ? 'text-amber-500 fill-amber-500' : 'text-gray-300')} />
          <div>
            <p className="font-semibold text-sm text-gray-900 dark:text-white">{contact.isVip ? 'Remove VIP' : 'Mark as VIP'}</p>
            <p className="text-xs text-gray-400">VIP contacts get priority</p>
          </div>
        </button>
      </div>

      {/* Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 divide-y divide-gray-50 dark:divide-gray-700">
        {[
          { key: 'autoreplyEnabled', label: 'Auto-reply', desc: 'Let the bot automatically reply to this contact', icon: Bot },
          { key: 'humanTakeover', label: 'Human Takeover', desc: 'Disable bot and handle this contact manually', icon: User },
          { key: 'approvalMode', label: 'Approval Mode', desc: 'Review bot replies before they are sent', icon: Shield },
        ].map(({ key, label, desc, icon: Icon }) => (
          <div key={key} className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Icon className="w-4 h-4 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
                <p className="text-xs text-gray-400">{desc}</p>
              </div>
            </div>
            <button
              onClick={() => updateMutation.mutate({ [key]: !(contact as any)[key] })}
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                (contact as any)[key] ? 'bg-whatsapp' : 'bg-gray-200 dark:bg-gray-600'
              )}
            >
              <span className={cn(
                'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                (contact as any)[key] ? 'translate-x-6' : 'translate-x-1'
              )} />
            </button>
          </div>
        ))}
      </div>

      {/* Notes */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
        <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-3">Internal Notes</label>
        <textarea
          defaultValue={contact.notes || ''}
          onBlur={e => updateMutation.mutate({ notes: e.target.value })}
          rows={3}
          placeholder="Add private notes about this contact..."
          className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-whatsapp resize-none"
        />
        <p className="text-xs text-gray-400 mt-1">Notes are private — not shown to the contact.</p>
      </div>
    </div>
  )
}
