'use client'
import { useState, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { isRestaurantId, type RestaurantId } from '@/data/restaurants'
import { WorkspaceVisibility } from './WorkspaceVisibility'
import { SchedulerAccess, SchedulerStationPicker } from './SchedulerAccess'
const Dashboard = dynamic(() => import('./DashboardWorkspace'))
const Bookkeeping = dynamic(() => import('./BookkeepingWorkspace'))
const Inventory = dynamic(() => import('./InventoryWorkspace'))
const Forms = dynamic(() => import('./FormsWorkspace'))
const Files = dynamic(() => import('./FilesWorkspace'))
const Reports = dynamic(() => import('./ReportsWorkspace'))
const CashHistory = dynamic(() => import('./CashHistory'))
const ImportHistory = dynamic(() => import('./ImportHistoryWorkspace'))
const Scheduler = dynamic(() => import('../scheduler/SchedulerDemo'))
const tools = { 'import-history': ImportHistory, 'cash-history': CashHistory, reports: Reports, dashboard: Dashboard, bookkeeping: Bookkeeping, inventory: Inventory, forms: Forms, files: Files }
type Tool = keyof typeof tools
export default function WorkspaceHost({ children }: { children: ReactNode }) {
  const path = usePathname().replace(/\/$/, '').replace(/\.html$/, '')
  const leaf = path.split('/').pop()
  const scheduling = /(?:^|\/)scheduler-demo(?:\/[^/]+)?$/.test(path)
  const station = scheduling && isRestaurantId(leaf) ? leaf : null
  const active: Tool | null = scheduling ? null : leaf === 'internal' ? 'dashboard' : leaf && leaf in tools ? leaf as Tool : null
  const [visited, setVisited] = useState<Tool[]>(active ? [active] : [])
  const [stations, setStations] = useState<RestaurantId[]>(station ? [station] : [])
  if (active && !visited.includes(active)) setVisited([...visited, active])
  if (station && !stations.includes(station)) setStations([...stations, station])
  return <>
    {scheduling && <SchedulerAccess />}
    {path.endsWith('/scheduler-demo') && <SchedulerStationPicker />}
    {visited.map(tool => {
      const Component = tools[tool]
      return <WorkspaceVisibility.Provider key={tool} value={tool === active}>
        <div hidden={tool !== active} inert={tool !== active} data-internal-workspace={tool} style={tool !== active ? { display: 'none' } : undefined}><Component /></div>
      </WorkspaceVisibility.Provider>
    })}
    {stations.map(id => <WorkspaceVisibility.Provider key={id} value={id === station}>
      <div hidden={id !== station} inert={id !== station} data-internal-workspace={`schedule-${id}`} style={id !== station ? { display: 'none' } : undefined}>
        <Scheduler restaurantId={id} />
      </div>
    </WorkspaceVisibility.Provider>)}
    {children}
  </>
}
