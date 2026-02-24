import OpenAI from 'openai'
import { Contact, WorkspaceSettings } from '@prisma/client'
import { prisma } from '../../db/prisma'
import { searchSimilar } from '../../lib/qdrant'
import { getEmbedding } from './providers/embeddings'

/**
 * AI Engine — powered by OpenRouter (claude-sonnet-4-5 via OpenAI-compatible API)
 * Embeddings — Jina AI (jina-embeddings-v3, 1024 dims)
 */
const openrouter = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY!,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
    'X-Title': 'Aimywhatsapp',
  },
})

// Default model — OpenRouter model ID format
const DEFAULT_MODEL = 'anthropic/claude-sonnet-4-5'

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
    const { workspaceId, contact, text, mediaType, mediaBuffer, conversationId, settings } = input

    // 1. Conversation history
    const history = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: settings.maxConversationHistory,
    })
    history.reverse()

    // 2. RAG — knowledge base context
    let kbContext = ''
    const kbChunksUsed: string[] = []

    if (text) {
      const defaultKB = await prisma.knowledgeBase.findFirst({
        where: { workspaceId, isDefault: true },
      })

      if (defaultKB) {
        try {
          const queryEmbedding = await getEmbedding(text)
          const results = await searchSimilar(defaultKB.id, queryEmbedding, 5, 0.5)
          if (results.length > 0) {
            kbContext = results.map((r, i) => `[Source ${i + 1}]: ${r.payload.content}`).join('\n\n')
            kbChunksUsed.push(...results.map((r) => r.payload.chunkId))
          }
        } catch (err) {
          console.error('RAG error:', err)
        }
      }
    }

    // 3. Handle media
    let mediaContext = ''
    let imageBase64: string | undefined
    let imageMimeType: string = 'image/jpeg'

    if (mediaType === 'IMAGE' && mediaBuffer) {
      imageBase64 = mediaBuffer.toString('base64')
    } else if (mediaType === 'AUDIO' && mediaBuffer) {
      try {
        const { transcribeAudio } = await import('./providers/whisper')
        const transcript = await transcribeAudio(mediaBuffer)
        mediaContext = `[Voice message]: "${transcript}"\n`
      } catch {
        mediaContext = '[Voice message received]\n'
      }
    } else if (mediaType === 'DOCUMENT') {
      mediaContext = '[Document attached — please describe what you need help with]\n'
    }

    // 4. System prompt
    const systemPrompt = buildSystemPrompt({
      botName: settings.botName,
      persona: settings.botPersona || '',
      kbContext,
      contactName: contact.displayName || contact.name || contact.phoneNumber,
      language: contact.language || settings.defaultLanguage,
    })

    // 5. Build OpenAI-format messages (OpenRouter compatible)
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
    ]

    // History (last 10 messages)
    for (const msg of history.slice(-10)) {
      if (msg.direction === 'INBOUND') {
        messages.push({ role: 'user', content: msg.content || '[media message]' })
      } else if (msg.senderType === 'BOT' && msg.content) {
        messages.push({ role: 'assistant', content: msg.content })
      }
    }

    // Current message — support image via vision
    const userText = [mediaContext, text].filter(Boolean).join('\n') || '[media message]'

    if (imageBase64) {
      messages.push({
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:${imageMimeType};base64,${imageBase64}` },
          },
          { type: 'text', text: userText },
        ],
      })
    } else {
      messages.push({ role: 'user', content: userText })
    }

    // 6. Call OpenRouter
    let reply = ''
    try {
      // Map old Anthropic model ID to OpenRouter format
      const modelId = mapModelId(settings.aiModel || DEFAULT_MODEL)

      const completion = await openrouter.chat.completions.create({
        model: modelId,
        max_tokens: 1024,
        temperature: settings.aiTemperature ?? 0.7,
        messages,
      })

      reply = completion.choices[0]?.message?.content?.trim() || ''
    } catch (err: any) {
      console.error('OpenRouter AI error:', err?.message || err)
      return {
        reply: "I'm having trouble responding right now. Please try again in a moment.",
        confidence: 0,
        kbChunksUsed: [],
        shouldEscalate: true,
        escalationReason: 'AI API error',
      }
    }

    // 7. Scoring + escalation
    // NOTE: Only use user's text for escalation keywords — never scan the bot's own reply.
    // The AI is allowed to naturally mention "human agent" without triggering escalation.
    const confidence = estimateConfidence(reply, kbContext, text)
    const userRequestsEscalation = containsEscalationKeywords(text)
    const shouldEscalate = confidence < (settings.confidenceThreshold || 0.6) || userRequestsEscalation
    const sentiment = detectSentiment(text)

    return { reply, confidence, kbChunksUsed, shouldEscalate, sentiment }
  }
}

/** Map Anthropic model IDs to OpenRouter equivalents */
function mapModelId(model: string): string {
  const map: Record<string, string> = {
    'claude-sonnet-4-5-20250514': 'anthropic/claude-sonnet-4-5',
    'claude-sonnet-4-5': 'anthropic/claude-sonnet-4-5',
    'claude-opus-4-5': 'anthropic/claude-opus-4-5',
    'claude-haiku-4-5': 'anthropic/claude-haiku-4-5',
    'claude-3.5-sonnet': 'anthropic/claude-3.5-sonnet',
    'claude-3.5-haiku': 'anthropic/claude-3.5-haiku',
  }
  // If already an OpenRouter ID (contains /), return as-is
  if (model.includes('/')) return model
  return map[model] || DEFAULT_MODEL
}

function buildSystemPrompt(opts: {
  botName: string
  persona: string
  kbContext: string
  contactName: string
  language: string
}): string {
  const parts: string[] = []

  // Identity — use persona if set, otherwise a sensible default
  if (opts.persona && opts.persona.trim()) {
    parts.push(`Your name is ${opts.botName}. ${opts.persona.trim()}`)
  } else {
    parts.push(
      `Your name is ${opts.botName}. You are a helpful, friendly assistant. ` +
      `You respond naturally and conversationally, like a knowledgeable human team member would.`
    )
  }

  parts.push(`You are chatting on WhatsApp with ${opts.contactName}.`)

  // Language
  if (opts.language && opts.language !== 'auto') {
    parts.push(`Always reply in ${opts.language}.`)
  } else {
    parts.push(`Detect the language of the incoming message and always reply in that same language.`)
  }

  // Knowledge base context (RAG)
  if (opts.kbContext) {
    parts.push(
      `\nUse the following knowledge base to answer questions accurately. ` +
      `Cite only information present in the context. If the question is not covered, say you don't have that detail right now and ask if you can help with something else.\n\n` +
      `--- KNOWLEDGE BASE ---\n${opts.kbContext}\n--- END KNOWLEDGE BASE ---`
    )
  } else {
    parts.push(
      `\nYou don't have a specific knowledge base loaded yet. Answer based on your general knowledge where helpful. ` +
      `Be honest if you don't know something specific about the business.`
    )
  }

  // Tone & format guidelines
  parts.push(`\nStyle rules:
- Write like a friendly, competent human — not a stiff chatbot
- Keep messages short and to the point (WhatsApp style)
- Use plain text only — no markdown, no ** bold **, no bullet dashes
- Emojis are okay occasionally but don't overdo it
- Never start a message with "Certainly!", "Great question!", or similar filler phrases
- Only suggest connecting to a human agent if the user explicitly asks for one, or if it's clearly a complex complaint or legal issue`)

  return parts.join('\n')
}

function estimateConfidence(reply: string, kbContext: string, query: string): number {
  // Don't penalise the bot for naturally mentioning "human agent" — that caused false escalations.
  // Only use structural signals: reply length and whether KB context was available.
  if (!reply || reply.length < 10) return 0.1
  if (kbContext && kbContext.length > 100) return 0.88  // KB hit → high confidence
  if (reply.length > 80) return 0.75                    // Substantive reply without KB → decent confidence
  return 0.65                                            // Short reply, no KB → borderline
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
