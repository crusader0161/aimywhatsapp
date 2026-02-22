import {
  makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  proto,
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import { mkdirSync } from 'fs'
import QRCode from 'qrcode'
import { prisma } from '../../db/prisma'
import { MessageRouter } from '../router'

export interface SessionInfo {
  sessionId: string
  workspaceId: string
  accountId: string
  status: 'connecting' | 'qr_ready' | 'connected' | 'disconnected' | 'error'
  qrCode?: string
  socket?: ReturnType<typeof makeWASocket>
  reconnectAttempts: number
}

export class WASessionManager {
  private static instance: WASessionManager
  private sessions: Map<string, SessionInfo> = new Map()
  private io: any // Socket.io server instance

  static getInstance(): WASessionManager {
    if (!WASessionManager.instance) {
      WASessionManager.instance = new WASessionManager()
    }
    return WASessionManager.instance
  }

  setIO(io: any) {
    this.io = io
  }

  getStatus(sessionId: string): SessionInfo | null {
    return this.sessions.get(sessionId) || null
  }

  async startSession(
    sessionId: string,
    workspaceId: string,
    accountId: string,
    credsPath: string
  ): Promise<string> {
    // If already connected, return existing QR or status
    const existing = this.sessions.get(sessionId)
    if (existing?.status === 'connected') {
      throw new Error('Session already connected')
    }

    // Ensure credentials directory exists
    mkdirSync(credsPath, { recursive: true })

    const { state, saveCreds } = await useMultiFileAuthState(credsPath)
    const { version } = await fetchLatestBaileysVersion()

    const sessionInfo: SessionInfo = {
      sessionId,
      workspaceId,
      accountId,
      status: 'connecting',
      reconnectAttempts: 0,
    }
    this.sessions.set(sessionId, sessionInfo)

    await prisma.whatsappSession.update({
      where: { id: sessionId },
      data: { status: 'CONNECTING' },
    })

    return new Promise((resolve, reject) => {
      let qrResolved = false

      const socket = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, console as any),
        },
        printQRInTerminal: false,
        browser: ['Aimywhatsapp', 'Chrome', '120.0'],
        syncFullHistory: false,
        generateHighQualityLinkPreview: false,
      })

      sessionInfo.socket = socket

      socket.ev.on('creds.update', saveCreds)

      socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update

        if (qr) {
          const qrDataUrl = await QRCode.toDataURL(qr)
          sessionInfo.qrCode = qrDataUrl
          sessionInfo.status = 'qr_ready'

          await prisma.whatsappSession.update({
            where: { id: sessionId },
            data: { status: 'QR_READY' },
          })

          this.emitToWorkspace(workspaceId, 'whatsapp:status', {
            sessionId,
            status: 'qr_ready',
            qrCode: qrDataUrl,
          })

          if (!qrResolved) {
            qrResolved = true
            resolve(qrDataUrl)
          }
        }

        if (connection === 'open') {
          sessionInfo.status = 'connected'
          sessionInfo.qrCode = undefined
          sessionInfo.reconnectAttempts = 0

          const phoneNumber = socket.user?.id?.split(':')[0] ?? undefined
          const displayName = socket.user?.name ?? undefined

          await prisma.whatsappSession.update({
            where: { id: sessionId },
            data: { status: 'CONNECTED', phoneNumber, displayName },
          })

          this.emitToWorkspace(workspaceId, 'whatsapp:status', {
            sessionId,
            status: 'connected',
            phoneNumber,
            displayName,
          })

          if (!qrResolved) {
            qrResolved = true
            resolve('')
          }
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut

          sessionInfo.status = 'disconnected'

          if (statusCode === DisconnectReason.loggedOut) {
            await prisma.whatsappSession.update({
              where: { id: sessionId },
              data: { status: 'DISCONNECTED' },
            })
            this.emitToWorkspace(workspaceId, 'whatsapp:status', { sessionId, status: 'disconnected' })
          } else if (shouldReconnect) {
            // Exponential backoff reconnect
            const delay = Math.min(
              1000 * Math.pow(2, sessionInfo.reconnectAttempts),
              60000
            )
            sessionInfo.reconnectAttempts++

            setTimeout(() => {
              this.startSession(sessionId, workspaceId, accountId, credsPath).catch(() => {})
            }, delay)

            await prisma.whatsappSession.update({
              where: { id: sessionId },
              data: { status: 'CONNECTING' },
            })
          }

          if (!qrResolved) {
            qrResolved = true
            reject(new Error('Connection closed'))
          }
        }
      })

      // Handle incoming messages
      socket.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return
        for (const message of messages) {
          if (message.key.fromMe) continue
          await MessageRouter.handleIncoming(sessionId, workspaceId, message)
        }
      })

      // Handle message delivery updates
      socket.ev.on('message-receipt.update', async (updates) => {
        for (const update of updates) {
          const waMessageId = update.key.id
          if (!waMessageId) continue

          const msg = await prisma.message.findUnique({ where: { waMessageId } })
          if (!msg) continue

          if (update.receipt.receiptTimestamp) {
            await prisma.message.update({
              where: { waMessageId },
              data: { deliveredAt: new Date(Number(update.receipt.receiptTimestamp) * 1000) },
            })
          }
          if (update.receipt.readTimestamp) {
            await prisma.message.update({
              where: { waMessageId },
              data: { readAt: new Date(Number(update.receipt.readTimestamp) * 1000) },
            })
          }
        }
      })
    })
  }

  async requestPairingCode(sessionId: string, phoneNumber: string): Promise<string> {
    const session = this.sessions.get(sessionId)
    if (!session?.socket) throw new Error('Session not started. Call startSession first.')

    const cleanNumber = phoneNumber.replace(/[^0-9]/g, '')
    const code = await session.socket.requestPairingCode(cleanNumber)
    return code
  }

  async sendMessage(sessionId: string, jid: string, content: string): Promise<string | undefined> {
    const session = this.sessions.get(sessionId)
    if (!session?.socket) throw new Error('Session not connected')

    const result = await session.socket.sendMessage(jid, { text: content })
    return result?.key.id
  }

  async sendMedia(
    sessionId: string,
    jid: string,
    mediaBuffer: Buffer,
    mediaType: 'image' | 'video' | 'audio' | 'document',
    caption?: string,
    filename?: string
  ): Promise<string | undefined> {
    const session = this.sessions.get(sessionId)
    if (!session?.socket) throw new Error('Session not connected')

    let result
    if (mediaType === 'image') {
      result = await session.socket.sendMessage(jid, { image: mediaBuffer, caption })
    } else if (mediaType === 'video') {
      result = await session.socket.sendMessage(jid, { video: mediaBuffer, caption })
    } else if (mediaType === 'audio') {
      result = await session.socket.sendMessage(jid, { audio: mediaBuffer, ptt: true })
    } else {
      result = await session.socket.sendMessage(jid, {
        document: mediaBuffer,
        mimetype: 'application/octet-stream',
        fileName: filename || 'file',
        caption,
      })
    }
    return result?.key.id
  }

  async disconnectSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (session?.socket) {
      await session.socket.logout()
    }
    this.sessions.delete(sessionId)
  }

  emitToWorkspace(workspaceId: string, event: string, data: unknown) {
    if (this.io) {
      this.io.to(`workspace:${workspaceId}`).emit(event, data)
    }
  }
}
