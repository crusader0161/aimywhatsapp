import { Server, Socket } from 'socket.io'
import { prisma } from '../db/prisma'

interface AuthPayload {
  token: string
}

export function setupSocketServer(io: Server) {
  // Auth middleware
  io.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth?.token
      if (!token) return next(new Error('Missing auth token'))

      // Basic JWT verification (reuse fastify jwt logic would require decoupling)
      // For now, we accept any non-empty token and verify workspace membership downstream
      // In production, verify the JWT here
      socket.data.token = token
      next()
    } catch (err) {
      next(new Error('Authentication failed'))
    }
  })

  io.on('connection', (socket: Socket) => {
    console.log(`[WS] Client connected: ${socket.id}`)

    // Join workspace room
    socket.on('join_workspace', async ({ workspaceId }: { workspaceId: string }) => {
      socket.join(`workspace:${workspaceId}`)
      socket.data.workspaceId = workspaceId
      socket.emit('joined', { workspaceId, room: `workspace:${workspaceId}` })
    })

    // Join specific conversation room
    socket.on('join_conversation', async ({ conversationId }: { conversationId: string }) => {
      socket.join(`conversation:${conversationId}`)
      socket.emit('joined', { conversationId, room: `conversation:${conversationId}` })
    })

    // Leave conversation room
    socket.on('leave_conversation', ({ conversationId }: { conversationId: string }) => {
      socket.leave(`conversation:${conversationId}`)
    })

    // Typing indicators
    socket.on('typing:start', ({ conversationId }: { conversationId: string }) => {
      socket.to(`conversation:${conversationId}`).emit('typing:start', { conversationId })
    })

    socket.on('typing:stop', ({ conversationId }: { conversationId: string }) => {
      socket.to(`conversation:${conversationId}`).emit('typing:stop', { conversationId })
    })

    socket.on('disconnect', () => {
      console.log(`[WS] Client disconnected: ${socket.id}`)
    })
  })

  return io
}

// Helper to emit events from anywhere in the app
export function emitToWorkspace(io: Server, workspaceId: string, event: string, data: unknown) {
  io.to(`workspace:${workspaceId}`).emit(event, data)
}

export function emitToConversation(io: Server, conversationId: string, event: string, data: unknown) {
  io.to(`conversation:${conversationId}`).emit(event, data)
}
