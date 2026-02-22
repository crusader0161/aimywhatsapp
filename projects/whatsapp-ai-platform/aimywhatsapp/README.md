# Aimywhatsapp ⚡

> Self-hosted WhatsApp AI Bot Platform powered by Claude Sonnet 4.6

Connect your WhatsApp, configure an AI bot with your knowledge base, and automate replies — all from a clean web dashboard.

---

## ✨ Features

- 📱 **WhatsApp Connection** — QR code or pairing code, right in the browser
- 🤖 **AI Replies** — Claude Sonnet 4.6, grounded in your knowledge base
- 🧠 **Knowledge Base** — Upload PDFs, DOCX, TXT, or paste website URLs
- 🖼️ **Multimodal** — Understands images, transcribes voice notes, reads documents
- 👥 **Contact Management** — Per-contact auto-reply toggle, labels, human takeover
- 📊 **Live Monitor** — Watch conversations in real time, approve or override bot replies
- 🔀 **Flow Builder** — Visual drag-and-drop conversation flows (no coding)
- 📢 **Broadcasts** — Send bulk messages to all contacts or segments
- 📈 **Analytics** — Messages, sentiment, bot performance dashboard
- 🔗 **Webhooks** — Get notified on any event via HTTP POST
- 🐳 **Docker ready** — Single command deploy

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Docker + Docker Compose
- Anthropic API key
- OpenAI API key (for embeddings)

### Setup

```bash
# 1. Clone the project
cd aimywhatsapp

# 2. Run setup (creates .env, starts DB, runs migrations)
chmod +x setup.sh && ./setup.sh

# 3. Start development
npm run dev
```

Dashboard opens at: **http://localhost:3000**

---

## 🔑 Environment Variables

Copy `.env.example` → `.env` and fill in:

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | ✅ | Claude API key |
| `OPENAI_API_KEY` | ✅ | Used for embeddings (text-embedding-3-small) |
| `JWT_ACCESS_SECRET` | ✅ | Random 64-char hex (`openssl rand -hex 32`) |
| `JWT_REFRESH_SECRET` | ✅ | Different random 64-char hex |
| `ENCRYPTION_KEY` | ✅ | 32-char hex for WA credential encryption |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `REDIS_URL` | ✅ | Redis connection string |
| `QDRANT_URL` | ✅ | Qdrant vector DB URL |

---

## 📁 Project Structure

```
aimywhatsapp/
├── apps/
│   ├── api/          ← Fastify backend + AI engine + WA
│   └── web/          ← Next.js 14 dashboard
├── packages/
│   └── shared/       ← Shared types
├── data/
│   ├── uploads/      ← Uploaded KB documents
│   └── wa-sessions/  ← WhatsApp session credentials
├── docker-compose.yml
├── docker-compose.dev.yml  ← Dev: infra only
└── .env.example
```

---

## 🗺️ How It Works

```
WhatsApp Message
       ↓
Message Router
  → Blocked? Drop
  → Human takeover? Notify agent
  → Flow match? Execute flow
  → AI enabled? →
       ↓
   AI Engine
  → Load persona
  → Fetch KB context (RAG)
  → Handle media (vision/transcription)
  → Call Claude API
  → Confidence check
       ↓
   Send Reply → Log → Live Monitor
```

---

## 🐳 Production Deploy

```bash
# Edit .env for production values
docker compose up -d
```

Access at: http://your-server:3000

---

## 📄 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 + Tailwind CSS + shadcn/ui |
| Backend | Fastify + Node.js 20 |
| WhatsApp | Baileys (WhatsApp Web) |
| AI | Anthropic Claude Sonnet 4.6 |
| Embeddings | OpenAI text-embedding-3-small |
| Database | PostgreSQL + Prisma ORM |
| Vector DB | Qdrant |
| Cache/Queue | Redis + BullMQ |
| Realtime | Socket.io |

---

## ⚠️ Disclaimer

This project uses the WhatsApp Web protocol (Baileys). Use responsibly and in accordance with WhatsApp's Terms of Service. Consider using a dedicated phone number rather than your personal one.

---

*Built with ⚡ by Zed — Aimywhatsapp v0.1.0*
