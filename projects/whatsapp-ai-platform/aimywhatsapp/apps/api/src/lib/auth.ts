import { FastifyRequest, FastifyReply } from 'fastify'
import * as argon2 from 'argon2'
import { nanoid } from 'nanoid'
import { prisma } from '../db/prisma'

export const hashPassword = (password: string) =>
  argon2.hash(password, { type: argon2.argon2id })

export const verifyPassword = (hash: string, password: string) =>
  argon2.verify(hash, password)

export const generateRefreshToken = () => nanoid(64)

export const generateApiKey = () => `aimy_${nanoid(48)}`

// Middleware: verify JWT and attach user to request
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    await request.jwtVerify()
  } catch {
    reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or expired token' })
  }
}

// Middleware: verify workspace membership
export async function requireWorkspaceMember(
  request: FastifyRequest & { params: { workspaceId?: string } },
  reply: FastifyReply
) {
  const user = (request.user as { id: string })
  const workspaceId = request.params.workspaceId

  if (!workspaceId) return

  const membership = await prisma.workspaceUser.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
  })

  if (!membership) {
    reply.code(403).send({ error: 'Forbidden', message: 'Not a member of this workspace' })
    return
  }

  // Attach role to request
  ;(request as any).workspaceRole = membership.role
}

// Check minimum role level
const ROLE_LEVELS = { VIEWER: 0, AGENT: 1, ADMIN: 2, OWNER: 3 }

export function requireRole(minRole: 'VIEWER' | 'AGENT' | 'ADMIN' | 'OWNER') {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const role = (request as any).workspaceRole
    if (!role || ROLE_LEVELS[role as keyof typeof ROLE_LEVELS] < ROLE_LEVELS[minRole]) {
      reply.code(403).send({ error: 'Forbidden', message: `Requires ${minRole} role or higher` })
    }
  }
}
