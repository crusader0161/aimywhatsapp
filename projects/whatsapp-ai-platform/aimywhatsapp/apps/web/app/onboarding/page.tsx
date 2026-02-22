'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useWorkspaceStore } from '@/stores/workspace'
import { useAuthStore } from '@/stores/auth'
import { MessageSquare, Brain, Bot, ArrowRight, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const STEPS = [
  { id: 1, title: 'Connect WhatsApp', desc: 'Link your WhatsApp number to activate the bot', icon: MessageSquare, href: '/dashboard/settings/whatsapp' },
  { id: 2, title: 'Create Knowledge Base', desc: 'Upload documents or FAQs so your bot can answer questions', icon: Brain, href: '/dashboard/knowledge' },
  { id: 3, title: 'Configure Your Bot', desc: 'Set a name, persona, and AI model for your assistant', icon: Bot, href: '/dashboard/settings' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { currentWorkspace } = useWorkspaceStore()
  const [completedSteps, setCompletedSteps] = useState<number[]>([])

  const markDone = (stepId: number) => {
    setCompletedSteps(prev => [...new Set([...prev, stepId])])
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-6">
      <div className="max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-whatsapp rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <MessageSquare className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Welcome, {user?.name?.split(' ')[0]}! 👋
          </h1>
          <p className="text-gray-500 mt-2">Let's get <strong>{currentWorkspace?.name}</strong> set up in 3 steps.</p>
        </div>

        {/* Steps */}
        <div className="space-y-4 mb-8">
          {STEPS.map((step, index) => {
            const done = completedSteps.includes(step.id)
            return (
              <div
                key={step.id}
                className={cn(
                  'bg-white dark:bg-gray-800 rounded-2xl border p-5 transition',
                  done ? 'border-emerald-200 dark:border-emerald-800' : 'border-gray-100 dark:border-gray-700'
                )}
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                    done ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-gray-100 dark:bg-gray-700'
                  )}>
                    {done
                      ? <CheckCircle className="w-5 h-5 text-emerald-600" />
                      : <step.icon className="w-5 h-5 text-gray-400" />
                    }
                  </div>
                  <div className="flex-1">
                    <p className={cn('font-semibold text-sm', done ? 'text-emerald-700 dark:text-emerald-400 line-through' : 'text-gray-900 dark:text-white')}>{step.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{step.desc}</p>
                  </div>
                  {!done && (
                    <button
                      onClick={() => { markDone(step.id); router.push(step.href) }}
                      className="flex items-center gap-1.5 px-4 py-2 bg-whatsapp text-white rounded-lg text-xs font-semibold hover:bg-emerald-600 transition"
                    >
                      Start <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <button
          onClick={() => router.push('/dashboard')}
          className="w-full py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition"
        >
          Skip for now → Go to Dashboard
        </button>
      </div>
    </div>
  )
}
