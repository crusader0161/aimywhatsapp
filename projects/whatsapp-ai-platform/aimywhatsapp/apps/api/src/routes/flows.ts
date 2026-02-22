import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/prisma'
import { authenticate } from '../lib/auth'

export default async function flowRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)

  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const query = z.object({ workspaceId: z.string() }).parse(req.query)
    const flows = await prisma.flow.findMany({
      where: { workspaceId: query.workspaceId },
      include: { stats: true },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send(flows)
  })

  app.post('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      workspaceId: z.string(),
      name: z.string().min(1),
      description: z.string().optional(),
      triggerType: z.enum(['FIRST_MESSAGE', 'KEYWORD', 'LABEL_ADDED', 'INBOUND_MEDIA', 'SCHEDULED', 'API']),
      triggerConfig: z.any().default({}),
      nodes: z.any().default([]),
      edges: z.any().default([]),
    }).parse(req.body)

    const flow = await prisma.flow.create({ data: body })
    return reply.code(201).send(flow)
  })

  app.get('/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const flow = await prisma.flow.findUnique({
      where: { id: req.params.id },
      include: { stats: true },
    })
    if (!flow) return reply.code(404).send({ error: 'Flow not found' })
    return reply.send(flow)
  })

  app.put('/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const body = z.object({
      name: z.string().optional(),
      nodes: z.any(),
      edges: z.any(),
      triggerType: z.string().optional(),
      triggerConfig: z.any().optional(),
    }).parse(req.body)

    const flow = await prisma.flow.update({ where: { id: req.params.id }, data: body })
    return reply.send(flow)
  })

  app.delete('/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    await prisma.flow.delete({ where: { id: req.params.id } })
    return reply.code(204).send()
  })

  app.post('/:id/activate', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const flow = await prisma.flow.update({ where: { id: req.params.id }, data: { isActive: true } })
    return reply.send(flow)
  })

  app.post('/:id/deactivate', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const flow = await prisma.flow.update({ where: { id: req.params.id }, data: { isActive: false } })
    return reply.send(flow)
  })
}
