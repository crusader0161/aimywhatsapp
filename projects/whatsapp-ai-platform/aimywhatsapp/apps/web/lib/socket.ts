import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '@/stores/auth'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    const token = useAuthStore.getState().accessToken
    socket = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001', {
      path: '/ws',
      auth: { token },
      transports: ['websocket', 'polling'],
      autoConnect: true,
    })

    socket.on('connect', () => console.log('[WS] Connected:', socket?.id))
    socket.on('disconnect', (reason) => console.log('[WS] Disconnected:', reason))
    socket.on('connect_error', (err) => console.error('[WS] Error:', err.message))
  }
  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
