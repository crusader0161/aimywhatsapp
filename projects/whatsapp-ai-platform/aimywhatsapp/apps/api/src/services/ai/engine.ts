import Anthropic from '@anthropic-ai/sdk'
import { Contact, WorkspaceSettings } from '@prisma/client'
import { prisma } from '../../db/prisma'
import { searchSimilar } from '../../lib/qdrant'
import { getEmbedding } from './providers/embeddings'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export interface AIEngineInput {
  workspaceId: string
  contact: Contact
  text: string
  mediaType?: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | null
  mediaBuffer?: Buffer | null
  conversationId: string
  settings: WorkspaceSettings
}

export interface AIEngineOutput {
  reply: string
  confidence: number
  kbChunksUsed: string[]
  shouldEscalate: boolean
  escalationReason?: string
  sentiment?: string
}

export class AIEngine {
  static async generate(input: AIEngineInput): Promise<AIEngineOutput> {
    const {
      workspaceId,
      contact,
      text,
      mediaType,
      mediaBuffer,
      conversationId,
      settings,
    } = input

    // 1. Get conversation history
    const history = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: settings.maxConversationHistory,
    })
    history.reverse()

    // 2. Get KB context via RAG
    let kbContext = ''
    const kbChunksUsed: string[] = []

    if (text) {
      const defaultKB = await prisma.knowledgeBase.findFirst({
        where: { workspaceId, isDefault: true },
      })

      if (defaultKB) {
        try {
          const queryEmbedding = await getEmbedding(text)
          const results = await searchSimilar(defaultKB.id, queryEmbedding, 5, 0.7)

          if (results.length > 0) {
            kbContext = results
              .map((r, i) => `[Source ${i + 1}]: ${r.payload.content}`)
              .join('\n\n')
            kbChunksUsed.push(...results.map((r) => r.payload.chunkId))
          }
        } catch (err) {
          console.error('RAG error:', err)
        }
      }
    }

    // 3. Handle media via vision
    let mediaContext = ''
    let imageBase64: string | undefined

    if (mediaType === 'IMAGE' && mediaBuffer) {
      imageBase64 = mediaBuffer.toString('base64')
    } else if (mediaType === 'AUDIO' && mediaBuffer) {
      // Transcribe audio using OpenAI Whisper
      try {
        const { transcribeAudio } = await import('./providers/whisper')
        const transcript = await transcribeAudio(mediaBuffer)
        mediaContext = `[Voice message transcription]: "${transcript}"\n`
      } catch (err) {
        console.error('Audio transcription error:', err)
        mediaContext = '[Voice message - unable to transcribe]\n'
      }
    } else if (mediaType === 'DOCUMENT' && mediaBuffer) {
      mediaContext = '[Document attached - please describe what you need help with]\n'
    }

    // 4. Build system prompt
    const systemPrompt = buildSystemPrompt({
      botName: settings.botName,
      persona: settings.botPersona || '',
      kbContext,
      contactName: contact.displayName || contact.name || contact.phoneNumber,
      language: contact.language || settings.defaultLanguage,
    })

    // 5. Build message array for Claude
    const messages: Anthropic.MessageParam[] = []

    // Add conversation history
    for (const msg of history.slice(-10)) {
      if (msg.direction === 'INBOUND') {
        messages.push({ role: 'user', content: msg.content || '[media message]' })
      } else if (msg.senderType === 'BOT' && msg.content) {
        messages.push({ role: 'assistant', content: msg.content })
      }
    }

    // Add current message
    const currentContent: Anthropic.ContentBlockParam[] = []

    if (imageBase64) {
      currentContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/jpeg',
          data: imageBase64,
        },
      })
    }

    const userText = [mediaContext, text].filter(Boolean).join('\n')
    if (userText) {
      currentContent.push({ type: 'text', text: userText })
    }

    if (currentContent.length === 0) {
      currentContent.push({ type: 'text', text: '[media message]' })
    }

    // Ensure messages alternate correctly
    if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
      // Replace last user message to avoid consecutive user messages
      messages[messages.length - 1] = { role: 'user', content: currentContent }
    } else {
      messages.push({ role: 'user', content: currentContent })
    }

    // 6. Call Claude API
    let reply = ''
    try {
      const response = await anthropic.messages.create({
        model: settings.aiModel || 'claude-sonnet-4-5-20250514',
        max_tokens: 1024,
        temperature: settings.aiTemperature,
        system: systemPrompt,
        messages,
      })

      reply = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('')
        .trim()
    } catch (err: any) {
      console.error('Claude API error:', err)
      reply = "I'm having trouble responding right now. Please try again in a moment."
      return {
        reply,
        confidence: 0,
        kbChunksUsed: [],
        shouldEscalate: true,
        escalationReason: 'AI API error',
      }
    }

    // 7. Confidence scoring (quick heuristic)
    const confidence = estimateConfidence(reply, kbContext, text)

    // 8. Escalation check
    const shouldEscalate =
      confidence < (settings.confidenceThreshold || 0.6) ||
      containsEscalationKeywords(text)

    // 9. Sentiment detection (simple)
    const sentiment = detectSentiment(text)

    return {
      reply,
      confidence,
      kbChunksUsed,
      shouldEscalate,
      sentiment,
    }
  }
}

function buildSystemPrompt(opts: {
  botName: string
  persona: string
  kbContext: string
  contactName: string
  language: string
}): string {
  const parts: string[] = []

  parts.push(
    `You are ${opts.botName}${opts.persona ? `, ${opts.persona}` : ', a helpful AI assistant'}.`
  )
  parts.push(`You are talking with ${opts.contactName}.`)

  if (opts.language && opts.language !== 'auto') {
    parts.push(`Always reply in ${opts.language}.`)
  } else {
    parts.push(`Detect the language of the user's message and always reply in the same language.`)
  }

  if (opts.kbContext) {
    parts.push(`\nUse the following knowledge base to answer questions. Only use information from this context. If the answer is not in the knowledge base, say you don't have that information and offer to connect them with a human agent.\n\n--- KNOWLEDGE BASE ---\n${opts.kbContext}\n--- END KNOWLEDGE BASE ---`)
  }

  parts.push(`\nGuidelines:
- Keep responses concise and conversational (suitable for WhatsApp)
- Be helpful, friendly, and professional
- Never make up information not in the knowledge base
- For complaints, refunds, or sensitive issues, offer to connect with a human agent
- Do not use markdown formatting (no **bold**, no bullet points with -, use plain text)
- Use emojis sparingly and only when appropriate`)

  return parts.join('\n')
}

function estimateConfidence(reply: string, kbContext: string, query: string): number {
  if (!reply || reply.length < 10) return 0.1
  if (reply.toLowerCase().includes("don't have") || reply.toLowerCase().includes("not sure")) return 0.4
  if (reply.toLowerCase().includes('human agent') || reply.toLowerCase().includes('connect you')) return 0.3
  if (kbContext && kbContext.length > 100) return 0.85
  if (!kbContext) return 0.65
  return 0.75
}

function containsEscalationKeywords(text: string): boolean {
  const keywords = ['refund', 'cancel', 'complaint', 'legal', 'lawyer', 'sue', 'fraud', 'scam', 'urgent', 'emergency']
  const lower = text.toLowerCase()
  return keywords.some((k) => lower.includes(k))
}

function detectSentiment(text: string): string {
  const lower = text.toLowerCase()
  const positive = ['thank', 'great', 'awesome', 'love', 'perfect', 'excellent', 'good', 'happy', 'pleased']
  const negative = ['angry', 'frustrated', 'terrible', 'awful', 'hate', 'worst', 'useless', 'bad', 'disappointed', 'upset']

  const posScore = positive.filter((w) => lower.includes(w)).length
  const negScore = negative.filter((w) => lower.includes(w)).length

  if (negScore > posScore) return 'NEGATIVE'
  if (posScore > negScore) return 'POSITIVE'
  return 'NEUTRAL'
}
