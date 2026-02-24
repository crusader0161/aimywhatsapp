import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/prisma'
import { authenticate } from '../lib/auth'
import { saveUploadedFile } from '../lib/storage'
import { embedDocumentQueue } from '../jobs/queues'

export default async function knowledgeRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)

  // GET /knowledge-bases
  app.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const query = z.object({ workspaceId: z.string() }).parse(req.query)
    const kbs = await prisma.knowledgeBase.findMany({
      where: { workspaceId: query.workspaceId },
      include: {
        _count: { select: { documents: true, faqs: true } },
      },
      orderBy: { createdAt: 'asc' },
    })
    return reply.send(kbs)
  })

  // POST /knowledge-bases
  app.post('/', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = z.object({
      workspaceId: z.string(),
      name: z.string().min(1),
      description: z.string().optional(),
      isDefault: z.boolean().optional(),
    }).parse(req.body)

    if (body.isDefault) {
      await prisma.knowledgeBase.updateMany({
        where: { workspaceId: body.workspaceId },
        data: { isDefault: false },
      })
    }

    const kb = await prisma.knowledgeBase.create({ data: body })
    return reply.code(201).send(kb)
  })

  // GET /knowledge-bases/:id
  app.get('/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const kb = await prisma.knowledgeBase.findUnique({
      where: { id: req.params.id },
      include: {
        documents: { orderBy: { createdAt: 'desc' } },
        faqs: { orderBy: { createdAt: 'desc' } },
      },
    })
    if (!kb) return reply.code(404).send({ error: 'Knowledge base not found' })
    return reply.send(kb)
  })

  // PATCH /knowledge-bases/:id
  app.patch('/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const body = z.object({
      name: z.string().optional(),
      description: z.string().optional(),
      isDefault: z.boolean().optional(),
    }).parse(req.body)

    const kb = await prisma.knowledgeBase.update({
      where: { id: req.params.id },
      data: body,
    })
    return reply.send(kb)
  })

  // DELETE /knowledge-bases/:id
  app.delete('/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    await prisma.knowledgeBase.delete({ where: { id: req.params.id } })
    return reply.code(204).send()
  })

  // POST /knowledge-bases/:id/documents - upload file
  app.post('/:id/documents', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const kb = await prisma.knowledgeBase.findUnique({ where: { id: req.params.id } })
    if (!kb) return reply.code(404).send({ error: 'Knowledge base not found' })

    // Check if it's a URL or file upload
    const contentType = req.headers['content-type'] || ''

    if (contentType.includes('multipart')) {
      const file = await req.file()
      if (!file) return reply.code(400).send({ error: 'No file provided' })

      const stored = await saveUploadedFile(file, 'documents')
      const ext = stored.filename.split('.').pop()?.toUpperCase() || 'TXT'
      const docType = ['PDF', 'DOCX', 'TXT', 'CSV'].includes(ext) ? ext : 'TXT'

      const doc = await prisma.kBDocument.create({
        data: {
          knowledgeBaseId: req.params.id,
          name: file.filename,
          type: docType as any,
          filePath: stored.path,
          status: 'PENDING',
        },
      })

      // Queue for processing
      await embedDocumentQueue.add('embed', { documentId: doc.id })

      return reply.code(201).send(doc)
    } else {
      // JSON body with URL
      const body = z.object({ url: z.string().url(), name: z.string().optional() }).parse(req.body)

      const doc = await prisma.kBDocument.create({
        data: {
          knowledgeBaseId: req.params.id,
          name: body.name || body.url,
          type: 'URL',
          sourceUrl: body.url,
          status: 'PENDING',
        },
      })

      await embedDocumentQueue.add('embed', { documentId: doc.id })
      return reply.code(201).send(doc)
    }
  })

  // DELETE /knowledge-bases/:id/documents/:docId
  app.delete('/:id/documents/:docId', async (
    req: FastifyRequest<{ Params: { id: string; docId: string } }>,
    reply: FastifyReply
  ) => {
    await prisma.kBDocument.delete({ where: { id: req.params.docId } })
    return reply.code(204).send()
  })

  // POST /knowledge-bases/:id/documents/:docId/reindex
  app.post('/:id/documents/:docId/reindex', async (
    req: FastifyRequest<{ Params: { id: string; docId: string } }>,
    reply: FastifyReply
  ) => {
    await prisma.kBDocument.update({
      where: { id: req.params.docId },
      data: { status: 'PENDING', errorMessage: null },
    })
    await embedDocumentQueue.add('embed', { documentId: req.params.docId })
    return reply.send({ message: 'Reindexing queued' })
  })

  // GET /knowledge-bases/:id/faqs
  app.get('/:id/faqs', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const faqs = await prisma.kBFaq.findMany({
      where: { knowledgeBaseId: req.params.id },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send(faqs)
  })

  // POST /knowledge-bases/:id/faqs
  app.post('/:id/faqs', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const body = z.object({ question: z.string().min(1), answer: z.string().min(1) }).parse(req.body)
    const faq = await prisma.kBFaq.create({
      data: { knowledgeBaseId: req.params.id, ...body },
    })
    await embedDocumentQueue.add('embed-faq', { faqId: faq.id })
    return reply.code(201).send(faq)
  })

  // PATCH /knowledge-bases/:id/faqs/:faqId
  app.patch('/:id/faqs/:faqId', async (
    req: FastifyRequest<{ Params: { id: string; faqId: string } }>,
    reply: FastifyReply
  ) => {
    const body = z.object({ question: z.string().optional(), answer: z.string().optional() }).parse(req.body)
    const faq = await prisma.kBFaq.update({ where: { id: req.params.faqId }, data: body })
    return reply.send(faq)
  })

  // DELETE /knowledge-bases/:id/faqs/:faqId
  app.delete('/:id/faqs/:faqId', async (
    req: FastifyRequest<{ Params: { id: string; faqId: string } }>,
    reply: FastifyReply
  ) => {
    await prisma.kBFaq.delete({ where: { id: req.params.faqId } })
    return reply.code(204).send()
  })

  // POST /knowledge-bases/:id/test
  app.post('/:id/test', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const body = z.object({ query: z.string().min(1) }).parse(req.body)
    const { getEmbedding } = await import('../services/ai/providers/embeddings')
    const { searchSimilar } = await import('../lib/qdrant')

    try {
      // 1. Vector search
      const embedding = await getEmbedding(body.query)
      const results = await searchSimilar(req.params.id, embedding, 5, 0.6)

      const searchResults = results.map((r) => ({
        score: r.score,
        content: r.payload.content,
        chunkId: r.payload.chunkId,
        documentId: r.payload.documentId,
      }))

      // 2. Build KB context from search results
      let aiAnswer: string | null = null
      if (results.length > 0) {
        const kbContext = results.map((r, i) => `[Source ${i + 1}]: ${r.payload.content}`).join('\n\n')

        // 3. Call AI via OpenRouter
        try {
          const OpenAI = (await import('openai')).default
          const openrouter = new OpenAI({
            apiKey: process.env.OPENROUTER_API_KEY!,
            baseURL: 'https://openrouter.ai/api/v1',
            defaultHeaders: {
              'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
              'X-Title': 'Aimywhatsapp KB Test',
            },
          })

          const model = process.env.DEFAULT_AI_MODEL || 'anthropic/claude-sonnet-4-5'

          const completion = await openrouter.chat.completions.create({
            model,
            max_tokens: 512,
            temperature: 0.4,
            messages: [
              {
                role: 'system',
                content:
                  'You are a helpful assistant. Use ONLY the provided knowledge base context to answer the user\'s question. ' +
                  'If the context does not contain enough information to answer, say so clearly. ' +
                  'Be concise and accurate. Do not make up information.',
              },
              {
                role: 'user',
                content: `Knowledge base context:\n\n${kbContext}\n\nQuestion: ${body.query}`,
              },
            ],
          })

          aiAnswer = completion.choices[0]?.message?.content?.trim() || null
        } catch (aiErr: any) {
          console.error('KB test AI error:', aiErr?.message || aiErr)
          aiAnswer = null
        }
      }

      return reply.send({
        query: body.query,
        aiAnswer,
        results: searchResults,
      })
    } catch (err: any) {
      return reply.code(500).send({ error: err.message })
    }
  })
}
