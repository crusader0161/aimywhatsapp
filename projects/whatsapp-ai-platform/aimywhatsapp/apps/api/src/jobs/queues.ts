import { Queue, Worker } from 'bullmq'
import { redis } from '../lib/redis'
import { prisma } from '../db/prisma'
import { ensureCollection } from '../lib/qdrant'

const connection = { host: 'localhost', port: 6379 }

// Use REDIS_URL to parse connection
const redisUrl = new URL(process.env.REDIS_URL || 'redis://localhost:6379')
const queueConnection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port) || 6379,
  password: redisUrl.password || undefined,
}

// =====================
// QUEUES
// =====================

export const embedDocumentQueue = new Queue('embed-document', { connection: queueConnection })
export const broadcastQueue = new Queue('send-broadcast', { connection: queueConnection })
export const webhookQueue = new Queue('outbound-webhook', { connection: queueConnection })
export const processMediaQueue = new Queue('process-media', { connection: queueConnection })

// =====================
// WORKERS
// =====================

export async function setupQueues() {
  // Embed document worker
  const embedWorker = new Worker('embed-document', async (job) => {
    if (job.name === 'embed') {
      await processDocument(job.data.documentId)
    } else if (job.name === 'embed-faq') {
      await processFaq(job.data.faqId)
    }
  }, { connection: queueConnection, concurrency: 3 })

  embedWorker.on('failed', (job, err) => {
    console.error(`Embed job ${job?.id} failed:`, err)
    if (job?.data.documentId) {
      prisma.kBDocument.update({
        where: { id: job.data.documentId },
        data: { status: 'FAILED', errorMessage: err.message },
      }).catch(() => {})
    }
  })

  // Broadcast worker
  const broadcastWorker = new Worker('send-broadcast', async (job) => {
    await processBroadcast(job.data.broadcastId)
  }, { connection: queueConnection, concurrency: 1 })

  broadcastWorker.on('failed', (job, err) => {
    console.error(`Broadcast job ${job?.id} failed:`, err)
  })

  // Webhook worker
  const webhookWorker = new Worker('outbound-webhook', async (job) => {
    await deliverWebhook(job.data)
  }, { connection: queueConnection, concurrency: 10 })

  console.log('✅ Job queues initialized')
}

// =====================
// PROCESSORS
// =====================

async function processDocument(documentId: string) {
  const doc = await prisma.kBDocument.findUnique({
    where: { id: documentId },
    include: { knowledgeBase: true },
  })
  if (!doc) return

  await prisma.kBDocument.update({ where: { id: documentId }, data: { status: 'PROCESSING' } })

  try {
    let content = ''

    if (doc.type === 'URL' && doc.sourceUrl) {
      const { load } = await import('cheerio')
      const got = (await import('got')).default
      const html = await got(doc.sourceUrl).text()
      const $ = load(html)
      $('nav, footer, script, style, header').remove()
      content = $('body').text().replace(/\s+/g, ' ').trim()
    } else if (doc.filePath) {
      const { readFileSync } = await import('fs')
      const { getFullPath } = await import('../lib/storage')
      const fullPath = getFullPath(doc.filePath)

      if (doc.type === 'PDF') {
        const pdfParse = (await import('pdf-parse')).default
        const buffer = readFileSync(fullPath)
        const parsed = await pdfParse(buffer)
        content = parsed.text
      } else if (doc.type === 'DOCX') {
        const mammoth = await import('mammoth')
        const result = await mammoth.extractRawText({ path: fullPath })
        content = result.value
      } else {
        content = readFileSync(fullPath, 'utf-8')
      }
    }

    if (!content) throw new Error('Could not extract content from document')

    // Chunk the content
    const chunks = chunkText(content, 500, 50)

    // Get embeddings in batch
    const { getEmbeddingsBatch } = await import('../services/ai/providers/embeddings')
    const { qdrant, collectionName } = await import('../lib/qdrant')

    await ensureCollection(doc.knowledgeBaseId)

    const batchSize = 100
    let chunkCount = 0

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize)
      const embeddings = await getEmbeddingsBatch(batch)

      const points = batch.map((chunk, j) => {
        const chunkId = `${documentId}_${i + j}`
        return {
          id: chunkId.replace(/[^a-z0-9-]/gi, ''),
          vector: embeddings[j],
          payload: {
            chunkId,
            documentId,
            content: chunk,
            chunkIndex: i + j,
          },
        }
      })

      // Use numeric IDs for Qdrant
      const qdrantPoints = points.map((p, idx) => ({
        id: Date.now() + i + idx,
        vector: embeddings[idx],
        payload: p.payload,
      }))

      await qdrant.upsert(collectionName(doc.knowledgeBaseId), { points: qdrantPoints })

      // Save chunk records
      for (let k = 0; k < batch.length; k++) {
        await prisma.kBChunk.create({
          data: {
            documentId,
            content: batch[k],
            qdrantId: String(qdrantPoints[k].id),
            chunkIndex: i + k,
          },
        })
      }

      chunkCount += batch.length
    }

    await prisma.kBDocument.update({
      where: { id: documentId },
      data: { status: 'INDEXED', content: content.slice(0, 5000), chunkCount },
    })

    console.log(`✅ Document ${documentId} indexed: ${chunkCount} chunks`)
  } catch (err: any) {
    await prisma.kBDocument.update({
      where: { id: documentId },
      data: { status: 'FAILED', errorMessage: err.message },
    })
    throw err
  }
}

async function processFaq(faqId: string) {
  const faq = await prisma.kBFaq.findUnique({
    where: { id: faqId },
    include: { knowledgeBase: true },
  })
  if (!faq) return

  const { getEmbedding } = await import('../services/ai/providers/embeddings')
  const { qdrant, collectionName } = await import('../lib/qdrant')

  await ensureCollection(faq.knowledgeBaseId)

  const text = `Q: ${faq.question}\nA: ${faq.answer}`
  const embedding = await getEmbedding(text)
  const pointId = Date.now()

  await qdrant.upsert(collectionName(faq.knowledgeBaseId), {
    points: [{
      id: pointId,
      vector: embedding,
      payload: { chunkId: faqId, documentId: faqId, content: text },
    }],
  })

  await prisma.kBFaq.update({
    where: { id: faqId },
    data: { qdrantId: String(pointId) },
  })
}

async function processBroadcast(broadcastId: string) {
  const broadcast = await prisma.broadcast.findUnique({
    where: { id: broadcastId },
    include: { workspace: { include: { whatsappSessions: true } } },
  })
  if (!broadcast) return

  // Get target contacts
  let contactIds: string[] = []
  if (broadcast.targetType === 'ALL') {
    const contacts = await prisma.contact.findMany({
      where: { workspaceId: broadcast.workspaceId, isBlocked: false },
      select: { id: true },
    })
    contactIds = contacts.map((c) => c.id)
  } else if (broadcast.targetType === 'LABEL' && broadcast.labelIds.length > 0) {
    const contactLabels = await prisma.contactLabel.findMany({
      where: { labelId: { in: broadcast.labelIds } },
      select: { contactId: true },
    })
    contactIds = [...new Set(contactLabels.map((cl) => cl.contactId))]
  } else {
    contactIds = broadcast.contactIds
  }

  // Create recipient records
  await prisma.broadcastRecipient.createMany({
    data: contactIds.map((contactId) => ({ broadcastId, contactId })),
    skipDuplicates: true,
  })

  // Send messages with rate limiting (1/sec)
  const { WASessionManager } = await import('../services/whatsapp/session-manager')
  const manager = WASessionManager.getInstance()
  const session = broadcast.workspace.whatsappSessions[0]
  if (!session) return

  let sentCount = 0
  for (const contactId of contactIds) {
    const contact = await prisma.contact.findUnique({ where: { id: contactId } })
    if (!contact) continue

    try {
      await manager.sendMessage(session.id, contact.jid, broadcast.message)
      await prisma.broadcastRecipient.updateMany({
        where: { broadcastId, contactId },
        data: { status: 'sent', sentAt: new Date() },
      })
      sentCount++
    } catch (err) {
      await prisma.broadcastRecipient.updateMany({
        where: { broadcastId, contactId },
        data: { status: 'failed' },
      })
    }

    // 1 message per second rate limit
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  await prisma.broadcast.update({
    where: { id: broadcastId },
    data: { status: 'SENT', sentAt: new Date(), stats: { sent: sentCount, total: contactIds.length } },
  })
}

async function deliverWebhook(data: { webhookId: string; event: string; payload: unknown }) {
  const webhook = await prisma.webhook.findUnique({ where: { id: data.webhookId } })
  if (!webhook || !webhook.isActive) return

  const body = JSON.stringify({ event: data.event, payload: data.payload, timestamp: Date.now() })

  try {
    const res = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Aimywhatsapp-Event': data.event,
        ...(webhook.secret ? { 'X-Aimywhatsapp-Signature': signWebhook(body, webhook.secret) } : {}),
      },
      body,
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) throw new Error(`Webhook returned ${res.status}`)

    await prisma.webhook.update({
      where: { id: data.webhookId },
      data: { lastCalledAt: new Date(), failureCount: 0 },
    })
  } catch (err) {
    await prisma.webhook.update({
      where: { id: data.webhookId },
      data: { failureCount: { increment: 1 } },
    })
    throw err
  }
}

function signWebhook(body: string, secret: string): string {
  const { createHmac } = require('crypto')
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex')
}

// Simple recursive text chunker
function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length)
    chunks.push(text.slice(start, end))
    start += chunkSize - overlap
  }
  return chunks
}
