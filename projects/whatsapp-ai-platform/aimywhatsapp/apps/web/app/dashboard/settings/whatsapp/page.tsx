'use client'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useWorkspaceStore } from '@/stores/workspace'
import { getSocket } from '@/lib/socket'
import { toast } from 'sonner'
import { Wifi, WifiOff, RefreshCw, Smartphone, QrCode, Phone, Trash2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import Image from 'next/image'

export default function WhatsAppSettingsPage() {
  const { currentWorkspace } = useWorkspaceStore()
  const queryClient = useQueryClient()
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [pairingMode, setPairingMode] = useState(false)
  const [phoneInput, setPhoneInput] = useState('')
  const [pairingCode, setPairingCode] = useState<string | null>(null)
  const [loadingQr, setLoadingQr] = useState(false)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['whatsapp-sessions', currentWorkspace?.id],
    queryFn: () => api.get('/whatsapp/sessions').then(r => r.data),
    refetchInterval: 5000,
  })

  // Socket: listen for WA status updates
  useEffect(() => {
    if (!currentWorkspace?.id) return
    const socket = getSocket()
    socket.emit('join_workspace', { workspaceId: currentWorkspace.id })
    socket.on('whatsapp:status', (data: any) => {
      if (data.status === 'qr_ready') setQrCode(data.qrCode)
      if (data.status === 'connected') {
        setQrCode(null)
        setPairingCode(null)
        toast.success('✅ WhatsApp connected successfully!')
        queryClient.invalidateQueries({ queryKey: ['whatsapp-sessions'] })
      }
      if (data.status === 'disconnected') {
        setQrCode(null)
        queryClient.invalidateQueries({ queryKey: ['whatsapp-sessions'] })
      }
    })
    return () => { socket.off('whatsapp:status') }
  }, [currentWorkspace?.id, queryClient])

  const createSessionMutation = useMutation({
    mutationFn: () => api.post('/whatsapp/sessions', { workspaceId: currentWorkspace!.id }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-sessions'] })
      return res.data.id
    },
    onError: () => toast.error('Failed to create session'),
  })

  const connectQR = async (sessionId?: string) => {
    setLoadingQr(true)
    setQrCode(null)
    setPairingCode(null)
    setPairingMode(false)
    try {
      let sid = sessionId
      if (!sid) {
        const res = await api.post('/whatsapp/sessions', { workspaceId: currentWorkspace!.id })
        sid = res.data.id
        queryClient.invalidateQueries({ queryKey: ['whatsapp-sessions'] })
      }
      setActiveSessionId(sid!)
      const res = await api.get(`/whatsapp/sessions/${sid}/qr`)
      if (res.data.qrCode) setQrCode(res.data.qrCode)
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to get QR code')
    } finally {
      setLoadingQr(false)
    }
  }

  const requestPairing = async () => {
    if (!activeSessionId || !phoneInput) return
    try {
      const res = await api.post(`/whatsapp/sessions/${activeSessionId}/pair`, { phoneNumber: phoneInput })
      setPairingCode(res.data.code)
    } catch {
      toast.error('Failed to get pairing code')
    }
  }

  const disconnectMutation = useMutation({
    mutationFn: (id: string) => api.post(`/whatsapp/sessions/${id}/disconnect`),
    onSuccess: () => { toast.success('Disconnected'); queryClient.invalidateQueries({ queryKey: ['whatsapp-sessions'] }) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/whatsapp/sessions/${id}`),
    onSuccess: () => { toast.success('Session deleted'); queryClient.invalidateQueries({ queryKey: ['whatsapp-sessions'] }); setQrCode(null) },
  })

  const connectedSessions = sessions?.filter((s: any) => s.status === 'CONNECTED') || []
  const hasSession = sessions?.length > 0

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">WhatsApp Connection</h1>
        <p className="text-sm text-gray-500 mt-1">Connect your WhatsApp number to start the AI bot.</p>
      </div>

      {/* Active sessions */}
      {sessions?.map((session: any) => (
        <div key={session.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center',
                session.status === 'CONNECTED' ? 'bg-emerald-50 dark:bg-emerald-900/30' : 'bg-gray-100 dark:bg-gray-700'
              )}>
                <Smartphone className={cn('w-5 h-5', session.status === 'CONNECTED' ? 'text-emerald-600' : 'text-gray-400')} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">
                    {session.displayName || session.phoneNumber || `Account: ${session.accountId}`}
                  </p>
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded-full font-medium',
                    session.status === 'CONNECTED' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' :
                    session.status === 'CONNECTING' ? 'bg-amber-100 text-amber-700' :
                    'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                  )}>
                    {session.status === 'CONNECTED' ? '🟢 Connected' :
                     session.status === 'CONNECTING' ? '🟡 Connecting...' :
                     session.status === 'QR_READY' ? '🔵 Scan QR' : '⚫ Disconnected'}
                  </span>
                </div>
                {session.phoneNumber && <p className="text-xs text-gray-400 mt-0.5">{session.phoneNumber}</p>}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {session.status !== 'CONNECTED' && (
                <button
                  onClick={() => connectQR(session.id)}
                  className="text-xs px-3 py-1.5 bg-whatsapp text-white rounded-lg hover:bg-emerald-600 transition font-medium"
                >
                  Connect
                </button>
              )}
              {session.status === 'CONNECTED' && (
                <button
                  onClick={() => disconnectMutation.mutate(session.id)}
                  className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-200 transition"
                >
                  Disconnect
                </button>
              )}
              <button
                onClick={() => deleteMutation.mutate(session.id)}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* Connect new */}
      {!qrCode && !pairingCode && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
            {hasSession ? 'Connect another number' : 'Connect your WhatsApp'}
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => connectQR()}
              disabled={loadingQr}
              className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-whatsapp hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition group"
            >
              <QrCode className="w-8 h-8 text-gray-400 group-hover:text-whatsapp transition" />
              <div className="text-center">
                <p className="font-medium text-sm text-gray-700 dark:text-gray-300">Scan QR Code</p>
                <p className="text-xs text-gray-400 mt-0.5">Use WhatsApp → Linked Devices</p>
              </div>
            </button>

            <button
              onClick={() => { connectQR(); setPairingMode(true) }}
              disabled={loadingQr}
              className="flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-whatsapp hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition group"
            >
              <Phone className="w-8 h-8 text-gray-400 group-hover:text-whatsapp transition" />
              <div className="text-center">
                <p className="font-medium text-sm text-gray-700 dark:text-gray-300">Pairing Code</p>
                <p className="text-xs text-gray-400 mt-0.5">Enter phone number instead</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* QR Code display */}
      {(qrCode || loadingQr) && !pairingMode && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6 flex flex-col items-center">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Scan QR Code</h3>
          <p className="text-sm text-gray-500 mb-5 text-center">
            Open <strong>WhatsApp</strong> → <strong>Settings</strong> → <strong>Linked Devices</strong> → <strong>Link a Device</strong>
          </p>
          {loadingQr && !qrCode ? (
            <div className="w-48 h-48 flex items-center justify-center">
              <RefreshCw className="w-8 h-8 text-gray-300 animate-spin" />
            </div>
          ) : qrCode ? (
            <div className="p-3 bg-white rounded-xl border-2 border-gray-100">
              <img src={qrCode} alt="QR Code" width={180} height={180} />
            </div>
          ) : null}
          <p className="text-xs text-gray-400 mt-4">QR code refreshes automatically. Waiting for scan...</p>
          <button
            onClick={() => { setQrCode(null); setPairingCode(null) }}
            className="mt-3 text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Pairing code mode */}
      {pairingMode && !pairingCode && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Enter Phone Number</h3>
          <p className="text-sm text-gray-500 mb-4">We'll generate a 8-digit code to link your WhatsApp.</p>
          <div className="flex gap-3">
            <input
              value={phoneInput}
              onChange={e => setPhoneInput(e.target.value)}
              placeholder="+91 9876543210"
              className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-whatsapp"
            />
            <button
              onClick={requestPairing}
              className="px-5 py-2.5 bg-whatsapp text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition"
            >
              Get Code
            </button>
          </div>
        </div>
      )}

      {/* Show pairing code */}
      {pairingCode && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6 flex flex-col items-center">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Your Pairing Code</h3>
          <p className="text-sm text-gray-500 mb-5 text-center">
            Open WhatsApp → Settings → Linked Devices → Link with phone number → Enter this code
          </p>
          <div className="flex gap-3">
            {pairingCode.split('').map((char, i) => (
              <div key={i} className="w-10 h-12 bg-emerald-50 dark:bg-emerald-900/30 border-2 border-emerald-200 dark:border-emerald-700 rounded-lg flex items-center justify-center">
                <span className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{char}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-5">Waiting for confirmation...</p>
          <button
            onClick={() => { setPairingCode(null); setPairingMode(false) }}
            className="mt-3 text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Help */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-sm text-blue-700 dark:text-blue-400">
        <p className="font-medium mb-1">💡 Tips</p>
        <ul className="space-y-1 text-xs text-blue-600 dark:text-blue-300">
          <li>• Keep your phone connected to the internet for the bot to work</li>
          <li>• Using a dedicated number (not your personal) is recommended</li>
          <li>• The bot won't work if WhatsApp is opened on your phone simultaneously on the same session</li>
        </ul>
      </div>
    </div>
  )
}
