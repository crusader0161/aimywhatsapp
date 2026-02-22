import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/prisma'
import { authenticate } from '../lib/auth'

const updateContactSchema = z.object({
  displayName: z.string().optional(),
  notes: z.string().optional(),
  autoreplyEnabled: z.boolean().optional(),
  approvalMode: z.boolean().optional(),
  isVip: z.boolean().optional(),
})

const filterSchema = z.object({
  workspaceId: z.string(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(50),
  search: z.string().optional(),
  labelId: z.string().optional(),
  autoreply: z.enum(['true', 'false']).optional(),
  takeover: z.enum(['true', 'false']).optional(),
  blocked: z.enum(['true', 'false']).optional(),
})

export default async function contactRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)

  // GET /contacts
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const query = filterSchema.parse(req.query)
    const skip = (query.page - 1) * query.limit

    const where: any = { workspaceId: query.workspaceId }
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { displayName: { contains: query.search, mode: 'insensitive' } },
        { phoneNumber: { contains: query.search } },
      ]
    }
    if (query.labelId) {
      where.labels = { some: { labelId: query.labelId } }
    }
    if (query.autoreply !== undefined) where.autoreplyEnabled = query.autoreply === 'true'
    if (query.takeover !== undefined) where.humanTakeover = query.takeover === 'true'
    if (query.blocked !== undefined) where.isBlocked = query.blocked === 'true'

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { lastMessageAt: 'desc' },
        include: { labels: { include: { label: true } } },
      }),
      prisma.contact.count({ where }),
    ])

    return reply.send({
      data: contacts,
      pagination: { total, page: query.page, limit: query.limit, pages: Math.ceil(total / query.limit) },
    })
  })

  // GET /contacts/:id
  app.get('/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const contact = await prisma.contact.findUnique({
      where: { id: req.params.id },
      include: {
        labels: { include: { label: true } },
        customFields: true,
        conversations: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: { id: true, status: true, lastMessageAt: true, unreadCount: true },
        },
      },
    })
    if (!contact) return reply.code(404).send({ error: 'Contact not found' })
    return reply.send(contact)
  })

  // PATCH /contacts/:id
  app.patch('/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const body = updateContactSchema.parse(req.body)
    const contact = await prisma.contact.update({
      where: { id: req.params.id },
      data: body,
    })
    return reply.send(contact)
  })

  // DELETE /contacts/:id
  app.delete('/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    await prisma.contact.delete({ where: { id: req.params.id } })
    return reply.code(204).send()
  })

  // POST /contacts/:id/block
  app.post('/:id/block', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const contact = await prisma.contact.update({
      where: { id: req.params.id },
      data: { isBlocked: true, autoreplyEnabled: false },
    })
    return reply.send(contact)
  })

  // POST /contacts/:id/unblock
  app.post('/:id/unblock', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const contact = await prisma.contact.update({
      where: { id: req.params.id },
      data: { isBlocked: false },
    })
    return reply.send(contact)
  })

  // POST /contacts/:id/takeover
  app.post('/:id/takeover', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const contact = await prisma.contact.update({
      where: { id: req.params.id },
      data: { humanTakeover: true },
    })
    return reply.send(contact)
  })

  // POST /contacts/:id/release
  app.post('/:id/release', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const contact = await prisma.contact.update({
      where: { id: req.params.id },
      data: { humanTakeover: false },
    })
    return reply.send(contact)
  })

  // POST /contacts/:id/labels
  app.post('/:id/labels', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const body = z.object({ labelId: z.string() }).parse(req.body)
    await prisma.contactLabel.upsert({
      where: { contactId_labelId: { contactId: req.params.id, labelId: body.labelId } },
      create: { contactId: req.params.id, labelId: body.labelId },
      update: {},
    })
    return reply.code(201).send({ success: true })
  })

  // DELETE /contacts/:id/labels/:labelId
  app.delete('/:id/labels/:labelId', async (
    req: FastifyRequest<{ Params: { id: string; labelId: string } }>,
    reply: FastifyReply
  ) => {
    await prisma.contactLabel.delete({
      where: { contactId_labelId: { contactId: req.params.id, labelId: req.params.labelId } },
    })
    return reply.code(204).send()
  })

  // GET /contacts/labels
  app.get('/labels', async (req: FastifyRequest, reply: FastifyReply) => {
    const query = z.object({ workspaceId: z.string() }).parse(req.query)
    const labels = await prisma.label.findMany({ where: { workspaceId: query.workspaceId } })
    return reply.send(labels)
  })

  // POST /contacts/labels
  app.post('/labels', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({ workspaceId: z.string(), name: z.string(), color: z.string().optional() }).parse(req.body)
    const label = await prisma.label.create({ data: body })
    return reply.code(201).send(label)
  })

  // DELETE /contacts/labels/:id
  app.delete('/labels/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    await prisma.label.delete({ where: { id: req.params.id } })
    return reply.code(204).send()
  })
}
