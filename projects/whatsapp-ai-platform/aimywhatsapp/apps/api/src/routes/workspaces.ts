import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/prisma'
import { authenticate } from '../lib/auth'

export default async function workspaceRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)

  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const user = req.user as { id: string }
    const memberships = await prisma.workspaceUser.findMany({
      where: { userId: user.id },
      include: { workspace: true },
    })
    return reply.send(memberships.map((m) => ({ ...m.workspace, role: m.role })))
  })

  app.post('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const user = req.user as { id: string }
    const body = z.object({ name: z.string().min(2) }).parse(req.body)
    const slug = body.name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now()

    const workspace = await prisma.workspace.create({
      data: {
        name: body.name,
        slug,
        users: { create: { userId: user.id, role: 'OWNER' } },
        settings: { create: { botName: 'Aimy' } },
      },
    })
    return reply.code(201).send(workspace)
  })

  app.get('/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const workspace = await prisma.workspace.findUnique({
      where: { id: req.params.id },
      include: { settings: true },
    })
    if (!workspace) return reply.code(404).send({ error: 'Workspace not found' })
    return reply.send(workspace)
  })

  app.patch('/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const body = z.object({ name: z.string().optional(), logoUrl: z.string().optional() }).parse(req.body)
    const workspace = await prisma.workspace.update({ where: { id: req.params.id }, data: body })
    return reply.send(workspace)
  })

  app.get('/:id/users', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const members = await prisma.workspaceUser.findMany({
      where: { workspaceId: req.params.id },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    })
    return reply.send(members)
  })

  app.delete('/:id/users/:userId', async (
    req: FastifyRequest<{ Params: { id: string; userId: string } }>,
    reply: FastifyReply
  ) => {
    await prisma.workspaceUser.delete({
      where: { workspaceId_userId: { workspaceId: req.params.id, userId: req.params.userId } },
    })
    return reply.code(204).send()
  })
}
