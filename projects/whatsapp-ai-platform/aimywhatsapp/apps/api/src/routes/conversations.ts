import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/prisma'
import { authenticate } from '../lib/auth'
import { WASessionManager } from '../services/whatsapp/session-manager'

const manager = WASessionManager.getInstance()

export default async function conversationRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)

  // GET /conversations
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const query = z.object({
      workspaceId: z.string(),
      page: z.coerce.number().default(1),
      limit: z.coerce.number().default(30),
      status: z.enum(['OPEN', 'RESOLVED', 'WAITING_HUMAN', 'PENDING_APPROVAL']).optional(),
      search: z.string().optional(),
    }).parse(req.query)

    const skip = (query.page - 1) * query.limit
    const where: any = { workspaceId: query.workspaceId }
    if (query.status) where.status = query.status
    if (query.search) {
      where.contact = {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { phoneNumber: { contains: query.search } },
        ],
      }
    }

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { lastMessageAt: 'desc' },
        include: {
          contact: {
            include: { labels: { include: { label: true } } },
          },
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: { id: true, content: true, direction: true, senderType: true, createdAt: true, mediaType: true },
          },
        },
      }),
      prisma.conversation.count({ where }),
    ])

    return reply.send({
      data: conversations,
      pagination: { total, page: query.page, limit: query.limit, pages: Math.ceil(total / query.limit) },
    })
  })

  // GET /conversations/:id
  app.get('/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const conversation = await prisma.conversation.findUnique({
      where: { id: req.params.id },
      include: {
        contact: { include: { labels: { include: { label: true } } } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    })
    if (!conversation) return reply.code(404).send({ error: 'Conversation not found' })

    // Mark as read
    await prisma.conversation.update({
      where: { id: req.params.id },
      data: { unreadCount: 0 },
    })

    return reply.send(conversation)
  })

  // PATCH /conversations/:id
  app.patch('/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const body = z.object({
      status: z.enum(['OPEN', 'RESOLVED', 'WAITING_HUMAN', 'PENDING_APPROVAL']).optional(),
      assignedUserId: z.string().nullable().optional(),
    }).parse(req.body)

    const conversation = await prisma.conversation.update({
      where: { id: req.params.id },
      data: body,
    })
    return reply.send(conversation)
  })

  // POST /conversations/:id/resolve
  app.post('/:id/resolve', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const conversation = await prisma.conversation.update({
      where: { id: req.params.id },
      data: { status: 'RESOLVED', resolvedAt: new Date() },
    })
    return reply.send(conversation)
  })

  // POST /conversations/:id/reopen
  app.post('/:id/reopen', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const conversation = await prisma.conversation.update({
      where: { id: req.params.id },
      data: { status: 'OPEN', resolvedAt: null },
    })
    return reply.send(conversation)
  })

  // POST /conversations/:id/messages - send manual message (human agent)
  app.post('/:id/messages', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const body = z.object({
      content: z.string().min(1),
      mediaUrl: z.string().url().optional(),
    }).parse(req.body)

    const user = req.user as { id: string }

    const conversation = await prisma.conversation.findUnique({
      where: { id: req.params.id },
      include: { contact: true, session: true },
    })
    if (!conversation) return reply.code(404).send({ error: 'Conversation not found' })

    // Send via WhatsApp
    await manager.sendMessage(conversation.sessionId, conversation.contact.jid, body.content)

    // Save to DB
    const message = await prisma.message.create({
      data: {
        workspaceId: conversation.workspaceId,
        conversationId: conversation.id,
        direction: 'OUTBOUND',
        senderType: 'HUMAN',
        senderUserId: user.id,
        content: body.content,
        mediaUrl: body.mediaUrl,
      },
    })

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    })

    return reply.code(201).send(message)
  })

  // POST /conversations/:id/messages/:msgId/approve
  app.post('/:id/messages/:msgId/approve', async (
    req: FastifyRequest<{ Params: { id: string; msgId: string } }>,
    reply: FastifyReply
  ) => {
    const message = await prisma.message.findUnique({ where: { id: req.params.msgId } })
    if (!message || message.isApproved !== false) {
      return reply.code(404).send({ error: 'Pending message not found' })
    }

    // Get conversation + contact to send the message
    const conversation = await prisma.conversation.findUnique({
      where: { id: req.params.id },
      include: { contact: true },
    })
    if (!conversation) return reply.code(404).send({ error: 'Conversation not found' })

    // Send it now
    await manager.sendMessage(conversation.sessionId, conversation.contact.jid, message.content)

    const updated = await prisma.message.update({
      where: { id: req.params.msgId },
      data: { isApproved: true },
    })

    return reply.send(updated)
  })

  // DELETE /conversations/:id/messages/:msgId/approve (reject)
  app.delete('/:id/messages/:msgId/approve', async (
    req: FastifyRequest<{ Params: { id: string; msgId: string } }>,
    reply: FastifyReply
  ) => {
    await prisma.message.delete({ where: { id: req.params.msgId } })
    return reply.code(204).send()
  })
}
