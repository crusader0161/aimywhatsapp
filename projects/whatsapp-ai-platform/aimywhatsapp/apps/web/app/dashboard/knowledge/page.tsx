'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useWorkspaceStore } from '@/stores/workspace'
import { Brain, Plus, Upload, Link, FileText, Trash2, RefreshCw, CheckCircle, Clock, XCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const STATUS_ICON: Record<string, any> = {
  PENDING: Clock,
  PROCESSING: RefreshCw,
  INDEXED: CheckCircle,
  FAILED: XCircle,
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'text-gray-400',
  PROCESSING: 'text-blue-500 animate-spin',
  INDEXED: 'text-emerald-500',
  FAILED: 'text-red-500',
}

export default function KnowledgePage() {
  const { currentWorkspace } = useWorkspaceStore()
  const queryClient = useQueryClient()
  const [selectedKbId, setSelectedKbId] = useState<string | null>(null)
  const [showNewKb, setShowNewKb] = useState(false)
  const [newKbName, setNewKbName] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [showFaqForm, setShowFaqForm] = useState(false)
  const [faqQ, setFaqQ] = useState('')
  const [faqA, setFaqA] = useState('')
  const [testQuery, setTestQuery] = useState('')
  const [testResult, setTestResult] = useState<any>(null)

  const { data: kbs } = useQuery({
    queryKey: ['knowledge-bases', currentWorkspace?.id],
    queryFn: () => api.get(`/knowledge-bases?workspaceId=${currentWorkspace!.id}`).then(r => r.data),
    enabled: !!currentWorkspace?.id,
  })

  const { data: kbDetail, isLoading: loadingDetail } = useQuery({
    queryKey: ['knowledge-base', selectedKbId],
    queryFn: () => api.get(`/knowledge-bases/${selectedKbId}`).then(r => r.data),
    enabled: !!selectedKbId,
    refetchInterval: selectedKbId ? 5000 : false,
  })

  const createKbMutation = useMutation({
    mutationFn: () => api.post('/knowledge-bases', { workspaceId: currentWorkspace!.id, name: newKbName, isDefault: !kbs?.length }),
    onSuccess: (res) => {
      setSelectedKbId(res.data.id)
      setNewKbName('')
      setShowNewKb(false)
      queryClient.invalidateQueries({ queryKey: ['knowledge-bases'] })
      toast.success('Knowledge base created')
    },
  })

  const addUrlMutation = useMutation({
    mutationFn: () => api.post(`/knowledge-bases/${selectedKbId}/documents`, { url: urlInput }),
    onSuccess: () => {
      setUrlInput('')
      toast.success('URL added — indexing started')
      queryClient.invalidateQueries({ queryKey: ['knowledge-base', selectedKbId] })
    },
  })

  const deleteDocMutation = useMutation({
    mutationFn: (docId: string) => api.delete(`/knowledge-bases/${selectedKbId}/documents/${docId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['knowledge-base', selectedKbId] }),
  })

  const addFaqMutation = useMutation({
    mutationFn: () => api.post(`/knowledge-bases/${selectedKbId}/faqs`, { question: faqQ, answer: faqA }),
    onSuccess: () => {
      setFaqQ(''); setFaqA(''); setShowFaqForm(false)
      toast.success('FAQ added')
      queryClient.invalidateQueries({ queryKey: ['knowledge-base', selectedKbId] })
    },
  })

  const deleteFaqMutation = useMutation({
    mutationFn: (faqId: string) => api.delete(`/knowledge-bases/${selectedKbId}/faqs/${faqId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['knowledge-base', selectedKbId] }),
  })

  const testKb = async () => {
    if (!testQuery || !selectedKbId) return
    try {
      const res = await api.post(`/knowledge-bases/${selectedKbId}/test`, { query: testQuery })
      setTestResult(res.data)
    } catch { toast.error('Test failed') }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedKbId) return
    const form = new FormData()
    form.append('file', file)
    try {
      await api.post(`/knowledge-bases/${selectedKbId}/documents`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      toast.success('File uploaded — indexing started')
      queryClient.invalidateQueries({ queryKey: ['knowledge-base', selectedKbId] })
    } catch { toast.error('Upload failed') }
    e.target.value = ''
  }

  return (
    <div className="p-6 flex gap-6 h-full">
      {/* Left: KB list */}
      <div className="w-64 flex-shrink-0 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-white text-sm">Knowledge Bases</h2>
          <button
            onClick={() => setShowNewKb(true)}
            className="p-1.5 text-whatsapp hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {showNewKb && (
          <div className="flex gap-2">
            <input
              value={newKbName}
              onChange={e => setNewKbName(e.target.value)}
              placeholder="KB name..."
              className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-whatsapp"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && createKbMutation.mutate()}
            />
            <button onClick={() => createKbMutation.mutate()} className="px-3 py-2 bg-whatsapp text-white rounded-lg text-sm hover:bg-emerald-600">+</button>
          </div>
        )}

        {kbs?.map((kb: any) => (
          <button
            key={kb.id}
            onClick={() => setSelectedKbId(kb.id)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left transition',
              selectedKbId === kb.id
                ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
            )}
          >
            <Brain className="w-4 h-4 flex-shrink-0" />
            <div className="min-w-0">
              <p className="truncate font-medium">{kb.name}</p>
              <p className="text-xs text-gray-400">{kb._count?.documents} docs · {kb._count?.faqs} FAQs</p>
            </div>
            {kb.isDefault && <span className="text-xs bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded flex-shrink-0">Default</span>}
          </button>
        ))}

        {!kbs?.length && !showNewKb && (
          <button
            onClick={() => setShowNewKb(true)}
            className="w-full flex flex-col items-center gap-2 p-5 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-gray-400 hover:border-whatsapp hover:text-whatsapp transition text-sm"
          >
            <Plus className="w-6 h-6" />
            Create your first KB
          </button>
        )}
      </div>

      {/* Right: KB detail */}
      {!selectedKbId ? (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          <div className="text-center">
            <Brain className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>Select or create a knowledge base</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-5">
          {/* Add sources */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4 text-sm">Add Content</h3>
            <div className="grid grid-cols-2 gap-4">
              {/* File upload */}
              <label className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl hover:border-whatsapp hover:bg-emerald-50 dark:hover:bg-emerald-900/10 cursor-pointer transition">
                <Upload className="w-6 h-6 text-gray-400" />
                <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">Upload File</span>
                <span className="text-xs text-gray-400">PDF, DOCX, TXT, CSV</span>
                <input type="file" accept=".pdf,.docx,.txt,.csv" onChange={handleFileUpload} className="hidden" />
              </label>

              {/* URL */}
              <div className="p-4 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <Link className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Website URL</span>
                </div>
                <input
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  placeholder="https://example.com/faq"
                  className="w-full px-3 py-2 text-xs border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-whatsapp mb-2"
                />
                <button
                  onClick={() => addUrlMutation.mutate()}
                  disabled={!urlInput}
                  className="w-full py-1.5 bg-whatsapp text-white rounded-lg text-xs font-medium hover:bg-emerald-600 disabled:opacity-40 transition"
                >
                  Add URL
                </button>
              </div>
            </div>
          </div>

          {/* Documents */}
          {kbDetail?.documents?.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm">Documents ({kbDetail.documents.length})</h3>
              <div className="space-y-2">
                {kbDetail.documents.map((doc: any) => {
                  const StatusIcon = STATUS_ICON[doc.status] || Clock
                  return (
                    <div key={doc.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                      <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{doc.name}</p>
                        <p className="text-xs text-gray-400">{doc.type} · {doc.chunkCount} chunks</p>
                      </div>
                      <StatusIcon className={cn('w-4 h-4 flex-shrink-0', STATUS_COLOR[doc.status])} />
                      <button onClick={() => deleteDocMutation.mutate(doc.id)} className="p-1 text-gray-400 hover:text-red-500 transition">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* FAQs */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">FAQs ({kbDetail?.faqs?.length || 0})</h3>
              <button onClick={() => setShowFaqForm(true)} className="text-xs text-whatsapp hover:underline flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Add FAQ
              </button>
            </div>

            {showFaqForm && (
              <div className="mb-4 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl space-y-3">
                <input value={faqQ} onChange={e => setFaqQ(e.target.value)} placeholder="Question..." className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-whatsapp" />
                <textarea value={faqA} onChange={e => setFaqA(e.target.value)} placeholder="Answer..." rows={3} className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-whatsapp resize-none" />
                <div className="flex gap-2">
                  <button onClick={() => addFaqMutation.mutate()} disabled={!faqQ || !faqA} className="px-4 py-2 bg-whatsapp text-white rounded-lg text-sm font-medium hover:bg-emerald-600 disabled:opacity-40 transition">Save</button>
                  <button onClick={() => setShowFaqForm(false)} className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-lg text-sm hover:bg-gray-200 transition">Cancel</button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {kbDetail?.faqs?.map((faq: any) => (
                <div key={faq.id} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Q: {faq.question}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">A: {faq.answer}</p>
                  </div>
                  <button onClick={() => deleteFaqMutation.mutate(faq.id)} className="p-1 text-gray-400 hover:text-red-500 transition flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Test KB */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm">🧪 Test Knowledge Base</h3>
            <div className="flex gap-3">
              <input
                value={testQuery}
                onChange={e => setTestQuery(e.target.value)}
                placeholder="Ask a question..."
                className="flex-1 px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-whatsapp"
                onKeyDown={e => e.key === 'Enter' && testKb()}
              />
              <button onClick={testKb} className="px-5 py-2.5 bg-whatsapp text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition">Test</button>
            </div>
            {testResult && (
              <div className="mt-4 space-y-3">
                {/* AI Answer */}
                {testResult.aiAnswer ? (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">🤖 AI Answer</span>
                    </div>
                    <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{testResult.aiAnswer}</p>
                  </div>
                ) : testResult.results.length === 0 ? (
                  <p className="text-sm text-gray-400">No relevant content found in KB.</p>
                ) : (
                  <p className="text-sm text-amber-600 dark:text-amber-400">KB matched content but AI response unavailable.</p>
                )}
                {/* Source chunks */}
                {testResult.results.length > 0 && (
                  <details className="group">
                    <summary className="cursor-pointer text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 select-none">
                      📚 {testResult.results.length} source chunk{testResult.results.length !== 1 ? 's' : ''} used
                    </summary>
                    <div className="mt-2 space-y-2">
                      {testResult.results.map((r: any, i: number) => (
                        <div key={i} className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                          <div className="flex justify-between mb-1">
                            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Match #{i + 1}</span>
                            <span className="text-xs text-gray-400">{Math.round(r.score * 100)}% match</span>
                          </div>
                          <p className="text-xs text-gray-700 dark:text-gray-300">{r.content}</p>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
