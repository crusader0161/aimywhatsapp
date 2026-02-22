import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } },
    log: process.env.NODE_ENV === 'development'
      ? ['query', 'error', 'warn']
      : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// Keep connection alive — ping every 60s to prevent idle timeout disconnects
setInterval(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`
  } catch (_err) {
    // silently ignore — Prisma will reconnect on next query
  }
}, 60_000)
