import { agentContextSchema } from '../src/lib/scheduler/agent-contracts'
import { DAYS } from '../src/lib/scheduler/types'
import { REQUEST_POLICY, type ScheduleRequest } from '../src/lib/scheduler/requests'

export function fixtureContext() {
  return agentContextSchema.parse({ stationId: 'CR3-diningroom', weekStart: '2026-11-08',
    employees: ['alex', 'blair', 'casey'].map(id => ({ id, name: `Sample ${id}`, roles: ['server'],
      recurringAvailability: Object.fromEntries(DAYS.map(day => [day, [{ start: 540, end: 1380 }]])),
      allowDoubles: true, active: true, maxDaysPerWeek: 7, incompatibleEmployeeIds: [],
    })),
    template: Object.fromEntries(DAYS.map(day => [day, [
      { period: 'AM', role: 'server', label: 'Morning', start: 600, end: 960, required: true },
      { period: 'PM', role: 'server', label: 'Evening', start: 960, end: 1380, required: true },
    ]])), assignments: [], requests: { phase: 'ready', revision: 0, data: null },
  })
}
export function approvedTimeOff(employeeId = 'alex'): ScheduleRequest {
  return { id: 'test-request', employee: { stationId: 'CR3-diningroom', sourceEmployeeId: employeeId, name: 'Sample person' },
    kind: 'time-off', startDate: '2026-11-08', endDate: '2026-11-08', ranges: [], reason: '',
    requestedAt: '2026-11-01T12:00:00.000Z', enteredAt: '2026-11-01T12:00:00.000Z', enteredBy: 'Sample manager',
    policyVersion: REQUEST_POLICY, status: 'approved', review: { by: 'Sample manager', at: '2026-11-01T13:00:00.000Z', reason: '' } }
}
