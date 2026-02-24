import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db/prisma'
import { verifyWebhookSignature } from '../services/payment/cashfree'
import { WASessionManager } from '../services/whatsapp/session-manager'

export default async function paymentRoutes(app: FastifyInstance) {
  // Cashfree payment webhook
  app.post('/webhook/cashfree', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const signature = req.headers['x-webhook-signature'] as string
      const timestamp = req.headers['x-webhook-timestamp'] as string

      if (process.env.CASHFREE_ENV === 'production' && signature && timestamp) {
        const rawBody = JSON.stringify(req.body)
        if (!verifyWebhookSignature(rawBody, signature, timestamp)) {
          return reply.code(401).send({ error: 'Invalid signature' })
        }
      }

      const payload = req.body as any
      const eventType = payload?.type

      if (eventType === 'PAYMENT_LINK_EVENT') {
        const linkId = payload?.data?.link?.link_id
        const linkStatus = payload?.data?.link?.link_status

        if (linkStatus === 'PAID' && linkId) {
          const paymentLink = await prisma.paymentLink.findUnique({
            where: { cashfreeLinkId: linkId },
            include: { contact: true },
          })

          if (paymentLink && paymentLink.status !== 'PAID') {
            await prisma.paymentLink.update({
              where: { id: paymentLink.id },
              data: {
                status: 'PAID',
                paidAt: new Date(),
                paidAmount: payload?.data?.payment?.payment_amount,
                paymentMethod: payload?.data?.payment?.payment_method,
              },
            })

            // Auto-confirm via WhatsApp
            const session = await prisma.whatsappSession.findFirst({
              where: { workspaceId: paymentLink.workspaceId, status: 'CONNECTED' },
            })

            if (session) {
              const manager = WASessionManager.getInstance()
              const amount = paymentLink.paidAmount || paymentLink.amount
              const confirmMsg = `Payment of ₹${amount} received! ✅ Thank you so much. We'll start processing your order right away and keep you updated here. 🙏`
              try {
                await manager.sendMessage(session.id, paymentLink.contact.jid, confirmMsg)
              } catch (err) {
                console.error('[Payments] Failed to send confirmation:', err)
              }
            }
          }
        }
      }

      return reply.code(200).send({ received: true })
    } catch (err) {
      console.error('[Payments] Webhook error:', err)
      return reply.code(200).send({ received: true }) // Always 200 to Cashfree
    }
  })

  // Get payment links for a contact (dashboard use)
  app.get('/links', async (req: FastifyRequest<{ Querystring: { contactId?: string; workspaceId?: string } }>, reply: FastifyReply) => {
    const { contactId, workspaceId } = req.query
    const links = await prisma.paymentLink.findMany({
      where: { ...(contactId ? { contactId } : {}), ...(workspaceId ? { workspaceId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })
    return reply.send(links)
  })
}
