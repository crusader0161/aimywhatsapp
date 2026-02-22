// Knowledge base needs full-height layout
export default function KnowledgeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full overflow-hidden">
      {children}
    </div>
  )
}
