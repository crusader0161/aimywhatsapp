'use client'
import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import {
  ReactFlow, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState,
  type Connection, type Edge, type Node,
  Panel, MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { toast } from 'sonner'
import { Save, ArrowLeft, Plus } from 'lucide-react'
import Link from 'next/link'
import { useEffect } from 'react'

// Custom node styles
const nodeStyle = (color: string) => ({
  padding: '10px 16px',
  borderRadius: '10px',
  border: `2px solid ${color}`,
  background: 'white',
  fontSize: 13,
  fontWeight: 600,
  minWidth: 140,
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
})

const NODE_TYPES_CONFIG = [
  { type: 'message', label: '💬 Message', color: '#25D366' },
  { type: 'question', label: '❓ Question', color: '#6366f1' },
  { type: 'ai', label: '🤖 AI Reply', color: '#f59e0b' },
  { type: 'condition', label: '🔀 Condition', color: '#8b5cf6' },
  { type: 'delay', label: '⏱️ Delay', color: '#94a3b8' },
  { type: 'tag', label: '🏷️ Add Label', color: '#06b6d4' },
  { type: 'webhook', label: '🔗 Webhook', color: '#f97316' },
  { type: 'assign', label: '👤 Assign Human', color: '#ec4899' },
  { type: 'end', label: '🏁 End', color: '#64748b' },
]

function FlowNode({ data }: { data: any }) {
  const cfg = NODE_TYPES_CONFIG.find(n => n.type === data.nodeType) || NODE_TYPES_CONFIG[0]
  return (
    <div style={nodeStyle(cfg.color)}>
      <div>{cfg.label}</div>
      {data.label && <div style={{ fontSize: 11, fontWeight: 400, color: '#64748b', marginTop: 4 }}>{data.label}</div>}
    </div>
  )
}

const customNodeTypes = { custom: FlowNode }

export default function FlowBuilderPage({ params }: { params: { id: string } }) {
  const queryClient = useQueryClient()
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [nodeLabel, setNodeLabel] = useState('')
  const [nodeConfig, setNodeConfig] = useState('')

  const { data: flow } = useQuery({
    queryKey: ['flow', params.id],
    queryFn: () => api.get(`/flows/${params.id}`).then(r => r.data),
  })

  useEffect(() => {
    if (flow) {
      setNodes(flow.nodes || [])
      setEdges(flow.edges || [])
    }
  }, [flow])

  const saveMutation = useMutation({
    mutationFn: () => api.put(`/flows/${params.id}`, { nodes, edges }),
    onSuccess: () => toast.success('Flow saved'),
    onError: () => toast.error('Failed to save'),
  })

  const onConnect = useCallback(
    (connection: Connection) => setEdges(eds => addEdge({
      ...connection,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { strokeWidth: 2 },
    }, eds)),
    [setEdges]
  )

  const addNode = (type: string) => {
    const cfg = NODE_TYPES_CONFIG.find(n => n.type === type)!
    const newNode: Node = {
      id: `${type}_${Date.now()}`,
      type: 'custom',
      position: { x: 200 + Math.random() * 200, y: 100 + nodes.length * 100 },
      data: { nodeType: type, label: cfg.label },
    }
    setNodes(nds => [...nds, newNode])
  }

  const onNodeClick = (_: any, node: Node) => {
    setSelectedNode(node)
    setNodeLabel((node.data as any).label || '')
    setNodeConfig(JSON.stringify((node.data as any).config || {}, null, 2))
  }

  const updateSelectedNode = () => {
    if (!selectedNode) return
    setNodes(nds => nds.map(n => n.id === selectedNode.id
      ? { ...n, data: { ...n.data, label: nodeLabel } }
      : n
    ))
    setSelectedNode(null)
  }

  const deleteSelectedNode = () => {
    if (!selectedNode) return
    setNodes(nds => nds.filter(n => n.id !== selectedNode.id))
    setEdges(eds => eds.filter(e => e.source !== selectedNode.id && e.target !== selectedNode.id))
    setSelectedNode(null)
  }

  return (
    <div className="flex h-full">
      {/* Left sidebar: node palette */}
      <div className="w-52 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <Link href="/dashboard/flows" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 mb-3">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">{flow?.name}</p>
        </div>
        <div className="p-3 space-y-1 flex-1 overflow-y-auto">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">Add Node</p>
          {NODE_TYPES_CONFIG.map(cfg => (
            <button
              key={cfg.type}
              onClick={() => addNode(cfg.type)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition"
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
              {cfg.label}
            </button>
          ))}
        </div>
        <div className="p-3 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-whatsapp text-white rounded-xl text-sm font-semibold hover:bg-emerald-600 disabled:opacity-60 transition"
          >
            <Save className="w-4 h-4" />
            {saveMutation.isPending ? 'Saving...' : 'Save Flow'}
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          nodeTypes={customNodeTypes}
          fitView
          defaultEdgeOptions={{ markerEnd: { type: MarkerType.ArrowClosed }, style: { strokeWidth: 2, stroke: '#25D366' } }}
        >
          <Background color="#e5e7eb" gap={20} />
          <Controls />
          <MiniMap nodeColor={() => '#25D366'} maskColor="rgba(0,0,0,0.05)" />
          {nodes.length === 0 && (
            <Panel position="top-center">
              <div className="mt-16 text-center text-gray-400">
                <p className="text-sm">Click a node type on the left to add it to the canvas</p>
                <p className="text-xs mt-1">Drag to move • Connect nodes by dragging from handles</p>
              </div>
            </Panel>
          )}
        </ReactFlow>
      </div>

      {/* Right sidebar: node config */}
      {selectedNode && (
        <div className="w-64 bg-white dark:bg-gray-900 border-l border-gray-100 dark:border-gray-800 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-sm text-gray-900 dark:text-white">
              {NODE_TYPES_CONFIG.find(n => n.type === (selectedNode.data as any).nodeType)?.label || 'Node'}
            </p>
            <button onClick={() => setSelectedNode(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Label / Message</label>
            <textarea
              value={nodeLabel}
              onChange={e => setNodeLabel(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-whatsapp resize-none"
              placeholder="Enter message or label..."
            />
          </div>
          <div className="flex gap-2">
            <button onClick={updateSelectedNode} className="flex-1 py-2 bg-whatsapp text-white rounded-lg text-xs font-medium hover:bg-emerald-600 transition">
              Update
            </button>
            <button onClick={deleteSelectedNode} className="py-2 px-3 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-lg text-xs font-medium hover:bg-red-100 transition">
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
