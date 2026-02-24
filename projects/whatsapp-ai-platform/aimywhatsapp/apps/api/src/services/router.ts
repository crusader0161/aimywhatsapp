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
    // Strip both @s.whatsapp.net and @lid suffixes to get a clean phone number
    const phoneNumber = '+' + jid.replace('@s.whatsapp.net', '').replace('@lid', '').replace(/^\+/, '')
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
    manager.emitToWorkspace(workspaceId, 'message:new', {
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
    if (!settings) {
      console.warn(`[Router] No workspace settings found for ${workspaceId} — skipping autoreply`)
      return
    }

    // 6. Autoreply mode: CONTACTS_ONLY → only reply to manually added contacts
    const autoreplyMode = (settings as any).autoreplyMode || 'EVERYONE'
    // @lid = alternate address for same real contact (WhatsApp multi-device) — bypass CONTACTS_ONLY
    const isLidJid = jid.endsWith('@lid')
    if (autoreplyMode === 'CONTACTS_ONLY' && !contact.isManuallyAdded && !isLidJid) {
      console.log(`[Router] Skipping autoreply for ${contact.phoneNumber} — not in added contacts (CONTACTS_ONLY mode)`)
      return
    }

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

      // Intercept [[PAYMENT:amount:description]] signal from AI
      let finalReply = aiResponse.reply
      const paymentMatch = finalReply.match(/\[\[PAYMENT:(\d+(?:\.\d+)?):([^\]]+)\]\]/)
      if (paymentMatch) {
        const payAmount = parseFloat(paymentMatch[1])
        const payPurpose = paymentMatch[2].trim()
        try {
          const { createPaymentLink } = await import('./payment/cashfree')
          const paymentResult = await createPaymentLink({
            amount: payAmount,
            purpose: payPurpose,
            customerName: contact.displayName || contact.name || 'Customer',
            customerPhone: contact.phoneNumber,
          })
          await prisma.paymentLink.create({
            data: {
              workspaceId,
              sessionId,
              contactId: contact.id,
              cashfreeLinkId: paymentResult.linkId,
              paymentUrl: paymentResult.linkUrl,
              amount: payAmount,
              purpose: payPurpose,
            },
          })
          finalReply = finalReply.replace(/\[\[PAYMENT:[^\]]+\]\]/, paymentResult.linkUrl)
          console.log(`[Router] Payment link generated for ${contact.phoneNumber}: ₹${payAmount}`)
        } catch (err: any) {
          console.error('[Router] Payment link error:', err?.message)
          finalReply = finalReply.replace(/\[\[PAYMENT:[^\]]+\]\]/, '(payment link coming shortly — our team will share it with you)')
        }
      }

      // Send AI reply
      const waMessageId = await WASessionManager.getInstance().sendMessage(
        sessionId,
        jid,
        finalReply
      )

      const outboundMessage = await prisma.message.create({
        data: {
          workspaceId,
          conversationId: conversation.id,
          waMessageId,
          direction: 'OUTBOUND',
          senderType: 'BOT',
          content: finalReply,
          confidence: aiResponse.confidence,
          kbChunksUsed: aiResponse.kbChunksUsed,
          sentiment: aiResponse.sentiment as any,
          isApproved: true,
        },
      })

      // Emit outbound to monitor
      manager.emitToWorkspace(workspaceId, 'message:new', {
        message: outboundMessage,
        conversation: { id: conversation.id },
      })

    } catch (err) {
      console.error('AI Engine error:', err)
    }
  }
}
