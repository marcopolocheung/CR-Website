import NavigationProtection from '@/components/internal/NavigationProtection'
import InternalLanguage from '@/components/internal/InternalLanguage'
import InternalShell from '@/components/internal/InternalShell'
import { ShellTaskProvider } from '@/components/internal/ShellTask'
import { internalThemeClassName } from '@/components/internal/ui/Theme'

export default function InternalLayout({ children }: { children: React.ReactNode }) {
  return <InternalLanguage banner={false}><NavigationProtection><ShellTaskProvider>
    <InternalShell themeClassName={internalThemeClassName}>{children}</InternalShell>
  </ShellTaskProvider></NavigationProtection></InternalLanguage>
}
