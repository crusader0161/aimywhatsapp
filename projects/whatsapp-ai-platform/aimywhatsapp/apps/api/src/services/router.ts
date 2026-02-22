import { proto } from '@whiskeysockets/baileys'
import { prisma } from '../db/prisma'
import { AIEngine } from './ai/engine'
import { WASessionManager } from './whatsapp/session-manager'
import { downloadMediaMessage } from '@whiskeysockets/baileys'

export class MessageRouter {
  static async handleIncoming(
    sessionId: string,
    workspaceId: string,
    waMessage: proto.IWebMessageInfo
  ): Promise<void> {
    const jid = waMessage.key.remoteJid!
    if (!jid || jid.includes('@g.us')) return // Skip groups for now

    const text =
      waMessage.message?.conversation ||
      waMessage.message?.extendedTextMessage?.text ||
      waMessage.message?.imageMessage?.caption ||
      waMessage.message?.videoMessage?.caption ||
      ''

    // Determine media type
    let mediaType: string | null = null
    let mediaBuffer: Buffer | null = null

    if (waMessage.message?.imageMessage) mediaType = 'IMAGE'
    else if (waMessage.message?.videoMessage) mediaType = 'VIDEO'
    else if (waMessage.message?.audioMessage) mediaType = 'AUDIO'
    else if (waMessage.message?.documentMessage) mediaType = 'DOCUMENT'
    else if (waMessage.message?.stickerMessage) mediaType = 'STICKER'
    else if (waMessage.message?.locationMessage) mediaType = 'LOCATION'

    // Download media if needed
    if (mediaType && ['IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT'].includes(mediaType)) {
      try {
        const session = WASessionManager.getInstance().getStatus(sessionId)
        if (session?.socket) {
          mediaBuffer = await downloadMediaMessage(
            waMessage,
            'buffer',
            {},
            { logger: console as any, reuploadRequest: session.socket.updateMediaMessage }
          ) as Buffer
        }
      } catch (err) {
        console.error('Failed to download media:', err)
      }
    }

    // Get or create contact
    const phoneNumber = jid.replace('@s.whatsapp.net', '')
    const contact = await prisma.contact.upsert({
      where: { workspaceId_jid: { workspaceId, jid } },
      create: {
        workspaceId,
        sessionId,
        jid,
        phoneNumber: `+${phoneNumber}`,
        name: waMessage.pushName || undefined,
        firstSeenAt: new Date(),
        lastMessageAt: new Date(),
      },
      update: {
        lastMessageAt: new Date(),
        name: waMessage.pushName || undefined,
      },
    })

    // Get or create conversation
    let conversation = await prisma.conversation.findFirst({
      where: { contactId: contact.id, status: 'OPEN' },
    })

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          workspaceId,
          sessionId,
          contactId: contact.id,
          status: 'OPEN',
          lastMessageAt: new Date(),
        },
      })
    } else {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
          unreadCount: { increment: 1 },
        },
      })
    }

    // Save inbound message
    const savedMessage = await prisma.message.create({
      data: {
        workspaceId,
        conversationId: conversation.id,
        waMessageId: waMessage.key.id!,
        direction: 'INBOUND',
        senderType: 'CONTACT',
        content: text,
        mediaType: mediaType as any,
      },
    })

    // Emit to live monitor
    const manager = WASessionManager.getInstance()
    ;(manager as any).emitToWorkspace?.(workspaceId, 'message:new', {
      message: savedMessage,
      conversation: { id: conversation.id, contactId: contact.id },
    })

    // === ROUTING LOGIC ===

    // 1. Blocked? → drop
    if (contact.isBlocked) return

    // 2. Human takeover active? → notify human, skip bot
    if (contact.humanTakeover) {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { status: 'WAITING_HUMAN' },
      })
      return
    }

    // 3. Auto-reply disabled for this contact? → skip
    if (!contact.autoreplyEnabled) return

    // 4. No text and no processable media? → skip
    if (!text && !mediaBuffer) return

    // 5. Route to AI Engine
    const settings = await prisma.workspaceSettings.findUnique({
      where: { workspaceId },
    })
    if (!settings) return

    try {
      // Approval mode: draft and wait for human approval
      if (contact.approvalMode) {
        const aiResponse = await AIEngine.generate({
          workspaceId,
          contact,
          text,
          mediaType: mediaType as any,
          mediaBuffer,
          conversationId: conversation.id,
          settings,
        })

        await prisma.message.create({
          data: {
            workspaceId,
            conversationId: conversation.id,
            direction: 'OUTBOUND',
            senderType: 'BOT',
            content: aiResponse.reply,
            confidence: aiResponse.confidence,
            kbChunksUsed: aiResponse.kbChunksUsed,
            isApproved: false, // pending approval
          },
        })

        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { status: 'PENDING_APPROVAL' },
        })

        return
      }

      // Normal mode: auto send
      const aiResponse = await AIEngine.generate({
        workspaceId,
        contact,
        text,
        mediaType: mediaType as any,
        mediaBuffer,
        conversationId: conversation.id,
        settings,
      })

      // Should escalate?
      if (aiResponse.shouldEscalate) {
        const escalationMsg = settings.humanEscalationMessage ||
          "I'm connecting you with a human agent who can better assist you."

        await WASessionManager.getInstance().sendMessage(sessionId, jid, escalationMsg)

        await prisma.message.create({
          data: {
            workspaceId,
            conversationId: conversation.id,
            direction: 'OUTBOUND',
            senderType: 'BOT',
            content: escalationMsg,
            confidence: aiResponse.confidence,
          },
        })

        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { status: 'WAITING_HUMAN' },
        })
        return
      }

      // Send AI reply
      const waMessageId = await WASessionManager.getInstance().sendMessage(
        sessionId,
        jid,
        aiResponse.reply
      )

      const outboundMessage = await prisma.message.create({
        data: {
          workspaceId,
          conversationId: conversation.id,
          waMessageId,
          direction: 'OUTBOUND',
          senderType: 'BOT',
          content: aiResponse.reply,
          confidence: aiResponse.confidence,
          kbChunksUsed: aiResponse.kbChunksUsed,
          sentiment: aiResponse.sentiment as any,
          isApproved: true,
        },
      })

      // Emit outbound to monitor
      ;(manager as any).emitToWorkspace?.(workspaceId, 'message:new', {
        message: outboundMessage,
        conversation: { id: conversation.id },
      })

    } catch (err) {
      console.error('AI Engine error:', err)
    }
  }
}
