import Link from 'next/link'

const features = [
  {
    icon: '🤖',
    title: 'AI-Powered Replies',
    desc: 'Claude AI reads your knowledge base and replies instantly — 24/7, in any language.',
  },
  {
    icon: '📚',
    title: 'Knowledge Base (RAG)',
    desc: 'Upload PDFs, docs, or URLs. The AI answers from your content, not generic internet data.',
  },
  {
    icon: '🔀',
    title: 'Visual Flow Builder',
    desc: 'Design conversation flows with drag-and-drop. No coding needed.',
  },
  {
    icon: '📊',
    title: 'Live Analytics',
    desc: 'Track messages, response rates, and bot performance in real time.',
  },
  {
    icon: '📣',
    title: 'Broadcasts',
    desc: 'Send bulk WhatsApp messages to segmented contact lists in seconds.',
  },
  {
    icon: '👤',
    title: 'Human Takeover',
    desc: 'Agents can step in anytime. Bot pauses, human replies, bot resumes.',
  },
  {
    icon: '🔗',
    title: 'Webhooks & API',
    desc: 'Integrate with your CRM, Shopify, or any system via REST API and webhooks.',
  },
  {
    icon: '🏢',
    title: 'Multi-Workspace',
    desc: 'Manage multiple WhatsApp numbers and teams from a single dashboard.',
  },
]

const steps = [
  { n: '1', title: 'Connect WhatsApp', desc: 'Scan a QR code — no Meta Business API approval needed.' },
  { n: '2', title: 'Upload Your Knowledge', desc: 'Add PDFs, FAQs, URLs. The AI learns your business instantly.' },
  { n: '3', title: 'Go Live', desc: 'Your AI bot starts replying to customers automatically.' },
]

const stats = [
  { value: '< 2s', label: 'Average AI response time' },
  { value: '24/7', label: 'Always-on automation' },
  { value: '100%', label: 'Self-hosted & private' },
  { value: '∞', label: 'Messages per month' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Navbar */}
      <nav className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center text-lg">💬</div>
            <span className="font-bold text-lg text-white">Aimywhatsapp</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/auth/login"
              className="px-4 py-2 text-gray-300 hover:text-white text-sm font-medium transition"
            >
              Sign In
            </Link>
            <Link
              href="/auth/register"
              className="px-4 py-2 bg-green-500 hover:bg-green-400 text-white text-sm font-semibold rounded-lg transition"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/30 text-green-400 text-sm px-4 py-1.5 rounded-full mb-6">
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          Self-hosted · No WhatsApp Business API needed
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight mb-6 leading-tight">
          WhatsApp AI Automation
          <br />
          <span className="text-green-400">for your business</span>
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10">
          Connect WhatsApp in 60 seconds. Upload your knowledge base. Let AI handle customer queries
          automatically — while you focus on what matters.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/auth/register"
            className="px-8 py-3.5 bg-green-500 hover:bg-green-400 text-white font-semibold rounded-xl text-lg transition shadow-lg shadow-green-500/20"
          >
            Start for free →
          </Link>
          <Link
            href="/auth/login"
            className="px-8 py-3.5 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-xl text-lg transition"
          >
            Sign in
          </Link>
        </div>

        {/* Dashboard preview */}
        <div className="mt-16 rounded-2xl border border-gray-800 bg-gray-900 overflow-hidden shadow-2xl shadow-black/50">
          <div className="flex items-center gap-1.5 px-4 py-3 border-b border-gray-800 bg-gray-900/50">
            <span className="w-3 h-3 rounded-full bg-red-500/70" />
            <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
            <span className="w-3 h-3 rounded-full bg-green-500/70" />
            <span className="ml-3 text-xs text-gray-500">Aimywhatsapp Dashboard</span>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
            <div className="bg-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">Messages today</p>
              <p className="text-3xl font-bold text-white">1,284</p>
              <p className="text-xs text-green-400 mt-1">↑ 12% vs yesterday</p>
            </div>
            <div className="bg-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">AI handled</p>
              <p className="text-3xl font-bold text-white">94%</p>
              <p className="text-xs text-green-400 mt-1">↑ Fully automated</p>
            </div>
            <div className="bg-gray-800 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">Avg response time</p>
              <p className="text-3xl font-bold text-white">1.2s</p>
              <p className="text-xs text-green-400 mt-1">↓ Faster than humans</p>
            </div>
            <div className="col-span-full bg-gray-800 rounded-xl p-4">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-sm shrink-0">👤</div>
                <div className="bg-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 max-w-xs">
                  Hi, what are your store hours?
                </div>
              </div>
              <div className="flex items-start gap-3 flex-row-reverse">
                <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-sm shrink-0">🤖</div>
                <div className="bg-green-500/20 border border-green-500/30 rounded-lg px-3 py-2 text-sm text-green-200 max-w-xs text-right">
                  We&apos;re open Mon–Sat 9am–8pm IST, and Sun 10am–6pm. Is there anything else I can help you with? 😊
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-gray-800 py-12">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {stats.map(s => (
            <div key={s.label}>
              <p className="text-4xl font-extrabold text-green-400">{s.value}</p>
              <p className="text-gray-400 text-sm mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <h2 className="text-4xl font-bold mb-4">Everything you need</h2>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            One platform for AI replies, contact management, flows, analytics, and broadcasts.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map(f => (
            <div
              key={f.title}
              className="bg-gray-900 border border-gray-800 hover:border-green-500/40 rounded-xl p-5 transition group"
            >
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="font-semibold text-white mb-2 group-hover:text-green-400 transition">{f.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-gray-900 py-24 border-y border-gray-800">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold mb-4">Up and running in minutes</h2>
          <p className="text-gray-400 text-lg mb-14">No API approvals. No complex setup. Just scan and go.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map(s => (
              <div key={s.n} className="relative">
                <div className="w-12 h-12 rounded-full bg-green-500 text-white font-bold text-xl flex items-center justify-center mx-auto mb-4">
                  {s.n}
                </div>
                <h3 className="font-semibold text-lg mb-2">{s.title}</h3>
                <p className="text-gray-400 text-sm">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-6 py-24 text-center">
        <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20 rounded-2xl p-12">
          <h2 className="text-4xl font-bold mb-4">Ready to automate your WhatsApp?</h2>
          <p className="text-gray-400 text-lg mb-8">
            Self-hosted, private, unlimited. Your data stays on your server.
          </p>
          <Link
            href="/auth/register"
            className="inline-block px-10 py-4 bg-green-500 hover:bg-green-400 text-white font-bold rounded-xl text-lg transition shadow-lg shadow-green-500/20"
          >
            Create your account →
          </Link>
          <p className="text-gray-500 text-sm mt-4">No credit card required</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-green-500 rounded-md flex items-center justify-center text-xs">💬</div>
            <span className="text-gray-400 text-sm">Aimywhatsapp — Self-hosted WhatsApp AI</span>
          </div>
          <div className="flex gap-6 text-sm text-gray-500">
            <Link href="/auth/login" className="hover:text-white transition">Login</Link>
            <Link href="/auth/register" className="hover:text-white transition">Register</Link>
            <Link href="/dashboard" className="hover:text-white transition">Dashboard</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
