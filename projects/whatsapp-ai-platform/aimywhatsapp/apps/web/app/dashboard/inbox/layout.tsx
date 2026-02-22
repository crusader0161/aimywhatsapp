// Inbox needs full-height layout without padding overflow
export default function InboxLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full overflow-hidden">
      {children}
    </div>
  )
}
