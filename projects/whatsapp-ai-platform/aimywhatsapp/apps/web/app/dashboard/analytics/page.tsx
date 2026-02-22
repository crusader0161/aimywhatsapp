'use client'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useWorkspaceStore } from '@/stores/workspace'
import { useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { MessageSquare, Users, Bot, TrendingUp, ArrowUp, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const PERIODS = [
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
]

const SENTIMENT_COLORS = {
  positive: '#25D366',
  neutral: '#94a3b8',
  negative: '#f87171',
}

export default function AnalyticsPage() {
  const { currentWorkspace } = useWorkspaceStore()
  const [days, setDays] = useState(30)

  const { data: overview } = useQuery({
    queryKey: ['analytics', 'overview', currentWorkspace?.id, days],
    queryFn: () => api.get(`/analytics/overview?workspaceId=${currentWorkspace!.id}&days=${days}`).then(r => r.data),
    enabled: !!currentWorkspace?.id,
  })

  const { data: msgVolume } = useQuery({
    queryKey: ['analytics', 'messages', currentWorkspace?.id, days],
    queryFn: () => api.get(`/analytics/messages?workspaceId=${currentWorkspace!.id}&days=${days}`).then(r => r.data),
    enabled: !!currentWorkspace?.id,
  })

  const { data: contactGrowth } = useQuery({
    queryKey: ['analytics', 'contacts', currentWorkspace?.id, days],
    queryFn: () => api.get(`/analytics/contacts?workspaceId=${currentWorkspace!.id}&days=${days}`).then(r => r.data),
    enabled: !!currentWorkspace?.id,
  })

  const { data: sentiment } = useQuery({
    queryKey: ['analytics', 'sentiment', currentWorkspace?.id, days],
    queryFn: () => api.get(`/analytics/sentiment?workspaceId=${currentWorkspace!.id}&days=${days}`).then(r => r.data),
    enabled: !!currentWorkspace?.id,
  })

  const { data: botPerf } = useQuery({
    queryKey: ['analytics', 'bot-performance', currentWorkspace?.id, days],
    queryFn: () => api.get(`/analytics/bot-performance?workspaceId=${currentWorkspace!.id}&days=${days}`).then(r => r.data),
    enabled: !!currentWorkspace?.id,
  })

  const sentimentData = sentiment ? [
    { name: 'Positive', value: sentiment.positive, color: SENTIMENT_COLORS.positive },
    { name: 'Neutral', value: sentiment.neutral, color: SENTIMENT_COLORS.neutral },
    { name: 'Negative', value: sentiment.negative, color: SENTIMENT_COLORS.negative },
  ] : []

  const metricCards = [
    { label: 'Total Messages', value: overview?.totalMessages ?? 0, icon: MessageSquare, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { label: 'New Contacts', value: overview?.totalContacts ?? 0, icon: Users, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' },
    { label: 'Bot Replies', value: overview?.botMessages ?? 0, icon: Bot, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { label: 'Resolution Rate', value: `${overview?.botResolutionRate ?? 0}%`, icon: TrendingUp, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20' },
  ]

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header + Period selector */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Analytics</h1>
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setDays(p.value)}
              className={cn(
                'px-4 py-1.5 text-sm rounded-md font-medium transition',
                days === p.value
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map(card => (
          <div key={card.label} className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{card.label}</span>
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', card.bg)}>
                <card.icon className={cn('w-4 h-4', card.color)} />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Bot performance row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Bot Replies Sent', value: botPerf?.totalBotReplies ?? 0, color: 'text-emerald-600' },
          { label: 'Avg. Confidence', value: `${Math.round((botPerf?.avgConfidence ?? 0) * 100)}%`, color: 'text-blue-600' },
          { label: 'Escalations to Human', value: botPerf?.escalations ?? 0, color: 'text-amber-600' },
        ].map(item => (
          <div key={item.label} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 text-center">
            <p className={cn('text-2xl font-bold', item.color)}>{item.value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{item.label}</p>
          </div>
        ))}
      </div>

      {/* Message Volume Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
        <h2 className="font-semibold text-gray-900 dark:text-white text-sm mb-4">Message Volume</h2>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={msgVolume || []} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <defs>
              <linearGradient id="inboundGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#25D366" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#25D366" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="outboundGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={v => new Date(v).toLocaleDateString([], { month: 'short', day: 'numeric' })} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              labelFormatter={v => new Date(v).toLocaleDateString()}
              contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: 12 }}
            />
            <Legend />
            <Area type="monotone" dataKey="inbound" name="Inbound" stroke="#25D366" fill="url(#inboundGrad)" strokeWidth={2} />
            <Area type="monotone" dataKey="outbound" name="Outbound" stroke="#6366f1" fill="url(#outboundGrad)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Contact growth + Sentiment row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Contact Growth */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white text-sm mb-4">New Contacts</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={contactGrowth || []} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => new Date(v).toLocaleDateString([], { month: 'short', day: 'numeric' })} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ borderRadius: '8px', fontSize: 12 }} />
              <Bar dataKey="new_contacts" name="New Contacts" fill="#25D366" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Sentiment */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
          <h2 className="font-semibold text-gray-900 dark:text-white text-sm mb-4">Message Sentiment</h2>
          {sentimentData.every(d => d.value === 0) ? (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Not enough data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={sentimentData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                  {sentimentData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '8px', fontSize: 12 }} />
                <Legend formatter={v => <span className="text-xs text-gray-600 dark:text-gray-400">{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
