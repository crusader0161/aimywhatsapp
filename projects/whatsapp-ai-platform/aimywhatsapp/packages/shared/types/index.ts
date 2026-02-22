// Shared types between API and Web

export type UserRole = 'OWNER' | 'ADMIN' | 'AGENT' | 'VIEWER'
export type Plan = 'FREE' | 'PRO' | 'ENTERPRISE'
export type SessionStatus = 'DISCONNECTED' | 'CONNECTING' | 'QR_READY' | 'CONNECTED' | 'BANNED' | 'ERROR'
export type ConversationStatus = 'OPEN' | 'RESOLVED' | 'WAITING_HUMAN' | 'PENDING_APPROVAL'
export type Direction = 'INBOUND' | 'OUTBOUND'
export type SenderType = 'CONTACT' | 'BOT' | 'HUMAN'
export type MediaType = 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'STICKER' | 'LOCATION' | 'CONTACT_CARD'
export type Sentiment = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE'
export type IndexStatus = 'PENDING' | 'PROCESSING' | 'INDEXED' | 'FAILED'
export type KBDocType = 'PDF' | 'DOCX' | 'TXT' | 'CSV' | 'URL' | 'MANUAL'
export type FlowTrigger = 'FIRST_MESSAGE' | 'KEYWORD' | 'LABEL_ADDED' | 'INBOUND_MEDIA' | 'SCHEDULED' | 'API'
export type BroadcastTarget = 'ALL' | 'LABEL' | 'CONTACTS'
export type BroadcastStatus = 'DRAFT' | 'SCHEDULED' | 'SENDING' | 'SENT' | 'FAILED'

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    total: number
    page: number
    limit: number
    pages: number
  }
}

export interface ApiError {
  error: string
  message?: string
  statusCode?: number
}

// Socket events
export interface SocketEvents {
  'message:new': { message: Message; conversation: Partial<Conversation> }
  'message:updated': { message: Message }
  'contact:updated': { contact: Contact }
  'conversation:updated': { conversation: Conversation }
  'whatsapp:status': { sessionId: string; status: string; qrCode?: string; phoneNumber?: string; displayName?: string }
  'typing:start': { conversationId: string }
  'typing:stop': { conversationId: string }
  'notification:new': { type: string; payload: unknown }
  'broadcast:progress': { broadcastId: string; sent: number; total: number }
}

// Core entity types (simplified, full types from Prisma)
export interface Message {
  id: string
  workspaceId: string
  conversationId: string
  waMessageId?: string
  direction: Direction
  senderType: SenderType
  senderUserId?: string
  content: string
  mediaType?: MediaType
  mediaUrl?: string
  mediaCaption?: string
  mediaTranscript?: string
  replyToId?: string
  sentiment?: Sentiment
  confidence?: number
  kbChunksUsed: string[]
  flowId?: string
  isApproved?: boolean
  isRead: boolean
  deliveredAt?: Date
  readAt?: Date
  createdAt: Date
}

export interface Contact {
  id: string
  workspaceId: string
  sessionId: string
  jid: string
  phoneNumber: string
  name?: string
  displayName?: string
  profilePicUrl?: string
  autoreplyEnabled: boolean
  humanTakeover: boolean
  approvalMode: boolean
  isBlocked: boolean
  isVip: boolean
  language?: string
  notes?: string
  firstSeenAt: Date
  lastMessageAt?: Date
}

export interface Conversation {
  id: string
  workspaceId: string
  sessionId: string
  contactId: string
  status: ConversationStatus
  assignedUserId?: string
  resolvedAt?: Date
  lastMessageAt?: Date
  unreadCount: number
  sentiment?: Sentiment
  createdAt: Date
  updatedAt: Date
  contact?: Contact
  messages?: Message[]
}
