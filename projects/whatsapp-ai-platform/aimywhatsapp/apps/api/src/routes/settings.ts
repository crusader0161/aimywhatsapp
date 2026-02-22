import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/prisma'
import { authenticate } from '../lib/auth'
import { generateApiKey } from '../lib/auth'
import { createHash } from 'crypto'

const settingsSchema = z.object({
  botName: z.string().optional(),
  botPersona: z.string().optional(),
  aiProvider: z.enum(['anthropic', 'openai']).optional(),
  aiModel: z.string().optional(),
  aiTemperature: z.number().min(0).max(1).optional(),
  confidenceThreshold: z.number().min(0).max(1).optional(),
  defaultLanguage: z.string().optional(),
  businessHoursEnabled: z.boolean().optional(),
  businessHoursConfig: z.any().optional(),
  awayMessage: z.string().optional(),
  welcomeMessage: z.string().optional(),
  humanEscalationMessage: z.string().optional(),
  maxConversationHistory: z.number().min(5).max(100).optional(),
})

export default async function settingsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)

  // GET /settings?workspaceId=...
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const query = z.object({ workspaceId: z.string() }).parse(req.query)
    const settings = await prisma.workspaceSettings.findUnique({
      where: { workspaceId: query.workspaceId },
    })
    if (!settings) return reply.code(404).send({ error: 'Settings not found' })
    return reply.send(settings)
  })

  // PATCH /settings?workspaceId=...
  app.patch('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const query = z.object({ workspaceId: z.string() }).parse(req.query)
    const body = settingsSchema.parse(req.body)

    const settings = await prisma.workspaceSettings.upsert({
      where: { workspaceId: query.workspaceId },
      create: { workspaceId: query.workspaceId, ...body },
      update: body,
    })
    return reply.send(settings)
  })

  // GET /settings/webhooks
  app.get('/webhooks', async (req: FastifyRequest, reply: FastifyReply) => {
    const query = z.object({ workspaceId: z.string() }).parse(req.query)
    const webhooks = await prisma.webhook.findMany({
      where: { workspaceId: query.workspaceId },
    })
    return reply.send(webhooks)
  })

  // POST /settings/webhooks
  app.post('/webhooks', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      workspaceId: z.string(),
      name: z.string().min(1),
      url: z.string().url(),
      secret: z.string().optional(),
      events: z.array(z.string()),
    }).parse(req.body)

    const webhook = await prisma.webhook.create({ data: body })
    return reply.code(201).send(webhook)
  })

  // PATCH /settings/webhooks/:id
  app.patch('/webhooks/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const body = z.object({
      name: z.string().optional(),
      url: z.string().url().optional(),
      secret: z.string().optional(),
      events: z.array(z.string()).optional(),
      isActive: z.boolean().optional(),
    }).parse(req.body)

    const webhook = await prisma.webhook.update({ where: { id: req.params.id }, data: body })
    return reply.send(webhook)
  })

  // DELETE /settings/webhooks/:id
  app.delete('/webhooks/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    await prisma.webhook.delete({ where: { id: req.params.id } })
    return reply.code(204).send()
  })

  // GET /settings/api-keys
  app.get('/api-keys', async (req: FastifyRequest, reply: FastifyReply) => {
    const query = z.object({ workspaceId: z.string() }).parse(req.query)
    const keys = await prisma.apiKey.findMany({
      where: { workspaceId: query.workspaceId },
      select: { id: true, name: true, keyPreview: true, lastUsedAt: true, createdAt: true, expiresAt: true },
    })
    return reply.send(keys)
  })

  // POST /settings/api-keys
  app.post('/api-keys', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      workspaceId: z.string(),
      name: z.string().min(1),
      expiresAt: z.string().datetime().optional(),
    }).parse(req.body)

    const rawKey = generateApiKey()
    const keyHash = createHash('sha256').update(rawKey).digest('hex')
    const keyPreview = rawKey.slice(0, 12) + '...'

    const apiKey = await prisma.apiKey.create({
      data: {
        workspaceId: body.workspaceId,
        name: body.name,
        keyHash,
        keyPreview,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      },
    })

    // Return the raw key ONCE (never stored in plain text)
    return reply.code(201).send({ ...apiKey, key: rawKey })
  })

  // DELETE /settings/api-keys/:id
  app.delete('/api-keys/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    await prisma.apiKey.delete({ where: { id: req.params.id } })
    return reply.code(204).send()
  })

  // GET /settings/audit-log
  app.get('/audit-log', async (req: FastifyRequest, reply: FastifyReply) => {
    const query = z.object({
      workspaceId: z.string(),
      page: z.coerce.number().default(1),
      limit: z.coerce.number().default(50),
    }).parse(req.query)

    const skip = (query.page - 1) * query.limit
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: { workspaceId: query.workspaceId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit,
      }),
      prisma.auditLog.count({ where: { workspaceId: query.workspaceId } }),
    ])

    return reply.send({
      data: logs,
      pagination: { total, page: query.page, limit: query.limit, pages: Math.ceil(total / query.limit) },
    })
  })
}
