import test from 'node:test'
import assert from 'node:assert/strict'
import { REQUEST_POLICY, validRequest, validRequestData, requestTransitionIssue, requestsOverlap, type ScheduleRequest, type RequestData } from './requests'

export const exampleRequest = (patch: Partial<ScheduleRequest> = {}): ScheduleRequest => ({
  id: 'request-one', employee: { stationId: 'CR3-diningroom', sourceEmployeeId: 'legacy-person', name: 'Sample Person' },
  kind: 'time-off', startDate: '2026-10-31', endDate: '2026-11-01', ranges: [], reason: 'Original reason / motivo',
  requestedAt: '2026-10-24T12:00:00.000Z', enteredAt: '2026-10-24T13:00:00.000Z', enteredBy: 'Sample Manager',
  policyVersion: REQUEST_POLICY, status: 'pending', review: null, ...patch,
})
export const exampleData = (requests = [exampleRequest()]): RequestData => ({ version: 1, stationId: 'CR3-diningroom', requests })
test('requests validate calendar boundaries, station-scoped identity and explicit provenance', () => {
  assert.ok(validRequest(exampleRequest(), 'CR3-diningroom'))
  for (const patch of [{ startDate: '2026-02-30' }, { endDate: '2026-10-30' }, { endDate: '2028-01-01' },
    { policyVersion: 'unknown' }, { enteredBy: '' }, { requestedAt: '2026-10-25T12:00:00.000Z' }, { review: { by: 'Other', at: '2026-10-25T12:00:00.000Z', reason: '' } }]) {
    assert.equal(validRequest({ ...exampleRequest(), ...patch }, 'CR3-diningroom'), false)
  }
  assert.equal(validRequest(exampleRequest(), 'CR2-diningroom'), false)
  assert.equal(validRequest({ ...exampleRequest(), token: 'never-store' }, 'CR3-diningroom'), false)
})
test('temporary ranges support overnight starts, reject invalid or overlapping ranges, and leave inputs unchanged', () => {
  const original = exampleRequest({ kind: 'availability', ranges: [{ start: 1380, end: 1560 }] })
  const snapshot = JSON.stringify(original)
  assert.ok(validRequest(original, 'CR3-diningroom'))
  for (const ranges of [[], [{ start: 5, end: 5 }], [{ start: 1440, end: 1500 }], [{ start: 0, end: 2880 }],
    [{ start: 600, end: 900 }, { start: 800, end: 1000 }], [{ start: 1.5, end: 10 }]]) {
    assert.equal(validRequest({ ...original, ranges }, 'CR3-diningroom'), false)
  }
  assert.equal(JSON.stringify(original), snapshot)
})
test('pending overlaps are retained; approved overlaps require an explicit nonoverlapping choice', () => {
  const first = exampleRequest(), second = exampleRequest({ id: 'request-two', kind: 'availability', ranges: [{ start: 600, end: 900 }] })
  assert.ok(requestsOverlap(first, second))
  assert.ok(validRequestData(exampleData([first, second]), 'CR3-diningroom'))
  const approve = (request: ScheduleRequest): ScheduleRequest => ({ ...request, status: 'approved', review: { by: 'Reviewer', at: '2026-10-25T12:00:00.000Z', reason: '' } })
  assert.equal(validRequestData(exampleData([approve(first), approve(second)]), 'CR3-diningroom'), false)
  assert.ok(validRequestData(exampleData([approve(first), approve({ ...second, employee: { ...second.employee, sourceEmployeeId: 'other-person' } })]), 'CR3-diningroom'))
  assert.ok(validRequestData(exampleData([approve(first), approve({ ...second, startDate: '2026-11-02', endDate: '2026-11-02' })]), 'CR3-diningroom'))
})
test('append and final review preserve originals, entered labels, ordering and prior decisions', () => {
  const original = exampleData()
  assert.equal(requestTransitionIssue(null, original, 'Sample Manager'), null)
  assert.equal(requestTransitionIssue(null, original, 'Other Manager'), 'entry_provenance_required')
  const reviewed = exampleData([exampleRequest({ status: 'declined', review: { by: 'Reviewer', at: '2026-10-25T12:00:00.000Z', reason: 'Original decision' } })])
  assert.equal(requestTransitionIssue(original, reviewed, 'Reviewer'), null)
  assert.equal(requestTransitionIssue(original, exampleData([{ ...reviewed.requests[0], reason: 'Rewrite' }]), 'Reviewer'), 'preserve_original_request')
  assert.equal(requestTransitionIssue(reviewed, original, 'Reviewer'), 'review_provenance_required')
  assert.equal(requestTransitionIssue(original, exampleData([]), 'Reviewer'), 'preserve_original_request')
})
