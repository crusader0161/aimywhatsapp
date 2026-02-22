import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/prisma'
import { authenticate } from '../lib/auth'
import { broadcastQueue } from '../jobs/queues'

export default async function broadcastRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)

  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const query = z.object({ workspaceId: z.string() }).parse(req.query)
    const broadcasts = await prisma.broadcast.findMany({
      where: { workspaceId: query.workspaceId },
      include: { _count: { select: { recipients: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send(broadcasts)
  })

  app.post('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      workspaceId: z.string(),
      name: z.string().min(1),
      message: z.string().min(1),
      targetType: z.enum(['ALL', 'LABEL', 'CONTACTS']),
      labelIds: z.array(z.string()).default([]),
      contactIds: z.array(z.string()).default([]),
      scheduledAt: z.string().datetime().optional(),
    }).parse(req.body)

    const broadcast = await prisma.broadcast.create({ data: body })
    return reply.code(201).send(broadcast)
  })

  app.get('/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const broadcast = await prisma.broadcast.findUnique({
      where: { id: req.params.id },
      include: { recipients: true },
    })
    if (!broadcast) return reply.code(404).send({ error: 'Broadcast not found' })
    return reply.send(broadcast)
  })

  app.post('/:id/send', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const broadcast = await prisma.broadcast.findUnique({ where: { id: req.params.id } })
    if (!broadcast) return reply.code(404).send({ error: 'Broadcast not found' })
    if (broadcast.status !== 'DRAFT') return reply.code(400).send({ error: 'Broadcast already sent or scheduled' })

    await prisma.broadcast.update({
      where: { id: req.params.id },
      data: { status: 'SENDING' },
    })

    await broadcastQueue.add('send', { broadcastId: req.params.id })

    return reply.send({ message: 'Broadcast queued for sending' })
  })

  app.delete('/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const broadcast = await prisma.broadcast.findUnique({ where: { id: req.params.id } })
    if (!broadcast) return reply.code(404).send({ error: 'Broadcast not found' })
    if (!['DRAFT', 'FAILED'].includes(broadcast.status)) {
      return reply.code(400).send({ error: 'Cannot delete a broadcast that has been sent' })
    }
    await prisma.broadcast.delete({ where: { id: req.params.id } })
    return reply.code(204).send()
  })
}
