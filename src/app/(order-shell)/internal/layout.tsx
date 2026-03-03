export default function InternalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="bg-yellow-100 border-b border-yellow-300 px-4 py-2 text-center text-sm text-yellow-900 font-semibold">
        Internal use only — not for customer distribution
      </div>
      {children}
    </div>
  )
}
