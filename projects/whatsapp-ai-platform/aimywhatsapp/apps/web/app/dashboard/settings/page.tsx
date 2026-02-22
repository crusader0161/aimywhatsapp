'use client'
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useWorkspaceStore } from '@/stores/workspace'
import { toast } from 'sonner'
import { Bot, Sliders, Clock, MessageSquare, Save } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

const AI_MODELS = [
  { value: 'claude-sonnet-4-5-20250514', label: 'Claude Sonnet 4.6 (Recommended)', provider: 'anthropic' },
  { value: 'claude-3-5-haiku-20241022', label: 'Claude Haiku 3.5 (Fast)', provider: 'anthropic' },
  { value: 'gpt-4o', label: 'GPT-4o', provider: 'openai' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Fast)', provider: 'openai' },
]

export default function SettingsPage() {
  const { currentWorkspace } = useWorkspaceStore()
  const queryClient = useQueryClient()

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings', currentWorkspace?.id],
    queryFn: () => api.get(`/settings?workspaceId=${currentWorkspace!.id}`).then(r => r.data),
    enabled: !!currentWorkspace?.id,
  })

  const [form, setForm] = useState({
    botName: 'Aimy',
    botPersona: '',
    aiModel: 'claude-sonnet-4-5-20250514',
    aiTemperature: 0.7,
    confidenceThreshold: 0.6,
    defaultLanguage: 'auto',
    welcomeMessage: '',
    awayMessage: '',
    humanEscalationMessage: '',
    maxConversationHistory: 20,
    businessHoursEnabled: false,
  })

  useEffect(() => {
    if (settings) {
      setForm({
        botName: settings.botName || 'Aimy',
        botPersona: settings.botPersona || '',
        aiModel: settings.aiModel || 'claude-sonnet-4-5-20250514',
        aiTemperature: settings.aiTemperature ?? 0.7,
        confidenceThreshold: settings.confidenceThreshold ?? 0.6,
        defaultLanguage: settings.defaultLanguage || 'auto',
        welcomeMessage: settings.welcomeMessage || '',
        awayMessage: settings.awayMessage || '',
        humanEscalationMessage: settings.humanEscalationMessage || '',
        maxConversationHistory: settings.maxConversationHistory || 20,
        businessHoursEnabled: settings.businessHoursEnabled || false,
      })
    }
  }, [settings])

  const saveMutation = useMutation({
    mutationFn: () => api.patch(`/settings?workspaceId=${currentWorkspace!.id}`, form),
    onSuccess: () => { toast.success('Settings saved'); queryClient.invalidateQueries({ queryKey: ['settings'] }) },
    onError: () => toast.error('Failed to save settings'),
  })

  const settingsSections = [
    {
      id: 'whatsapp',
      label: 'WhatsApp Connection',
      icon: MessageSquare,
      href: '/dashboard/settings/whatsapp',
      description: 'Connect and manage your WhatsApp numbers',
    },
  ]

  if (isLoading) return <div className="p-6 text-gray-400 text-sm">Loading settings...</div>

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">

      {/* Quick links */}
      <div className="grid grid-cols-1 gap-3">
        {settingsSections.map(s => (
          <Link key={s.id} href={s.href} className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-whatsapp transition group">
            <div className="w-9 h-9 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center group-hover:bg-emerald-100 transition">
              <s.icon className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-sm text-gray-900 dark:text-white">{s.label}</p>
              <p className="text-xs text-gray-400">{s.description}</p>
            </div>
            <span className="ml-auto text-gray-400 group-hover:text-whatsapp text-lg">→</span>
          </Link>
        ))}
      </div>

      {/* Bot settings */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6 space-y-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg flex items-center justify-center">
            <Bot className="w-4 h-4 text-emerald-600" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Bot Identity</h3>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Bot Name</label>
            <input
              value={form.botName}
              onChange={e => setForm(f => ({ ...f, botName: e.target.value }))}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-whatsapp"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Default Language</label>
            <select
              value={form.defaultLanguage}
              onChange={e => setForm(f => ({ ...f, defaultLanguage: e.target.value }))}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-whatsapp"
            >
              <option value="auto">Auto-detect</option>
              <option value="en">English</option>
              <option value="hi">Hindi</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="ar">Arabic</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
            Bot Persona / Instructions
          </label>
          <textarea
            value={form.botPersona}
            onChange={e => setForm(f => ({ ...f, botPersona: e.target.value }))}
            rows={4}
            placeholder="e.g. You are a friendly customer support assistant for XYZ brand. You help customers with orders, returns, and product questions. Always be polite and professional."
            className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-whatsapp resize-none"
          />
        </div>
      </div>

      {/* AI Model */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6 space-y-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 bg-purple-50 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
            <Sliders className="w-4 h-4 text-purple-600" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white">AI Model Settings</h3>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">AI Model</label>
          <select
            value={form.aiModel}
            onChange={e => setForm(f => ({ ...f, aiModel: e.target.value }))}
            className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-whatsapp"
          >
            {AI_MODELS.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              Temperature: {form.aiTemperature}
              <span className="text-gray-400 ml-1 font-normal">(0 = precise, 1 = creative)</span>
            </label>
            <input
              type="range" min="0" max="1" step="0.1"
              value={form.aiTemperature}
              onChange={e => setForm(f => ({ ...f, aiTemperature: Number(e.target.value) }))}
              className="w-full accent-whatsapp"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              Confidence Threshold: {form.confidenceThreshold}
              <span className="text-gray-400 ml-1 font-normal">(below = escalate)</span>
            </label>
            <input
              type="range" min="0" max="1" step="0.05"
              value={form.confidenceThreshold}
              onChange={e => setForm(f => ({ ...f, confidenceThreshold: Number(e.target.value) }))}
              className="w-full accent-whatsapp"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Conversation History (messages)</label>
          <input
            type="number" min={5} max={100}
            value={form.maxConversationHistory}
            onChange={e => setForm(f => ({ ...f, maxConversationHistory: Number(e.target.value) }))}
            className="w-32 px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-whatsapp"
          />
        </div>
      </div>

      {/* Messages */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-blue-600" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Automated Messages</h3>
        </div>

        {[
          { key: 'welcomeMessage', label: 'Welcome Message', placeholder: 'Sent to first-time contacts. Leave blank to disable.' },
          { key: 'awayMessage', label: 'Away Message', placeholder: "Sent outside business hours. e.g. 'We're offline right now...'" },
          { key: 'humanEscalationMessage', label: 'Escalation Message', placeholder: "e.g. 'Connecting you with a human agent...'" },
        ].map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">{label}</label>
            <input
              value={(form as any)[key]}
              onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              placeholder={placeholder}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-whatsapp"
            />
          </div>
        ))}
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="flex items-center gap-2 px-6 py-2.5 bg-whatsapp text-white rounded-xl font-semibold text-sm hover:bg-emerald-600 disabled:opacity-60 transition"
        >
          <Save className="w-4 h-4" />
          {saveMutation.isPending ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}
