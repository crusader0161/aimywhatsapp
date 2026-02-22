import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/prisma'
import { authenticate, requireWorkspaceMember } from '../lib/auth'
import { WASessionManager } from '../services/whatsapp/session-manager'

const manager = WASessionManager.getInstance()

const createSessionSchema = z.object({
  accountId: z.string().default('default'),
  workspaceId: z.string(),
})

const createAccountSchema = z.object({
  workspaceId: z.string(),
  name: z.string().optional(),
  phoneNumber: z.string().optional(),
})

const pairingSchema = z.object({
  phoneNumber: z.string().min(7),
})

export default async function whatsappRoutes(app: FastifyInstance) {
  // All routes require auth
  app.addHook('preHandler', authenticate)

  // GET /whatsapp/accounts?workspaceId=<id> - alias for sessions filtered by workspace
  app.get('/accounts', async (req: FastifyRequest, reply: FastifyReply) => {
    const query = z.object({ workspaceId: z.string().optional() }).parse(req.query)
    const user = req.user as { id: string }

    if (query.workspaceId) {
      // Verify workspace membership
      const membership = await prisma.workspaceUser.findUnique({
        where: { workspaceId_userId: { workspaceId: query.workspaceId, userId: user.id } },
      })
      if (!membership) return reply.code(403).send({ error: 'Forbidden' })

      const sessions = await prisma.whatsappSession.findMany({
        where: { workspaceId: query.workspaceId },
      })
      return reply.send(sessions)
    }

    // No workspaceId: return all sessions for user's workspaces
    const userWorkspaces = await prisma.workspaceUser.findMany({ where: { userId: user.id } })
    const workspaceIds = userWorkspaces.map((w) => w.workspaceId)
    const sessions = await prisma.whatsappSession.findMany({
      where: { workspaceId: { in: workspaceIds } },
    })
    return reply.send(sessions)
  })

  // POST /whatsapp/accounts - create a WhatsApp account/session (alias for POST /sessions)
  app.post('/accounts', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = createAccountSchema.parse(req.body)
    const user = req.user as { id: string }

    const membership = await prisma.workspaceUser.findUnique({
      where: { workspaceId_userId: { workspaceId: body.workspaceId, userId: user.id } },
    })
    if (!membership) return reply.code(403).send({ error: 'Forbidden' })

    // Use name as accountId slug, or generate one
    const accountId = body.name
      ? body.name.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 32)
      : `account-${Date.now()}`

    const existingSession = await prisma.whatsappSession.findUnique({
      where: { workspaceId_accountId: { workspaceId: body.workspaceId, accountId } },
    })
    if (existingSession) return reply.code(409).send({ error: 'Account already exists with this name' })

    const credsPath = `${process.env.WA_SESSION_PATH || './data/wa-sessions'}/${body.workspaceId}/${accountId}`

    const session = await prisma.whatsappSession.create({
      data: {
        workspaceId: body.workspaceId,
        accountId,
        credsPath,
        status: 'DISCONNECTED',
      },
    })

    return reply.code(201).send(session)
  })

  // GET /whatsapp/accounts/:id/qr - get QR code for a specific account (by DB id)
  app.get('/accounts/:id/qr', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const session = await prisma.whatsappSession.findUnique({ where: { id: req.params.id } })
    if (!session) return reply.code(404).send({ error: 'Account not found' })

    try {
      const qrCode = await manager.startSession(session.id, session.workspaceId, session.accountId, session.credsPath)
      return reply.send({ qrCode, sessionId: session.id })
    } catch (err: any) {
      return reply.code(500).send({ error: err.message })
    }
  })

  // GET /whatsapp/accounts/:id/status - get status for a specific account (by DB id)
  app.get('/accounts/:id/status', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const session = await prisma.whatsappSession.findUnique({ where: { id: req.params.id } })
    if (!session) return reply.code(404).send({ error: 'Account not found' })
    const runtimeStatus = manager.getStatus(session.id)
    return reply.send({ ...session, runtimeStatus })
  })

  // GET /whatsapp/sessions
  app.get('/sessions', async (req: FastifyRequest, reply: FastifyReply) => {
    const user = req.user as { id: string }
    const userWorkspaces = await prisma.workspaceUser.findMany({ where: { userId: user.id } })
    const workspaceIds = userWorkspaces.map((w) => w.workspaceId)

    const sessions = await prisma.whatsappSession.findMany({
      where: { workspaceId: { in: workspaceIds } },
    })
    return reply.send(sessions)
  })

  // POST /whatsapp/sessions
  app.post('/sessions', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = createSessionSchema.parse(req.body)
    const user = req.user as { id: string }

    // Verify workspace membership
    const membership = await prisma.workspaceUser.findUnique({
      where: { workspaceId_userId: { workspaceId: body.workspaceId, userId: user.id } },
    })
    if (!membership) return reply.code(403).send({ error: 'Forbidden' })

    const existingSession = await prisma.whatsappSession.findUnique({
      where: { workspaceId_accountId: { workspaceId: body.workspaceId, accountId: body.accountId } },
    })
    if (existingSession) return reply.code(409).send({ error: 'Session already exists for this accountId' })

    const credsPath = `${process.env.WA_SESSION_PATH}/${body.workspaceId}/${body.accountId}`

    const session = await prisma.whatsappSession.create({
      data: {
        workspaceId: body.workspaceId,
        accountId: body.accountId,
        credsPath,
        status: 'DISCONNECTED',
      },
    })

    return reply.code(201).send(session)
  })

  // GET /whatsapp/sessions/:id/status
  app.get('/sessions/:id/status', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const session = await prisma.whatsappSession.findUnique({ where: { id: req.params.id } })
    if (!session) return reply.code(404).send({ error: 'Session not found' })

    const runtimeStatus = manager.getStatus(session.id)
    return reply.send({
      ...session,
      runtimeStatus,
    })
  })

  // GET /whatsapp/sessions/:id/qr
  app.get('/sessions/:id/qr', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const session = await prisma.whatsappSession.findUnique({ where: { id: req.params.id } })
    if (!session) return reply.code(404).send({ error: 'Session not found' })

    try {
      const qrCode = await manager.startSession(session.id, session.workspaceId, session.accountId, session.credsPath)
      return reply.send({ qrCode, sessionId: session.id })
    } catch (err: any) {
      return reply.code(500).send({ error: err.message })
    }
  })

  // POST /whatsapp/sessions/:id/pair
  app.post('/sessions/:id/pair', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const body = pairingSchema.parse(req.body)
    const session = await prisma.whatsappSession.findUnique({ where: { id: req.params.id } })
    if (!session) return reply.code(404).send({ error: 'Session not found' })

    try {
      const code = await manager.requestPairingCode(session.id, body.phoneNumber)
      return reply.send({ code, phoneNumber: body.phoneNumber })
    } catch (err: any) {
      return reply.code(500).send({ error: err.message })
    }
  })

  // POST /whatsapp/sessions/:id/disconnect
  app.post('/sessions/:id/disconnect', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const session = await prisma.whatsappSession.findUnique({ where: { id: req.params.id } })
    if (!session) return reply.code(404).send({ error: 'Session not found' })

    await manager.disconnectSession(session.id)
    await prisma.whatsappSession.update({
      where: { id: session.id },
      data: { status: 'DISCONNECTED' },
    })
    return reply.code(204).send()
  })

  // DELETE /whatsapp/sessions/:id
  app.delete('/sessions/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const session = await prisma.whatsappSession.findUnique({ where: { id: req.params.id } })
    if (!session) return reply.code(404).send({ error: 'Session not found' })

    await manager.disconnectSession(session.id)
    await prisma.whatsappSession.delete({ where: { id: session.id } })
    return reply.code(204).send()
  })
}
