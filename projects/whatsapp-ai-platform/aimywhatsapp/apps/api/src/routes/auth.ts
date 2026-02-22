import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/prisma'
import { hashPassword, verifyPassword, generateRefreshToken } from '../lib/auth'
import { nanoid } from 'nanoid'

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  workspaceName: z.string().min(2).max(100),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

const refreshSchema = z.object({
  refreshToken: z.string(),
})

function generateTokens(app: FastifyInstance, userId: string) {
  const accessToken = app.jwt.sign(
    { id: userId },
    { expiresIn: '15m' }
  )
  const refreshToken = generateRefreshToken()
  return { accessToken, refreshToken }
}

export default async function authRoutes(app: FastifyInstance) {
  // POST /auth/register
  app.post('/register', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = registerSchema.parse(req.body)

    const existing = await prisma.user.findUnique({ where: { email: body.email } })
    if (existing) {
      return reply.code(409).send({ error: 'Email already registered' })
    }

    const passwordHash = await hashPassword(body.password)
    const slug = body.workspaceName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + nanoid(6)

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: { name: body.name, email: body.email, passwordHash },
      })

      const workspace = await tx.workspace.create({
        data: {
          name: body.workspaceName,
          slug,
          users: {
            create: { userId: newUser.id, role: 'OWNER' },
          },
          settings: {
            create: {
              botName: 'Aimy',
            },
          },
        },
      })

      return { user: newUser, workspace }
    })

    const { accessToken, refreshToken } = generateTokens(app, user.user.id)
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    await prisma.userSession.create({
      data: {
        userId: user.user.id,
        refreshToken,
        expiresAt,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    })

    return reply.code(201).send({
      accessToken,
      refreshToken,
      user: { id: user.user.id, name: user.user.name, email: user.user.email },
      workspace: { id: user.workspace.id, name: user.workspace.name, slug: user.workspace.slug },
    })
  })

  // POST /auth/login
  app.post('/login', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = loginSchema.parse(req.body)

    const user = await prisma.user.findUnique({ where: { email: body.email } })
    if (!user || !(await verifyPassword(user.passwordHash, body.password))) {
      return reply.code(401).send({ error: 'Invalid email or password' })
    }

    const { accessToken, refreshToken } = generateTokens(app, user.id)
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    await prisma.userSession.create({
      data: {
        userId: user.id,
        refreshToken,
        expiresAt,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    })

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    const workspaces = await prisma.workspaceUser.findMany({
      where: { userId: user.id },
      include: { workspace: { select: { id: true, name: true, slug: true, logoUrl: true } } },
    })

    return reply.send({
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl },
      workspaces: workspaces.map((w) => ({ ...w.workspace, role: w.role })),
    })
  })

  // POST /auth/refresh
  app.post('/refresh', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = refreshSchema.parse(req.body)

    const session = await prisma.userSession.findUnique({
      where: { refreshToken: body.refreshToken },
      include: { user: true },
    })

    if (!session || session.expiresAt < new Date()) {
      await prisma.userSession.deleteMany({ where: { refreshToken: body.refreshToken } })
      return reply.code(401).send({ error: 'Invalid or expired refresh token' })
    }

    // Rotate refresh token
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(app, session.userId)
    const newExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    await prisma.userSession.update({
      where: { id: session.id },
      data: { refreshToken: newRefreshToken, expiresAt: newExpiresAt },
    })

    return reply.send({ accessToken, refreshToken: newRefreshToken })
  })

  // POST /auth/logout
  app.post('/logout', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = refreshSchema.safeParse(req.body)
    if (body.success) {
      await prisma.userSession.deleteMany({ where: { refreshToken: body.data.refreshToken } })
    }
    return reply.code(204).send()
  })

  // GET /auth/me
  app.get('/me', {
    preHandler: async (req, reply) => {
      try { await req.jwtVerify() } catch { reply.code(401).send({ error: 'Unauthorized' }) }
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const user = req.user as { id: string }
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, name: true, email: true, avatarUrl: true, createdAt: true },
    })
    if (!dbUser) return reply.code(404).send({ error: 'User not found' })
    return reply.send(dbUser)
  })
}
