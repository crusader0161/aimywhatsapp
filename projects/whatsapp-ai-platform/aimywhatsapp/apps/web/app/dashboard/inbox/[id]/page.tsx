'use client'
import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { getSocket } from '@/lib/socket'
import { formatTime, cn } from '@/lib/utils'
import {
  Send, Bot, User, UserX, RefreshCw, CheckCircle,
  Image, Mic, FileText, ThumbsUp, ThumbsDown, MoreVertical, ArrowLeft
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'

export default function ConversationPage({ params }: { params: { id: string } }) {
  const [message, setMessage] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()
  const router = useRouter()

  const { data: conv, isLoading } = useQuery({
    queryKey: ['conversation', params.id],
    queryFn: () => api.get(`/conversations/${params.id}`).then(r => r.data),
    refetchInterval: 10000,
  })

  // Socket live updates
  useEffect(() => {
    const socket = getSocket()
    socket.emit('join_conversation', { conversationId: params.id })
    socket.on('message:new', (data: any) => {
      if (data.conversation?.id === params.id) {
        queryClient.invalidateQueries({ queryKey: ['conversation', params.id] })
      }
    })
    return () => { socket.off('message:new') }
  }, [params.id, queryClient])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [conv?.messages?.length])

  const sendMutation = useMutation({
    mutationFn: (content: string) =>
      api.post(`/conversations/${params.id}/messages`, { content }),
    onSuccess: () => {
      setMessage('')
      queryClient.invalidateQueries({ queryKey: ['conversation', params.id] })
    },
    onError: () => toast.error('Failed to send message'),
  })

  const takeoverMutation = useMutation({
    mutationFn: () => api.post(`/contacts/${conv?.contact?.id}/takeover`),
    onSuccess: () => { toast.success('Human takeover enabled'); queryClient.invalidateQueries() },
  })

  const releaseMutation = useMutation({
    mutationFn: () => api.post(`/contacts/${conv?.contact?.id}/release`),
    onSuccess: () => { toast.success('Bot re-enabled'); queryClient.invalidateQueries() },
  })

  const resolveMutation = useMutation({
    mutationFn: () => api.post(`/conversations/${params.id}/resolve`),
    onSuccess: () => { toast.success('Conversation resolved'); queryClient.invalidateQueries() },
  })

  const approveMutation = useMutation({
    mutationFn: (msgId: string) => api.post(`/conversations/${params.id}/messages/${msgId}/approve`),
    onSuccess: () => { toast.success('Reply sent'); queryClient.invalidateQueries() },
  })

  const rejectMutation = useMutation({
    mutationFn: (msgId: string) => api.delete(`/conversations/${params.id}/messages/${msgId}/approve`),
    onSuccess: () => { toast.success('Reply rejected'); queryClient.invalidateQueries() },
  })

  const handleSend = () => {
    if (!message.trim()) return
    sendMutation.mutate(message.trim())
  }

  if (isLoading) return <div className="flex-1 flex items-center justify-center text-gray-400">Loading...</div>
  if (!conv) return <div className="flex-1 flex items-center justify-center text-gray-400">Conversation not found</div>

  const contact = conv.contact
  const isTakeover = contact?.humanTakeover
  const pendingApproval = conv.messages?.filter((m: any) => m.isApproved === false) || []

  return (
    <div className="flex h-full">
      {/* Conversation thread */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Contact header */}
        <div className="flex items-center justify-between px-3 sm:px-5 py-3.5 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Back button — mobile only */}
            <button
              onClick={() => router.push('/dashboard/inbox')}
              className="lg:hidden p-1.5 -ml-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold text-sm">
                {(contact?.name || contact?.phoneNumber || '?')[0].toUpperCase()}
              </span>
            </div>
            <div>
              <p className="font-semibold text-sm text-gray-900 dark:text-white">
                {contact?.displayName || contact?.name || contact?.phoneNumber}
              </p>
              <p className="text-xs text-gray-400">{contact?.phoneNumber}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {isTakeover ? (
              <button
                onClick={() => releaseMutation.mutate()}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-lg hover:bg-emerald-100 transition font-medium"
              >
                <Bot className="w-3.5 h-3.5" /> Hand back to bot
              </button>
            ) : (
              <button
                onClick={() => takeoverMutation.mutate()}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-lg hover:bg-amber-100 transition font-medium"
              >
                <User className="w-3.5 h-3.5" /> Take over
              </button>
            )}
            <button
              onClick={() => resolveMutation.mutate()}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-200 transition font-medium"
            >
              <CheckCircle className="w-3.5 h-3.5" /> Resolve
            </button>
          </div>
        </div>

        {/* Approval banner */}
        {pendingApproval.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800 px-5 py-3">
            <p className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-2">
              🤖 Bot reply pending your approval
            </p>
            {pendingApproval.map((msg: any) => (
              <div key={msg.id} className="flex items-center gap-3">
                <p className="text-sm text-blue-600 dark:text-blue-300 flex-1 italic">"{msg.content}"</p>
                <button onClick={() => approveMutation.mutate(msg.id)} className="p-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition">
                  <ThumbsUp className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => rejectMutation.mutate(msg.id)} className="p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition">
                  <ThumbsDown className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-[#f0f2f5] dark:bg-gray-950">
          {conv.messages?.map((msg: any) => {
            const isInbound = msg.direction === 'INBOUND'
            const isBot = msg.senderType === 'BOT'
            return (
              <div key={msg.id} className={cn('flex', isInbound ? 'justify-start' : 'justify-end')}>
                <div className={cn(
                  'max-w-[70%] rounded-xl px-4 py-2.5 shadow-sm',
                  isInbound
                    ? 'bg-white dark:bg-gray-800 rounded-tl-sm'
                    : 'bg-whatsapp-light dark:bg-emerald-900/60 rounded-tr-sm'
                )}>
                  {!isInbound && (
                    <p className={cn('text-xs font-semibold mb-1', isBot ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400')}>
                      {isBot ? '🤖 Bot' : '👤 You'}
                    </p>
                  )}
                  <p className="text-sm text-gray-800 dark:text-gray-100 whitespace-pre-wrap">{msg.content}</p>
                  <div className="flex items-center justify-end gap-2 mt-1">
                    {msg.confidence != null && (
                      <span className="text-xs text-gray-400">{Math.round(msg.confidence * 100)}%</span>
                    )}
                    <span className="text-xs text-gray-400">{formatTime(msg.createdAt)}</span>
                  </div>
                </div>
              </div>
            )
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <div className="bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 p-3 flex items-center gap-3">
          {isTakeover && (
            <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-1 rounded-lg font-medium flex-shrink-0">
              Human mode
            </span>
          )}
          <input
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder={isTakeover ? 'Reply as human...' : 'Bot is handling this. Take over to reply manually.'}
            disabled={!isTakeover}
            className="flex-1 px-4 py-2.5 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-whatsapp focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSend}
            disabled={!message.trim() || !isTakeover || sendMutation.isPending}
            className="w-10 h-10 bg-whatsapp text-white rounded-xl flex items-center justify-center hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Right panel: Contact info */}
      <div className="w-64 border-l border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-y-auto">
        <div className="p-5">
          <div className="flex flex-col items-center text-center mb-5">
            <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mb-3">
              <span className="text-emerald-700 dark:text-emerald-400 font-bold text-xl">
                {(contact?.name || contact?.phoneNumber || '?')[0].toUpperCase()}
              </span>
            </div>
            <p className="font-semibold text-gray-900 dark:text-white">{contact?.displayName || contact?.name || contact?.phoneNumber}</p>
            <p className="text-xs text-gray-400 mt-0.5">{contact?.phoneNumber}</p>
          </div>

          <div className="space-y-3 text-sm">
            {[
              { label: 'Auto-reply', value: contact?.autoreplyEnabled ? '✅ On' : '❌ Off' },
              { label: 'Human takeover', value: contact?.humanTakeover ? '✅ Active' : '—' },
              { label: 'Approval mode', value: contact?.approvalMode ? '✅ On' : '—' },
              { label: 'VIP', value: contact?.isVip ? '⭐ Yes' : '—' },
              { label: 'First seen', value: contact?.firstSeenAt ? new Date(contact.firstSeenAt).toLocaleDateString() : '—' },
              { label: 'Language', value: contact?.language || 'Auto' },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between py-2 border-b border-gray-50 dark:border-gray-800">
                <span className="text-gray-500 dark:text-gray-400">{label}</span>
                <span className="font-medium text-gray-900 dark:text-white">{value}</span>
              </div>
            ))}
          </div>

          {contact?.notes && (
            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">Notes</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">{contact.notes}</p>
            </div>
          )}

          <Link
            href={`/dashboard/contacts/${contact?.id}`}
            className="mt-4 block text-center text-xs text-whatsapp hover:underline"
          >
            View full contact →
          </Link>
        </div>
      </div>
    </div>
  )
}
