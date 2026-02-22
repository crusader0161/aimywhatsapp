# WhatsApp AI Bot Platform — Technical Specification

**Version:** 1.0  
**Author:** Zed (AI Architect) + Shashank Rathore  
**Date:** 2026-02-22  
**Status:** Draft → Approved → In Development

---

## Table of Contents

1. [Overview](#1-overview)
2. [Goals & Non-Goals](#2-goals--non-goals)
3. [System Architecture](#3-system-architecture)
4. [Tech Stack](#4-tech-stack)
5. [Database Schema](#5-database-schema)
6. [API Specification](#6-api-specification)
7. [Frontend Pages & Components](#7-frontend-pages--components)
8. [AI Engine Specification](#8-ai-engine-specification)
9. [WhatsApp Integration Layer](#9-whatsapp-integration-layer)
10. [Knowledge Base & RAG Pipeline](#10-knowledge-base--rag-pipeline)
11. [Flow Builder](#11-flow-builder)
12. [Real-Time System](#12-real-time-system)
13. [Job Queue & Background Tasks](#13-job-queue--background-tasks)
14. [Security & Auth](#14-security--auth)
15. [Deployment](#15-deployment)
16. [File Structure](#16-file-structure)
17. [Build Phases & Milestones](#17-build-phases--milestones)
18. [Environment Variables](#18-environment-variables)

---

## 1. Overview

**Product Name:** Aimywhatsapp  
**Type:** Self-hosted WhatsApp AI Automation Platform  
**Target Users:** Businesses, freelancers, solopreneurs, agencies  
**Core Value Prop:** Connect your WhatsApp number, configure an AI bot with your knowledge base, automate replies — all from a clean web dashboard. No coding needed for end users.

### What it does
- Connects to WhatsApp via QR/pairing code (WhatsApp Web protocol)
- Intercepts incoming messages and routes them through an AI engine
- AI replies based on a custom knowledge base, persona, and rules
- Dashboard lets you monitor, override, manage contacts, and analyze performance
- Multimodal: handles text, images, audio, video, documents
- SaaS-ready: multi-tenant, white-label capable

---

## 2. Goals & Non-Goals

### ✅ Goals
- Self-hosted, Docker-deployable, single command startup
- Multi-tenant (multiple workspaces/users)
- WhatsApp Web based (no WhatsApp Business API fees)
- AI-powered with RAG (knowledge base grounding)
- Real-time monitoring with human override
- Visual flow builder for non-AI conversation paths
- Production-grade reliability and security

### ❌ Non-Goals (v1)
- Native mobile app (web is responsive, that's enough for v1)
- WhatsApp Business API / Meta Cloud API integration (future)
- SMS / other channels (future — Telegram, Instagram DMs)
- On-device / local LLM inference (future)
- Custom model fine-tuning

---

## 3. System Architecture

### High-Level Diagram

```
Browser (Next.js)
      │
      │  HTTPS / WebSocket
      ▼
┌─────────────────────────────────────────────────┐
│              API Server (Fastify)                │
│                                                  │
│  /auth      /workspaces    /contacts             │
│  /whatsapp  /knowledge     /flows                │
│  /messages  /analytics     /settings             │
│  /broadcasts /webhooks     /ai                   │
│                                                  │
│  ┌─────────────┐   ┌─────────────────────────┐  │
│  │  WA Manager  │   │      AI Engine          │  │
│  │  (Baileys)   │   │  (Claude / GPT)         │  │
│  │             │   │  + RAG Pipeline          │  │
│  │  per-session │   │  + Multimodal handlers  │  │
│  └──────┬──────┘   └───────────┬─────────────┘  │
│         │                      │                 │
│  ┌──────▼──────────────────────▼─────────────┐  │
│  │           Message Router                   │  │
│  │  Contact rules → Flow check → AI dispatch  │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌─────────────┐   ┌──────────┐  ┌──────────┐  │
│  │  BullMQ      │   │  Socket  │  │  Cron    │  │
│  │  Job Queue   │   │  Server  │  │  Jobs    │  │
│  └─────────────┘   └──────────┘  └──────────┘  │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│                 Data Layer                        │
│  PostgreSQL   Redis    Qdrant    S3/MinIO         │
│  (primary)    (cache)  (vectors) (files)          │
└──────────────────────────────────────────────────┘
```

### Request Lifecycle (Inbound WhatsApp Message)

```
WhatsApp Message Arrives
        │
        ▼
WA Manager (Baileys) receives raw event
        │
        ▼
Message Normalizer
  → extract: text, media type, sender JID, timestamp, reply-to
        │
        ▼
Contact Resolver
  → lookup/create contact in DB
  → attach tags, segment, settings
        │
        ▼
Routing Engine (in priority order):
  1. Is contact blocked? → drop
  2. Is human takeover active? → skip bot, notify human
  3. Is approval mode on? → draft reply, await human approval
  4. Does message match a Flow trigger? → execute Flow
  5. Is AI enabled for this contact? → AI Engine
  6. Default → no reply
        │
        ▼
AI Engine (if routed there)
  → Load persona + system prompt
  → Fetch conversation history (last N messages)
  → Fetch relevant KB chunks (RAG)
  → Handle media (vision/transcription if needed)
  → Call LLM API
  → Post-process reply (length check, format)
  → Confidence check → escalate if low
        │
        ▼
Reply Dispatcher
  → Send via WA Manager
  → Log to DB (messages table)
  → Emit to WebSocket (live monitor)
  → Trigger any webhooks
```

---

## 4. Tech Stack

### Frontend
| Item | Choice | Notes |
|------|--------|-------|
| Framework | Next.js 14 (App Router) | SSR + API routes |
| Styling | Tailwind CSS v3 | Utility-first |
| Components | shadcn/ui + Radix UI | Accessible, unstyled base |
| State | Zustand | Lightweight global state |
| Data fetching | TanStack Query v5 | Caching, background refetch |
| Forms | React Hook Form + Zod | Typed validation |
| Charts | Recharts | Analytics dashboards |
| Flow Builder | React Flow (xyflow) | Node-based visual editor |
| Realtime | Socket.io-client | Live monitor |
| Rich text | TipTap | Knowledge base editor |
| File upload | react-dropzone | KB document upload |
| Icons | Lucide React | Consistent icon set |

### Backend
| Item | Choice | Notes |
|------|--------|-------|
| Runtime | Node.js 20+ | LTS, required for Baileys |
| Framework | Fastify v4 | 2x faster than Express, schema-first |
| ORM | Prisma | Type-safe, migrations, great DX |
| Validation | Zod | Shared with frontend |
| Auth | JWT (access + refresh tokens) | Stateless |
| Password hashing | Argon2 | Better than bcrypt |
| WA Library | @whiskeysockets/baileys | Best open-source WA Web |
| AI SDK | Anthropic SDK + OpenAI SDK | Both, switchable per workspace |
| Embeddings | OpenAI text-embedding-3-small | Or nomic-embed via Ollama |
| Job queue | BullMQ + Redis | Background tasks |
| Realtime | Socket.io | WebSocket server |
| File handling | Fastify-multipart | Upload handling |
| HTTP client | Got | Webhook outbound calls |
| Logging | Pino | JSON structured logs (Fastify default) |
| Testing | Vitest + supertest | Unit + integration |

### Data Layer
| Item | Choice | Notes |
|------|--------|-------|
| Primary DB | PostgreSQL 15 | Main data store |
| Cache | Redis 7 | Sessions, rate limiting, queues |
| Vector DB | Qdrant (self-hosted) | Knowledge base embeddings |
| File storage | Local fs / MinIO | Documents, media. S3-compatible |

### Infrastructure
| Item | Choice | Notes |
|------|--------|-------|
| Containerization | Docker + Docker Compose | Single-command deploy |
| Reverse proxy | Caddy (optional) | Auto HTTPS |
| Process manager | PM2 (non-Docker) | Alt deploy method |

---

## 5. Database Schema

### Prisma Schema

```prisma
// =====================
// AUTH & TENANCY
// =====================

model Workspace {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique
  logoUrl     String?
  plan        Plan     @default(FREE)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  users           WorkspaceUser[]
  whatsappSessions WhatsappSession[]
  contacts        Contact[]
  conversations   Conversation[]
  messages        Message[]
  knowledgeBases  KnowledgeBase[]
  flows           Flow[]
  broadcasts      Broadcast[]
  apiKeys         ApiKey[]
  webhooks        Webhook[]
  settings        WorkspaceSettings?
}

enum Plan {
  FREE
  PRO
  ENTERPRISE
}

model User {
  id           String    @id @default(cuid())
  email        String    @unique
  passwordHash String
  name         String
  avatarUrl    String?
  createdAt    DateTime  @default(now())
  lastLoginAt  DateTime?

  workspaces   WorkspaceUser[]
  sessions     UserSession[]
}

model WorkspaceUser {
  id          String    @id @default(cuid())
  workspaceId String
  userId      String
  role        UserRole  @default(AGENT)
  joinedAt    DateTime  @default(now())

  workspace   Workspace @relation(fields: [workspaceId], references: [id])
  user        User      @relation(fields: [userId], references: [id])

  @@unique([workspaceId, userId])
}

enum UserRole {
  OWNER
  ADMIN
  AGENT
  VIEWER
}

model UserSession {
  id           String   @id @default(cuid())
  userId       String
  refreshToken String   @unique
  expiresAt    DateTime
  createdAt    DateTime @default(now())
  ipAddress    String?
  userAgent    String?

  user         User     @relation(fields: [userId], references: [id])
}

model ApiKey {
  id          String   @id @default(cuid())
  workspaceId String
  name        String
  keyHash     String   @unique
  keyPreview  String   // first 8 chars for display
  lastUsedAt  DateTime?
  createdAt   DateTime @default(now())
  expiresAt   DateTime?

  workspace   Workspace @relation(fields: [workspaceId], references: [id])
}

// =====================
// WHATSAPP
// =====================

model WhatsappSession {
  id           String        @id @default(cuid())
  workspaceId  String
  accountId    String        // e.g. "default", "work", "sales"
  phoneNumber  String?       // E.164 format after link
  displayName  String?
  status       SessionStatus @default(DISCONNECTED)
  credsPath    String        // path to Baileys credentials
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt

  workspace    Workspace     @relation(fields: [workspaceId], references: [id])
  contacts     Contact[]
  conversations Conversation[]

  @@unique([workspaceId, accountId])
}

enum SessionStatus {
  DISCONNECTED
  CONNECTING
  QR_READY
  CONNECTED
  BANNED
  ERROR
}

// =====================
// CONTACTS & CRM
// =====================

model Contact {
  id              String    @id @default(cuid())
  workspaceId     String
  sessionId       String
  jid             String    // WhatsApp JID (e.g. 919876543210@s.whatsapp.net)
  phoneNumber     String    // E.164
  name            String?   // from WA profile
  displayName     String?   // user-set override
  profilePicUrl   String?
  about           String?
  autoreplyEnabled Boolean  @default(true)
  humanTakeover   Boolean  @default(false)
  approvalMode    Boolean  @default(false)
  isBlocked       Boolean  @default(false)
  isVip           Boolean  @default(false)
  language        String?  // detected language code
  notes           String?  // internal agent notes
  firstSeenAt     DateTime @default(now())
  lastMessageAt   DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  workspace       Workspace  @relation(fields: [workspaceId], references: [id])
  session         WhatsappSession @relation(fields: [sessionId], references: [id])
  labels          ContactLabel[]
  conversations   Conversation[]
  customFields    ContactCustomField[]

  @@unique([workspaceId, jid])
}

model Label {
  id          String   @id @default(cuid())
  workspaceId String
  name        String
  color       String   // hex color
  createdAt   DateTime @default(now())

  contacts    ContactLabel[]

  @@unique([workspaceId, name])
}

model ContactLabel {
  contactId   String
  labelId     String

  contact     Contact  @relation(fields: [contactId], references: [id])
  label       Label    @relation(fields: [labelId], references: [id])

  @@id([contactId, labelId])
}

model ContactCustomField {
  id        String  @id @default(cuid())
  contactId String
  key       String
  value     String

  contact   Contact @relation(fields: [contactId], references: [id])

  @@unique([contactId, key])
}

// =====================
// CONVERSATIONS & MESSAGES
// =====================

model Conversation {
  id              String             @id @default(cuid())
  workspaceId     String
  sessionId       String
  contactId       String
  status          ConversationStatus @default(OPEN)
  assignedUserId  String?
  resolvedAt      DateTime?
  lastMessageAt   DateTime?
  unreadCount     Int                @default(0)
  sentiment       Sentiment?
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt

  workspace       Workspace          @relation(fields: [workspaceId], references: [id])
  session         WhatsappSession    @relation(fields: [sessionId], references: [id])
  contact         Contact            @relation(fields: [contactId], references: [id])
  messages        Message[]
}

enum ConversationStatus {
  OPEN
  RESOLVED
  WAITING_HUMAN
  PENDING_APPROVAL
}

enum Sentiment {
  POSITIVE
  NEUTRAL
  NEGATIVE
}

model Message {
  id              String      @id @default(cuid())
  workspaceId     String
  conversationId  String
  waMessageId     String?     @unique // WhatsApp message ID
  direction       Direction
  senderType      SenderType
  senderUserId    String?     // if sent by human agent
  content         String      // text content
  mediaType       MediaType?
  mediaUrl        String?     // stored media path/url
  mediaCaption    String?
  mediaTranscript String?     // for audio/video
  replyToId       String?     // message being replied to
  sentiment       Sentiment?
  confidence      Float?      // AI confidence score
  kbChunksUsed    String[]    // KB chunk IDs used for this reply
  flowId          String?     // if generated by a flow
  isApproved      Boolean?    // for approval mode
  isRead          Boolean     @default(false)
  deliveredAt     DateTime?
  readAt          DateTime?
  createdAt       DateTime    @default(now())

  workspace       Workspace   @relation(fields: [workspaceId], references: [id])
  conversation    Conversation @relation(fields: [conversationId], references: [id])
}

enum Direction {
  INBOUND   // from contact
  OUTBOUND  // from bot or human
}

enum SenderType {
  CONTACT
  BOT
  HUMAN
}

enum MediaType {
  IMAGE
  VIDEO
  AUDIO
  DOCUMENT
  STICKER
  LOCATION
  CONTACT_CARD
}

// =====================
// KNOWLEDGE BASE
// =====================

model KnowledgeBase {
  id          String   @id @default(cuid())
  workspaceId String
  name        String
  description String?
  isDefault   Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  workspace   Workspace      @relation(fields: [workspaceId], references: [id])
  documents   KBDocument[]
  faqs        KBFaq[]
}

model KBDocument {
  id              String        @id @default(cuid())
  knowledgeBaseId String
  name            String
  type            KBDocType
  sourceUrl       String?       // for URL ingestion
  filePath        String?       // for uploaded files
  content         String?       // extracted text
  status          IndexStatus   @default(PENDING)
  chunkCount      Int           @default(0)
  errorMessage    String?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  knowledgeBase   KnowledgeBase @relation(fields: [knowledgeBaseId], references: [id])
  chunks          KBChunk[]
}

enum KBDocType {
  PDF
  DOCX
  TXT
  CSV
  URL
  MANUAL
}

enum IndexStatus {
  PENDING
  PROCESSING
  INDEXED
  FAILED
}

model KBChunk {
  id         String     @id @default(cuid())
  documentId String
  content    String
  embedding  Float[]    // stored in Qdrant; this is a reference
  qdrantId   String     @unique  // Qdrant point ID
  chunkIndex Int
  metadata   Json?      // page number, section, etc.
  createdAt  DateTime   @default(now())

  document   KBDocument @relation(fields: [documentId], references: [id])
}

model KBFaq {
  id              String        @id @default(cuid())
  knowledgeBaseId String
  question        String
  answer          String
  qdrantId        String?       @unique
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  knowledgeBase   KnowledgeBase @relation(fields: [knowledgeBaseId], references: [id])
}

// =====================
// FLOWS
// =====================

model Flow {
  id          String     @id @default(cuid())
  workspaceId String
  name        String
  description String?
  isActive    Boolean    @default(true)
  triggerType FlowTrigger
  triggerConfig Json     // trigger-specific config
  nodes       Json       // React Flow nodes array
  edges       Json       // React Flow edges array
  stats       FlowStats?
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  workspace   Workspace  @relation(fields: [workspaceId], references: [id])
}

enum FlowTrigger {
  FIRST_MESSAGE
  KEYWORD
  LABEL_ADDED
  INBOUND_MEDIA
  SCHEDULED
  API
}

model FlowStats {
  id           String   @id @default(cuid())
  flowId       String   @unique
  totalEntered Int      @default(0)
  totalCompleted Int    @default(0)
  lastRunAt    DateTime?

  flow         Flow     @relation(fields: [flowId], references: [id])
}

// =====================
// BROADCASTS
// =====================

model Broadcast {
  id           String          @id @default(cuid())
  workspaceId  String
  name         String
  message      String
  mediaUrl     String?
  targetType   BroadcastTarget
  labelIds     String[]        // if targetType = LABEL
  contactIds   String[]        // if targetType = CONTACTS
  scheduledAt  DateTime?
  sentAt       DateTime?
  status       BroadcastStatus @default(DRAFT)
  stats        Json?           // { sent, delivered, read, replied }
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt

  workspace    Workspace       @relation(fields: [workspaceId], references: [id])
  recipients   BroadcastRecipient[]
}

enum BroadcastTarget {
  ALL
  LABEL
  CONTACTS
}

enum BroadcastStatus {
  DRAFT
  SCHEDULED
  SENDING
  SENT
  FAILED
}

model BroadcastRecipient {
  id          String    @id @default(cuid())
  broadcastId String
  contactId   String
  status      String    // sent | delivered | read | replied | failed
  sentAt      DateTime?
  deliveredAt DateTime?
  readAt      DateTime?

  broadcast   Broadcast @relation(fields: [broadcastId], references: [id])
}

// =====================
// SETTINGS & WEBHOOKS
// =====================

model WorkspaceSettings {
  id                 String   @id @default(cuid())
  workspaceId        String   @unique
  botName            String   @default("Assistant")
  botPersona         String?  // system prompt / persona
  aiProvider         String   @default("anthropic") // anthropic | openai
  aiModel            String   @default("claude-sonnet-4-5-20250514")
  aiTemperature      Float    @default(0.7)
  confidenceThreshold Float   @default(0.6)
  defaultLanguage    String   @default("auto")
  businessHoursEnabled Boolean @default(false)
  businessHoursConfig Json?
  awayMessage        String?
  welcomeMessage     String?
  humanEscalationMessage String?
  maxConversationHistory Int  @default(20)
  updatedAt          DateTime @updatedAt

  workspace          Workspace @relation(fields: [workspaceId], references: [id])
}

model Webhook {
  id          String   @id @default(cuid())
  workspaceId String
  name        String
  url         String
  secret      String?  // HMAC signing secret
  events      String[] // e.g. ["message.inbound", "message.outbound"]
  isActive    Boolean  @default(true)
  lastCalledAt DateTime?
  failureCount Int     @default(0)
  createdAt   DateTime @default(now())

  workspace   Workspace @relation(fields: [workspaceId], references: [id])
}

model AuditLog {
  id          String   @id @default(cuid())
  workspaceId String
  userId      String?
  action      String   // e.g. "contact.block", "settings.update"
  entityType  String?
  entityId    String?
  metadata    Json?
  ipAddress   String?
  createdAt   DateTime @default(now())
}
```

---

## 6. API Specification

### Base URL
```
/api/v1
```

### Auth Endpoints
```
POST   /auth/register          Create new user + workspace
POST   /auth/login             Login → access + refresh tokens
POST   /auth/refresh           Refresh access token
POST   /auth/logout            Invalidate refresh token
POST   /auth/forgot-password   Send reset email
POST   /auth/reset-password    Reset with token
GET    /auth/me                Current user info
```

### Workspace Endpoints
```
GET    /workspaces             List user's workspaces
POST   /workspaces             Create workspace
GET    /workspaces/:id         Get workspace
PATCH  /workspaces/:id         Update workspace
GET    /workspaces/:id/users   List workspace members
POST   /workspaces/:id/invite  Invite user by email
DELETE /workspaces/:id/users/:userId  Remove member
```

### WhatsApp Session Endpoints
```
GET    /whatsapp/sessions              List sessions
POST   /whatsapp/sessions              Create session (returns id)
GET    /whatsapp/sessions/:id/status   Get connection status
GET    /whatsapp/sessions/:id/qr       Get QR code (data URL or SVG)
POST   /whatsapp/sessions/:id/pair     Request pairing code (phone number → code)
POST   /whatsapp/sessions/:id/disconnect  Disconnect session
DELETE /whatsapp/sessions/:id          Delete session + credentials
```

### Contacts Endpoints
```
GET    /contacts                       List contacts (paginated, filterable)
GET    /contacts/:id                   Get contact
PATCH  /contacts/:id                   Update contact (name, notes, settings)
DELETE /contacts/:id                   Delete contact + history
POST   /contacts/:id/block             Block contact
POST   /contacts/:id/unblock           Unblock contact
POST   /contacts/:id/takeover          Enable human takeover
POST   /contacts/:id/release           Release human takeover (re-enable bot)
POST   /contacts/:id/labels            Add label
DELETE /contacts/:id/labels/:labelId   Remove label
GET    /contacts/labels                List all labels
POST   /contacts/labels                Create label
DELETE /contacts/labels/:id            Delete label
GET    /contacts/export                Export as CSV
```

### Conversations & Messages Endpoints
```
GET    /conversations                  List conversations (paginated, filterable)
GET    /conversations/:id              Get conversation with messages
PATCH  /conversations/:id              Update status, assignment
POST   /conversations/:id/resolve      Mark resolved
POST   /conversations/:id/reopen       Reopen conversation
POST   /conversations/:id/messages     Send manual message (human agent)
POST   /conversations/:id/messages/:msgId/approve  Approve pending bot reply
DELETE /conversations/:id/messages/:msgId/approve  Reject pending bot reply
GET    /conversations/:id/export       Export chat as PDF/JSON
```

### Knowledge Base Endpoints
```
GET    /knowledge-bases                      List KBs
POST   /knowledge-bases                      Create KB
GET    /knowledge-bases/:id                  Get KB
PATCH  /knowledge-bases/:id                  Update KB
DELETE /knowledge-bases/:id                  Delete KB

POST   /knowledge-bases/:id/documents        Upload document / add URL
GET    /knowledge-bases/:id/documents        List documents
DELETE /knowledge-bases/:id/documents/:docId Delete document
POST   /knowledge-bases/:id/documents/:docId/reindex  Re-process document

GET    /knowledge-bases/:id/faqs             List FAQs
POST   /knowledge-bases/:id/faqs             Create FAQ
PATCH  /knowledge-bases/:id/faqs/:faqId      Update FAQ
DELETE /knowledge-bases/:id/faqs/:faqId      Delete FAQ

POST   /knowledge-bases/:id/test             Test a query → returns answer + sources
```

### Flows Endpoints
```
GET    /flows                List flows
POST   /flows                Create flow
GET    /flows/:id            Get flow (with nodes + edges)
PUT    /flows/:id            Save flow (full replace)
PATCH  /flows/:id            Update flow metadata
DELETE /flows/:id            Delete flow
POST   /flows/:id/activate   Enable flow
POST   /flows/:id/deactivate Disable flow
GET    /flows/:id/stats      Flow analytics
```

### Broadcasts Endpoints
```
GET    /broadcasts           List broadcasts
POST   /broadcasts           Create broadcast
GET    /broadcasts/:id       Get broadcast
PATCH  /broadcasts/:id       Update draft
POST   /broadcasts/:id/send  Send immediately
POST   /broadcasts/:id/schedule  Schedule
DELETE /broadcasts/:id       Delete draft
GET    /broadcasts/:id/stats Delivery stats
```

### Analytics Endpoints
```
GET    /analytics/overview         Summary metrics (messages, contacts, etc.)
GET    /analytics/messages         Message volume over time
GET    /analytics/contacts         Contact growth over time
GET    /analytics/bot-performance  Resolution rate, confidence, escalations
GET    /analytics/sentiment        Sentiment trends
GET    /analytics/top-topics       AI-clustered topic analysis
GET    /analytics/response-time    Avg response time (bot vs human)
```

### Settings Endpoints
```
GET    /settings             Get workspace settings
PATCH  /settings             Update settings
GET    /settings/webhooks    List webhooks
POST   /settings/webhooks    Create webhook
PATCH  /settings/webhooks/:id Update webhook
DELETE /settings/webhooks/:id Delete webhook
GET    /settings/api-keys    List API keys
POST   /settings/api-keys    Create API key
DELETE /settings/api-keys/:id Revoke API key
GET    /settings/audit-log   Audit log (paginated)
```

### WebSocket Events (Socket.io)
```
// Client → Server
join_workspace      { workspaceId }
join_conversation   { conversationId }

// Server → Client
message:new         { message, conversation }
message:updated     { message }
contact:updated     { contact }
conversation:updated { conversation }
whatsapp:status     { sessionId, status, qrCode? }
typing:start        { conversationId }
typing:stop         { conversationId }
notification:new    { type, payload }
```

---

## 7. Frontend Pages & Components

### Route Map
```
/                          → Landing / redirect to dashboard
/login                     → Login page
/register                  → Register page
/onboarding                → New workspace setup wizard

/dashboard                 → Overview dashboard
/dashboard/inbox           → Conversation inbox (main view)
/dashboard/inbox/:id       → Single conversation thread
/dashboard/contacts        → Contact list
/dashboard/contacts/:id    → Contact detail page
/dashboard/broadcasts      → Broadcast list
/dashboard/broadcasts/new  → Create broadcast
/dashboard/broadcasts/:id  → Broadcast detail/analytics
/dashboard/flows           → Flow list
/dashboard/flows/:id       → Flow builder (canvas)
/dashboard/analytics       → Analytics dashboard
/dashboard/knowledge       → Knowledge base list
/dashboard/knowledge/:id   → KB detail (docs + FAQs)
/dashboard/settings        → Settings (tabbed)
/dashboard/settings/bot    → Bot persona & AI config
/dashboard/settings/whatsapp → WA sessions
/dashboard/settings/team   → Team members
/dashboard/settings/webhooks → Webhooks
/dashboard/settings/api    → API keys
/dashboard/settings/billing → Plan & billing
```

### Key Component List

**Layout Components**
- `AppShell` — sidebar + header + content area
- `Sidebar` — nav links, workspace switcher, connection status badge
- `Header` — search, notifications, user menu

**Connection Components**
- `QRConnectModal` — shows QR code with auto-refresh, connection status
- `PairingCodeModal` — phone number input → code display
- `SessionStatusBadge` — 🟢/🟡/🔴 with tooltip

**Inbox Components**
- `ConversationList` — left panel, virtualized list
- `ConversationItem` — contact name, last message preview, time, unread badge, sentiment dot
- `MessageThread` — right panel, full conversation
- `MessageBubble` — inbound/outbound, with media, metadata, sender type indicator
- `ReplyBar` — text input, send button, emoji, attachment, human/bot toggle
- `ApprovalBanner` — shows pending bot reply awaiting approval
- `TakeoverBanner` — shows human is in control

**Contact Components**
- `ContactTable` — sortable/filterable table with bulk actions
- `ContactCard` — sidebar panel with contact details, labels, settings
- `LabelPicker` — multi-select label dropdown
- `ContactFilters` — filter by label, status, bot enabled, etc.

**Knowledge Base Components**
- `KBDocumentUploader` — drag-drop zone, URL input, shows indexing progress
- `KBDocumentList` — table with status indicators
- `FAQEditor` — Q&A pair editor with rich text
- `KBTestPanel` — query tester, shows answer + highlighted source chunks

**Flow Builder Components**
- `FlowCanvas` — React Flow canvas
- `FlowNodeTypes` — Message, Question, AI, Delay, Tag, Webhook, Condition nodes
- `FlowNodeEditor` — right-panel config for selected node
- `FlowTriggerConfig` — trigger setup (keyword patterns, etc.)

**Analytics Components**
- `MetricCard` — single KPI with trend arrow
- `MessageVolumeChart` — area/bar chart
- `SentimentPieChart` — positive/neutral/negative breakdown
- `BotPerformanceWidget` — resolution rate, avg confidence
- `TopicsCloud` — word cloud of common topics

**Settings Components**
- `PersonaEditor` — rich text system prompt editor
- `AIModelPicker` — provider + model selector with preview
- `BusinessHoursScheduler` — visual week-grid time selector
- `WebhookForm` — URL, events, secret config
- `TeamInviteModal` — email + role picker

---

## 8. AI Engine Specification

### Engine Flow

```typescript
interface AIEngineInput {
  contact: Contact
  inboundMessage: Message
  conversationHistory: Message[]   // last N messages
  kbChunks: KBChunk[]              // RAG results
  settings: WorkspaceSettings
  mediaData?: {
    type: MediaType
    buffer?: Buffer
    url?: string
    transcript?: string
  }
}

interface AIEngineOutput {
  reply: string
  confidence: number               // 0.0 - 1.0
  kbChunksUsed: string[]          // IDs of chunks that were cited
  shouldEscalate: boolean
  escalationReason?: string
  detectedLanguage?: string
  sentiment?: Sentiment
}
```

### System Prompt Template

```
You are {{botName}}, {{persona}}.

{{#if knowledgeBase}}
Use the following knowledge base context to answer questions. 
Only answer based on what's in the knowledge base. 
If unsure, say you don't have that information and offer to connect them with a human.

Knowledge Base Context:
{{kbContext}}
{{/if}}

{{#if businessHours}}
Current time: {{currentTime}}. 
Business hours: {{businessHours}}.
{{#if outsideHours}}You are outside business hours. Acknowledge queries but inform the user a human will respond during business hours.{{/if}}
{{/if}}

{{#if contactHistory}}
What you know about this contact:
{{contactHistory}}
{{/if}}

Rules:
- Always reply in the same language as the user's message (detected: {{language}})
- Be concise and helpful
- Never make up facts not in the knowledge base
- If confidence is low, offer human escalation
- For sensitive topics (refunds, complaints, legal), always escalate

Contact name: {{contactName}}
```

### Media Handling

```
Inbound Media Type → Handler

IMAGE     → Claude Vision API (describe, analyze, answer about)
AUDIO     → Whisper transcription → text → LLM reply
VIDEO     → Extract frames → Claude Vision (short clip summary)
DOCUMENT  → PDF/DOCX extraction → pass as text context to LLM
LOCATION  → Acknowledge, extract lat/lng, optionally lookup address
```

### RAG Pipeline

```
1. Embed query text using embedding model
2. Query Qdrant: top-K chunks (K=5 default)
   - Filter by workspaceId + knowledgeBaseId
   - Similarity threshold: 0.75
3. Re-rank chunks by relevance (optional, Phase 2)
4. Format chunks as context in system prompt
5. Track which chunks were used (for source attribution)
```

### Confidence Scoring

The AI engine evaluates confidence via a secondary prompt after generating the reply:

```
Given this question: "{{question}}"
And this answer: "{{answer}}"
Was the answer grounded in the provided context? 
Rate confidence 0.0-1.0. Reply with only a JSON: {"confidence": 0.85, "reason": "..."}
```

If `confidence < settings.confidenceThreshold` → set `shouldEscalate = true`.

---

## 9. WhatsApp Integration Layer

### Session Manager

```typescript
class WASessionManager {
  sessions: Map<string, WASession>
  
  async createSession(workspaceId: string, accountId: string): Promise<string>
  async getQRCode(sessionId: string): Promise<string>  // data URL
  async getPairingCode(sessionId: string, phoneNumber: string): Promise<string>
  async disconnect(sessionId: string): Promise<void>
  async getStatus(sessionId: string): Promise<SessionStatus>
  
  // Internal
  private onConnectionUpdate(sessionId: string, update: ConnectionUpdate)
  private onMessage(sessionId: string, message: WAMessage)
  private onMessageDelivered(sessionId: string, update: MessageUpdate)
}
```

### Message Normalizer

Converts Baileys `WAMessage` → internal `NormalizedMessage`:

```typescript
interface NormalizedMessage {
  waMessageId: string
  jid: string                // sender JID
  timestamp: Date
  direction: 'inbound'
  text: string | null
  mediaType: MediaType | null
  mediaBuffer: Buffer | null  // downloaded media
  mediaUrl: string | null
  mediaCaption: string | null
  replyToWaMessageId: string | null
  replyToText: string | null
  isFromMe: boolean
  isGroup: boolean
  groupJid: string | null
  rawMessage: WAMessage      // original for debugging
}
```

### Reconnect Strategy

```
On disconnect:
  attempt 1: wait 2s
  attempt 2: wait 5s
  attempt 3: wait 15s
  attempt 4: wait 30s
  attempt 5+: wait 60s, emit alert to workspace

On QR expiry: auto-regenerate and emit new QR via WebSocket
On ban detection: emit critical alert, stop reconnecting
```

---

## 10. Knowledge Base & RAG Pipeline

### Document Processing Pipeline

```
Upload/URL → Extraction → Chunking → Embedding → Qdrant Index

Extraction:
  PDF      → pdf-parse
  DOCX     → mammoth
  TXT/CSV  → direct read
  URL      → cheerio scrape (main content only, strip nav/footer)

Chunking:
  Strategy: Recursive character splitting
  Chunk size: 500 tokens
  Overlap: 50 tokens
  Preserve: sentence boundaries, paragraph structure

Embedding:
  Model: text-embedding-3-small (1536 dims) or nomic-embed-text
  Batch size: 100 chunks per API call

Qdrant Storage:
  Collection: workspace_${workspaceId}_kb_${kbId}
  Payload: { chunkId, documentId, content, metadata }
```

### Qdrant Collections Strategy

```
One collection per knowledge base:
  wabot_kb_{knowledgeBaseId}
  
Vector config:
  size: 1536
  distance: Cosine

Indexing: hnsw (approximate nearest neighbor)
```

---

## 11. Flow Builder

### Node Type Specifications

```typescript
type FlowNodeType = 
  | 'trigger'      // Entry point
  | 'message'      // Send a message
  | 'question'     // Send message + wait for reply
  | 'ai'           // AI response node (with optional KB override)
  | 'condition'    // Branch: if/else based on data or keywords
  | 'delay'        // Wait X minutes/hours
  | 'tag'          // Add/remove label on contact
  | 'webhook'      // Call external URL
  | 'assign'       // Assign conversation to human
  | 'end'          // End flow

// Message Node Config
interface MessageNodeConfig {
  text?: string
  mediaUrl?: string
  mediaType?: MediaType
  caption?: string
  buttons?: string[]    // WhatsApp quick reply buttons
}

// Question Node Config
interface QuestionNodeConfig extends MessageNodeConfig {
  variableName: string        // save answer to {{variableName}}
  timeout?: number            // minutes to wait for reply
  timeoutBranch?: string      // node ID to go to on timeout
}

// Condition Node Config
interface ConditionNodeConfig {
  conditions: Array<{
    field: string             // e.g. "message.text", "contact.label", "vars.answer"
    operator: 'contains' | 'equals' | 'startsWith' | 'regex' | 'isEmpty'
    value: string
    branch: string            // node ID for true branch
  }>
  defaultBranch: string       // node ID if no condition matches
}

// AI Node Config
interface AINodeConfig {
  systemPromptOverride?: string
  knowledgeBaseId?: string    // use specific KB, or null for workspace default
  maxTokens?: number
}

// Webhook Node Config
interface WebhookNodeConfig {
  url: string
  method: 'GET' | 'POST' | 'PUT'
  headers?: Record<string, string>
  body?: string              // template with {{variables}}
  saveResponseTo?: string    // variable name
}
```

### Flow Execution Engine

```typescript
class FlowExecutor {
  async execute(flowId: string, contact: Contact, triggerMessage: Message): Promise<void>
  
  private async executeNode(node: FlowNode, context: FlowContext): Promise<string | null>
  // returns next node ID or null (end)
  
  private async waitForReply(contactId: string, timeoutMs: number): Promise<Message | null>
  // uses Redis pub/sub to wait for next inbound message from contact
}

interface FlowContext {
  contactId: string
  conversationId: string
  variables: Record<string, string>   // collected during flow
  currentNodeId: string
  startedAt: Date
}
```

---

## 12. Real-Time System

### Socket.io Architecture

```
Namespace: /ws
Authentication: JWT in handshake auth

Rooms:
  workspace:{workspaceId}       - all workspace events
  conversation:{conversationId} - conversation-specific events

Event Emission Points:
  Message received   → message:new       → workspace + conversation room
  Message sent       → message:new       → workspace + conversation room
  WA status change   → whatsapp:status   → workspace room
  Contact updated    → contact:updated   → workspace room
  Approval needed    → notification:new  → workspace room
  Human escalation   → notification:new  → workspace room
  Broadcast progress → broadcast:progress → workspace room
```

### Notification Center

Notifications are stored in Redis with a 7-day TTL:

```typescript
type NotificationType = 
  | 'escalation_needed'     // bot wants human
  | 'approval_needed'       // message waiting for approval
  | 'new_contact'           // first message from unknown contact
  | 'broadcast_complete'    // broadcast finished sending
  | 'kb_indexed'            // document finished indexing
  | 'wa_disconnected'       // WhatsApp session dropped
  | 'human_reply_needed'    // human takeover but human hasn't replied in X min
```

---

## 13. Job Queue & Background Tasks

### Queue Definitions (BullMQ)

```
Queue: embed-document
  Job: { documentId, chunkContents[] }
  Concurrency: 3
  Retry: 3 times with exponential backoff
  Purpose: Process and embed KB documents

Queue: send-broadcast
  Job: { broadcastId, recipientIds[] }
  Concurrency: 1
  Rate limit: 1 message per second (WA anti-spam)
  Purpose: Fan out broadcast to all recipients

Queue: outbound-webhook
  Job: { webhookId, event, payload }
  Concurrency: 10
  Retry: 5 times
  Purpose: Deliver webhook events to external URLs

Queue: process-media
  Job: { messageId, mediaType, mediaBuffer }
  Concurrency: 5
  Purpose: Transcribe audio, analyze images, extract docs

Queue: analytics-aggregate
  Cron: every 1 hour
  Purpose: Pre-compute analytics aggregates
  
Queue: cleanup
  Cron: every day at 2 AM
  Purpose: Delete old messages per retention policy, expire sessions
```

---

## 14. Security & Auth

### JWT Strategy
```
Access Token:  15 minutes TTL, signed with RS256
Refresh Token: 30 days TTL, stored in DB, rotated on each use
API Key:       No expiry (or configurable), stored as Argon2 hash
```

### Request Authentication Flow
```
1. Extract Bearer token from Authorization header
2. Verify JWT signature + expiry
3. Extract workspaceId from request path
4. Verify user is member of that workspace
5. Check role permissions for the operation
6. Proceed or 403
```

### Permission Matrix
```
              OWNER  ADMIN  AGENT  VIEWER
contacts       RW     RW     R      R
conversations  RW     RW     RW     R
knowledge      RW     RW     R      R
flows          RW     RW     R      R
broadcasts     RW     RW     R      R
analytics      R      R      R      R
settings       RW     RW     -      -
whatsapp       RW     R      -      -
team           RW     R      -      -
billing        RW     -      -      -
```

### Rate Limiting
```
Auth endpoints:      5 req/min per IP
API endpoints:       200 req/min per workspace
WA send:             60 messages/min per session (WA limit)
KB test:             20 req/min per workspace
Webhook delivery:    Exponential backoff on failure
```

### Security Headers
- Helmet.js: CSP, HSTS, X-Frame-Options
- CORS: whitelist frontend origin only
- All file uploads: MIME type validation + size limit (25MB)
- Stored credentials: encrypted at rest (AES-256)

---

## 15. Deployment

### Docker Compose (Production)

```yaml
version: '3.8'

services:
  app:
    build: .
    ports: ['3000:3000']
    environment:
      - DATABASE_URL=postgresql://...
      - REDIS_URL=redis://redis:6379
      - QDRANT_URL=http://qdrant:6333
    depends_on: [postgres, redis, qdrant]
    volumes:
      - ./data/uploads:/app/uploads
      - ./data/wa-sessions:/app/wa-sessions

  postgres:
    image: postgres:15-alpine
    volumes: ['postgres_data:/var/lib/postgresql/data']
    environment:
      POSTGRES_DB: wabot
      POSTGRES_PASSWORD: ${DB_PASSWORD}

  redis:
    image: redis:7-alpine
    volumes: ['redis_data:/data']
    command: redis-server --appendonly yes

  qdrant:
    image: qdrant/qdrant
    volumes: ['qdrant_data:/qdrant/storage']
    ports: ['6333:6333']  # remove in production

volumes:
  postgres_data:
  redis_data:
  qdrant_data:
```

### Minimum Server Requirements
```
RAM:  2GB (4GB recommended)
CPU:  2 vCPU
Disk: 20GB SSD
OS:   Ubuntu 22.04 LTS / Debian 12
Node: 20.x LTS
```

---

## 16. File Structure

```
wabot/
├── apps/
│   ├── web/                         # Next.js frontend
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   ├── login/
│   │   │   │   └── register/
│   │   │   ├── (dashboard)/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── dashboard/
│   │   │   │   ├── inbox/
│   │   │   │   ├── contacts/
│   │   │   │   ├── knowledge/
│   │   │   │   ├── flows/
│   │   │   │   ├── broadcasts/
│   │   │   │   ├── analytics/
│   │   │   │   └── settings/
│   │   │   └── api/                 # Next.js API routes (auth only)
│   │   ├── components/
│   │   │   ├── ui/                  # shadcn components
│   │   │   ├── layout/
│   │   │   ├── inbox/
│   │   │   ├── contacts/
│   │   │   ├── knowledge/
│   │   │   ├── flows/
│   │   │   ├── analytics/
│   │   │   └── settings/
│   │   ├── hooks/
│   │   ├── stores/                  # Zustand stores
│   │   ├── lib/
│   │   │   ├── api.ts               # API client
│   │   │   ├── socket.ts            # Socket.io client
│   │   │   └── utils.ts
│   │   └── types/
│   │
│   └── api/                         # Fastify backend
│       ├── src/
│       │   ├── server.ts            # Fastify app setup
│       │   ├── routes/
│       │   │   ├── auth.ts
│       │   │   ├── workspaces.ts
│       │   │   ├── whatsapp.ts
│       │   │   ├── contacts.ts
│       │   │   ├── conversations.ts
│       │   │   ├── knowledge.ts
│       │   │   ├── flows.ts
│       │   │   ├── broadcasts.ts
│       │   │   ├── analytics.ts
│       │   │   └── settings.ts
│       │   ├── services/
│       │   │   ├── ai/
│       │   │   │   ├── engine.ts
│       │   │   │   ├── rag.ts
│       │   │   │   ├── media.ts
│       │   │   │   └── providers/
│       │   │   │       ├── anthropic.ts
│       │   │   │       └── openai.ts
│       │   │   ├── whatsapp/
│       │   │   │   ├── session-manager.ts
│       │   │   │   ├── message-normalizer.ts
│       │   │   │   └── reply-dispatcher.ts
│       │   │   ├── knowledge/
│       │   │   │   ├── processor.ts
│       │   │   │   ├── embedder.ts
│       │   │   │   └── extractor.ts
│       │   │   ├── flows/
│       │   │   │   └── executor.ts
│       │   │   ├── router.ts        # message routing engine
│       │   │   ├── analytics.ts
│       │   │   └── webhooks.ts
│       │   ├── jobs/
│       │   │   ├── queues.ts
│       │   │   ├── embed-document.ts
│       │   │   ├── send-broadcast.ts
│       │   │   ├── process-media.ts
│       │   │   └── outbound-webhook.ts
│       │   ├── realtime/
│       │   │   └── socket.ts
│       │   ├── db/
│       │   │   └── prisma.ts
│       │   ├── lib/
│       │   │   ├── auth.ts
│       │   │   ├── redis.ts
│       │   │   ├── qdrant.ts
│       │   │   ├── storage.ts
│       │   │   └── logger.ts
│       │   └── types/
│       └── prisma/
│           ├── schema.prisma
│           └── migrations/
│
├── packages/
│   └── shared/                      # Shared types between web + api
│       ├── types/
│       └── validators/              # Zod schemas
│
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
├── package.json                     # Turborepo root
└── turbo.json
```

---

## 17. Build Phases & Milestones

### Phase 1 — Foundation & MVP (Weeks 1–3)
**Goal:** Working WhatsApp AI bot, basic dashboard

- [ ] Monorepo setup (Turborepo)
- [ ] Database schema + Prisma migrations
- [ ] Auth system (register, login, JWT)
- [ ] WhatsApp session manager (QR + pairing code)
- [ ] QR code display in web dashboard
- [ ] Basic message routing engine
- [ ] AI engine (text only, no RAG yet)
- [ ] Conversation inbox (read-only + manual reply)
- [ ] Contact list with auto-reply toggle
- [ ] Docker Compose setup

**Deliverable:** Scan QR, AI replies to WhatsApp messages, view in dashboard ✅

### Phase 2 — Knowledge Base & Multimodal (Weeks 4–6)
**Goal:** Bot answers from your own knowledge

- [ ] Document upload + extraction pipeline
- [ ] URL ingestion + scraping
- [ ] Vector embeddings + Qdrant integration
- [ ] RAG pipeline in AI engine
- [ ] FAQ editor
- [ ] KB test panel
- [ ] Image analysis (Claude Vision)
- [ ] Audio transcription (Whisper)
- [ ] Document reading (PDF/DOCX in chat)
- [ ] Approval mode + pending message UI

**Deliverable:** Bot answers from KB, handles images/audio/docs ✅

### Phase 3 — Flows, Broadcasts & Smart Rules (Weeks 7–9)
**Goal:** Automation without AI

- [ ] Flow builder UI (React Flow canvas)
- [ ] Flow execution engine
- [ ] All node types implemented
- [ ] Broadcast composer + scheduler
- [ ] Business hours config
- [ ] Escalation rules engine
- [ ] Sentiment analysis
- [ ] Human takeover flow
- [ ] SLA alerts

**Deliverable:** Full automation capabilities ✅

### Phase 4 — Analytics, Integrations & Polish (Weeks 10–12)
**Goal:** Production-ready, integrations, SaaS-ready

- [ ] Full analytics dashboard
- [ ] Webhook system (outbound)
- [ ] REST API documentation
- [ ] Multi-workspace + team management
- [ ] Role-based permissions enforced everywhere
- [ ] Audit log
- [ ] GDPR tools (data deletion)
- [ ] Performance optimization (caching, query optimization)
- [ ] Full test coverage (unit + integration)
- [ ] Production hardening (rate limiting, security headers)

**Deliverable:** Production-grade platform ✅

---

## 18. Environment Variables

```bash
# App
NODE_ENV=production
PORT=3000
APP_URL=https://your-domain.com

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/wabot

# Redis
REDIS_URL=redis://localhost:6379

# Qdrant
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=                    # if using Qdrant Cloud

# JWT
JWT_ACCESS_SECRET=                 # random 64-char secret
JWT_REFRESH_SECRET=                # different random 64-char secret

# Encryption (for WA credentials at rest)
ENCRYPTION_KEY=                    # 32-char AES key

# AI Providers
ANTHROPIC_API_KEY=
OPENAI_API_KEY=                    # also used for embeddings

# File Storage
STORAGE_TYPE=local                 # local | s3
STORAGE_PATH=./data/uploads        # for local
S3_BUCKET=                         # for s3
S3_REGION=
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_ENDPOINT=                       # for MinIO or R2

# Email (for auth)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=noreply@your-domain.com

# WhatsApp sessions storage
WA_SESSION_PATH=./data/wa-sessions

# Optional: Sentry
SENTRY_DSN=

# Rate limiting
RATE_LIMIT_MAX=200
RATE_LIMIT_WINDOW=60000
```

---

## Document End

**Next Step:** Shashank reviews this spec → approves → Zed starts Phase 1 build.

Any changes, additions, or corrections to the spec should be made before Phase 1 begins to avoid rework.

---
*Generated by Zed ⚡ | WaBot Platform v1.0 Spec*
