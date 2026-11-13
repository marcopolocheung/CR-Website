'use client'
import { useState, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { WorkspaceVisibility } from './WorkspaceVisibility'
const Dashboard = dynamic(() => import('./DashboardWorkspace'))
const Bookkeeping = dynamic(() => import('./BookkeepingWorkspace'))
const Inventory = dynamic(() => import('./InventoryWorkspace'))
const Forms = dynamic(() => import('./FormsWorkspace'))
const Reports = dynamic(() => import('./ReportsWorkspace'))
const tools = { reports: Reports, dashboard: Dashboard, bookkeeping: Bookkeeping, inventory: Inventory, forms: Forms }
type Tool = keyof typeof tools
export default function WorkspaceHost({ children }: { children: ReactNode }) {
  const path = usePathname().replace(/\.html$/, '').replace(/\/$/, '')
  const leaf = path.split('/').pop()
  const active: Tool | null = leaf === 'internal' ? 'dashboard' : leaf && leaf in tools ? leaf as Tool : null
  const [visited, setVisited] = useState<Tool[]>(active ? [active] : [])
  if (active && !visited.includes(active)) setVisited([...visited, active])
  return <>{visited.map(tool => {
    const Component = tools[tool]
    return <WorkspaceVisibility.Provider key={tool} value={tool === active}>
      <div hidden={tool !== active} data-internal-workspace={tool} style={tool !== active ? { display: 'none' } : undefined}><Component /></div>
    </WorkspaceVisibility.Provider>
  })}{children}</>
}
