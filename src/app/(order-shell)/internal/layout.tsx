import ManagerSession from '@/components/internal/ManagerSession'
import WorkspaceHost from '@/components/internal/WorkspaceHost'
import NavigationProtection from '@/components/internal/NavigationProtection'
import InternalLanguage from '@/components/internal/InternalLanguage'
import InternalShell from '@/components/internal/InternalShell'
import { ShellTaskProvider } from '@/components/internal/ShellTask'
import { internalThemeClassName } from '@/components/internal/ui/Theme'

export default function InternalLayout({ children }: { children: React.ReactNode }) {
  return <InternalLanguage banner={false}><NavigationProtection><ManagerSession><ShellTaskProvider>
    <InternalShell themeClassName={internalThemeClassName}><WorkspaceHost>{children}</WorkspaceHost></InternalShell>
  </ShellTaskProvider></ManagerSession></NavigationProtection></InternalLanguage>
}
