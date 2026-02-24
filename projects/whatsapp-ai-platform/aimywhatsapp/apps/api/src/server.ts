import 'dotenv/config'
import Fastify, { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'
import { Server } from 'socket.io'

import { existsSync } from 'fs'
import { prisma } from './db/prisma'
import { redis } from './lib/redis'
import { setupSocketServer } from './realtime/socket'
import { setupQueues } from './jobs/queues'

// Routes
import authRoutes from './routes/auth'
import workspaceRoutes from './routes/workspaces'
import whatsappRoutes from './routes/whatsapp'
import contactRoutes from './routes/contacts'
import conversationRoutes from './routes/conversations'
import knowledgeRoutes from './routes/knowledge'
import flowRoutes from './routes/flows'
import broadcastRoutes from './routes/broadcasts'
import analyticsRoutes from './routes/analytics'
import settingsRoutes from './routes/settings'

// Extend FastifyInstance with socket.io
declare module 'fastify' {
  interface FastifyInstance {
    io: Server
  }
}

const PORT = Number(process.env.API_PORT) || 3001
const HOST = '0.0.0.0'

async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  })

  // Security
  await app.register(helmet, { contentSecurityPolicy: false })

  // CORS — allow origins from env or defaults
  const corsOrigins = [
    'http://localhost:3000',
    'http://50.28.12.106:3000',
    'http://aiwat.zedcode.ai',
    'https://aiwat.zedcode.ai',
    ...(process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
      : []
    ),
  ]
  await app.register(cors, {
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })

  // Rate limiting (skip health check)
  await app.register(rateLimit, {
    max: Number(process.env.RATE_LIMIT_MAX) || 200,
    timeWindow: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
    redis,
    allowList: ['127.0.0.1', '::1'],
    skipOnError: true, // Don't fail requests if Redis is down
  })

  // JWT
  await app.register(jwt, {
    secret: process.env.JWT_ACCESS_SECRET!,
  })

  // File uploads
  await app.register(multipart, {
    limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  })

  // Health check
  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
  }))

  // API routes
  const API_PREFIX = '/api/v1'
  await app.register(authRoutes,         { prefix: `${API_PREFIX}/auth` })
  await app.register(workspaceRoutes,    { prefix: `${API_PREFIX}/workspaces` })
  await app.register(whatsappRoutes,     { prefix: `${API_PREFIX}/whatsapp` })
  await app.register(contactRoutes,      { prefix: `${API_PREFIX}/contacts` })
  await app.register(conversationRoutes, { prefix: `${API_PREFIX}/conversations` })
  await app.register(knowledgeRoutes,    { prefix: `${API_PREFIX}/knowledge` })
  await app.register(knowledgeRoutes,    { prefix: `${API_PREFIX}/knowledge-bases` })
  await app.register(flowRoutes,         { prefix: `${API_PREFIX}/flows` })
  await app.register(broadcastRoutes,    { prefix: `${API_PREFIX}/broadcasts` })
  await app.register(analyticsRoutes,    { prefix: `${API_PREFIX}/analytics` })
  await app.register(settingsRoutes,     { prefix: `${API_PREFIX}/settings` })

  return app
}


async function autoRestoreSessions() {
  const { WASessionManager } = await import('./services/whatsapp/session-manager')
  const manager = WASessionManager.getInstance()

  const sessions = await prisma.whatsappSession.findMany()
  let count = 0

  for (const session of sessions) {
    const credsFile = session.credsPath + '/creds.json'
    if (!existsSync(credsFile)) continue

    manager.startSession(session.id, session.workspaceId, session.accountId, session.credsPath)
      .then(() => console.log('[AutoRestore] Connected: ' + session.accountId))
      .catch((err) => console.log('[AutoRestore] ' + session.accountId + ': ' + (err && err.message ? err.message : err)))
    count++
  }

  if (count > 0) console.log('[AutoRestore] Restoring ' + count + ' session(s)...')
}

async function start() {
  const fastify = await buildApp()

  // Attach Socket.io directly to Fastify's HTTP server (correct pattern)
  const io = new Server(fastify.server, {
    cors: {
      origin: process.env.APP_URL || 'http://localhost:3000',
      credentials: true,
    },
    path: '/ws',
  })

  setupSocketServer(io)
  fastify.decorate('io', io)

  // Setup background job queues
  await setupQueues()

  // Auto-reconnect WhatsApp sessions that had active credentials
  autoRestoreSessions().catch((e) => console.error('[AutoRestore] Error:', e))

  // Start listening
  try {
    await fastify.listen({ port: PORT, host: HOST })
    console.log(`
╔══════════════════════════════════════╗
║     Aimywhatsapp API Server          ║
║     Running on port ${PORT}             ║
╚══════════════════════════════════════╝
    `)
  } catch (err) {
    fastify.log.error(err)
    await prisma.$disconnect()
    await redis.quit()
    process.exit(1)
  }
}

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`)
  await prisma.$disconnect()
  await redis.quit()
  process.exit(0)
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT',  () => gracefulShutdown('SIGINT'))

start()
