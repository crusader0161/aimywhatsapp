import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/prisma'
import { authenticate } from '../lib/auth'
import { subDays, startOfDay } from 'date-fns'

const querySchema = z.object({
  workspaceId: z.string(),
  days: z.coerce.number().default(30),
})

export default async function analyticsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)

  // GET /analytics - root alias for overview
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, days } = querySchema.parse(req.query)
    const since = subDays(new Date(), days)

    const [
      totalMessages,
      totalContacts,
      totalConversations,
      openConversations,
      resolvedConversations,
      botMessages,
      humanMessages,
    ] = await Promise.all([
      prisma.message.count({ where: { workspaceId, createdAt: { gte: since } } }),
      prisma.contact.count({ where: { workspaceId, firstSeenAt: { gte: since } } }),
      prisma.conversation.count({ where: { workspaceId, createdAt: { gte: since } } }),
      prisma.conversation.count({ where: { workspaceId, status: 'OPEN' } }),
      prisma.conversation.count({ where: { workspaceId, status: 'RESOLVED', resolvedAt: { gte: since } } }),
      prisma.message.count({ where: { workspaceId, senderType: 'BOT', createdAt: { gte: since } } }),
      prisma.message.count({ where: { workspaceId, senderType: 'HUMAN', createdAt: { gte: since } } }),
    ])

    const botResolutionRate = totalConversations > 0
      ? Math.round((resolvedConversations / totalConversations) * 100)
      : 0

    return reply.send({
      totalMessages,
      totalContacts,
      totalConversations,
      openConversations,
      resolvedConversations,
      botMessages,
      humanMessages,
      botResolutionRate,
      period: `${days} days`,
    })
  })

  // GET /analytics/overview
  app.get('/overview', async (req: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, days } = querySchema.parse(req.query)
    const since = subDays(new Date(), days)

    const [
      totalMessages,
      totalContacts,
      totalConversations,
      openConversations,
      resolvedConversations,
      botMessages,
      humanMessages,
    ] = await Promise.all([
      prisma.message.count({ where: { workspaceId, createdAt: { gte: since } } }),
      prisma.contact.count({ where: { workspaceId, firstSeenAt: { gte: since } } }),
      prisma.conversation.count({ where: { workspaceId, createdAt: { gte: since } } }),
      prisma.conversation.count({ where: { workspaceId, status: 'OPEN' } }),
      prisma.conversation.count({ where: { workspaceId, status: 'RESOLVED', resolvedAt: { gte: since } } }),
      prisma.message.count({ where: { workspaceId, senderType: 'BOT', createdAt: { gte: since } } }),
      prisma.message.count({ where: { workspaceId, senderType: 'HUMAN', createdAt: { gte: since } } }),
    ])

    const botResolutionRate = totalConversations > 0
      ? Math.round((resolvedConversations / totalConversations) * 100)
      : 0

    return reply.send({
      totalMessages,
      totalContacts,
      totalConversations,
      openConversations,
      resolvedConversations,
      botMessages,
      humanMessages,
      botResolutionRate,
      period: `${days} days`,
    })
  })

  // GET /analytics/messages - volume over time
  app.get('/messages', async (req: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, days } = querySchema.parse(req.query)

    const messages = await prisma.$queryRaw`
      SELECT
        DATE_TRUNC('day', "createdAt") as date,
        COUNT(*) FILTER (WHERE direction = 'INBOUND') as inbound,
        COUNT(*) FILTER (WHERE direction = 'OUTBOUND') as outbound,
        COUNT(*) FILTER (WHERE "senderType" = 'BOT') as bot,
        COUNT(*) FILTER (WHERE "senderType" = 'HUMAN') as human
      FROM "Message"
      WHERE "workspaceId" = ${workspaceId}
        AND "createdAt" >= ${subDays(new Date(), days)}
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY date ASC
    `

    // Prisma $queryRaw returns COUNT() as BigInt — convert to Number for JSON serialization
    const serializeRows = (rows: any[]) =>
      rows.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'bigint' ? Number(v) : v])))
    return reply.send(serializeRows(messages as any[]))
  })

  // GET /analytics/contacts - growth over time
  app.get('/contacts', async (req: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, days } = querySchema.parse(req.query)

    const contacts = await prisma.$queryRaw`
      SELECT
        DATE_TRUNC('day', "firstSeenAt") as date,
        COUNT(*) as new_contacts
      FROM "Contact"
      WHERE "workspaceId" = ${workspaceId}
        AND "firstSeenAt" >= ${subDays(new Date(), days)}
      GROUP BY DATE_TRUNC('day', "firstSeenAt")
      ORDER BY date ASC
    `

    const serializeRows = (rows: any[]) =>
      rows.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'bigint' ? Number(v) : v])))
    return reply.send(serializeRows(contacts as any[]))
  })

  // GET /analytics/sentiment
  app.get('/sentiment', async (req: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, days } = querySchema.parse(req.query)
    const since = subDays(new Date(), days)

    const [positive, neutral, negative] = await Promise.all([
      prisma.message.count({ where: { workspaceId, sentiment: 'POSITIVE', direction: 'INBOUND', createdAt: { gte: since } } }),
      prisma.message.count({ where: { workspaceId, sentiment: 'NEUTRAL', direction: 'INBOUND', createdAt: { gte: since } } }),
      prisma.message.count({ where: { workspaceId, sentiment: 'NEGATIVE', direction: 'INBOUND', createdAt: { gte: since } } }),
    ])

    return reply.send({ positive, neutral, negative })
  })

  // GET /analytics/bot-performance
  app.get('/bot-performance', async (req: FastifyRequest, reply: FastifyReply) => {
    const { workspaceId, days } = querySchema.parse(req.query)
    const since = subDays(new Date(), days)

    const botMessages = await prisma.message.findMany({
      where: {
        workspaceId,
        senderType: 'BOT',
        confidence: { not: null },
        createdAt: { gte: since },
      },
      select: { confidence: true },
    })

    const avgConfidence = botMessages.length > 0
      ? botMessages.reduce((sum, m) => sum + (m.confidence || 0), 0) / botMessages.length
      : 0

    const escalations = await prisma.conversation.count({
      where: { workspaceId, status: 'WAITING_HUMAN', createdAt: { gte: since } },
    })

    return reply.send({
      totalBotReplies: botMessages.length,
      avgConfidence: Math.round(avgConfidence * 100) / 100,
      escalations,
    })
  })
}
