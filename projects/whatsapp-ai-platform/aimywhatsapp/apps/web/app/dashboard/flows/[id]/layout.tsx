// Flow builder needs full-height layout
export default function FlowLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full overflow-hidden">
      {children}
    </div>
  )
}
