import NavigationProtection from '@/components/internal/NavigationProtection'
import InternalLanguage from '@/components/internal/InternalLanguage'

export default function InternalLayout({ children }: { children: React.ReactNode }) {
  return <InternalLanguage><NavigationProtection>{children}</NavigationProtection></InternalLanguage>
}
