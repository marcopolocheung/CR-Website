import assert from 'node:assert/strict'
import test from 'node:test'
import {
  copyWeekForward,
  migrateV1Weeks,
  monthKeyForWeek,
  monthLabel,
  setWeekAssignments,
  setWeekStatus,
  shiftMonth,
  visibleWeeks,
  weeksForMonth,
} from './week-visibility'

test('off weeks are hidden from the visible list', () => {
  let state = setWeekAssignments({}, '2026-09-13', [{ slotId: 'a', employeeId: 'mary' }])
  state = setWeekStatus(state, '2026-09-13', 'on')
  state = setWeekAssignments(state, '2026-09-20', [{ slotId: 'a', employeeId: 'pam' }])
  state = setWeekStatus(state, '2026-09-20', 'off')
  assert.deepEqual(visibleWeeks(state), ['2026-09-13'])
})

test('toggling status keeps assignments intact', () => {
  let state = setWeekAssignments({}, '2026-09-13', [{ slotId: 'a', employeeId: 'mary' }])
  state = setWeekStatus(state, '2026-09-13', 'off')
  assert.equal(state['2026-09-13'].assignments.length, 1)
  state = setWeekStatus(state, '2026-09-13', 'on')
  assert.equal(state['2026-09-13'].status, 'on')
})

test('copying a week duplicates assignments without aliasing', () => {
  let state = setWeekAssignments({}, '2026-09-13', [{ slotId: 'a', employeeId: 'mary' }])
  state = copyWeekForward(state, '2026-09-13', '2026-09-20')
  state['2026-09-13'].assignments[0].employeeId = 'changed'
  assert.equal(state['2026-09-20'].assignments[0].employeeId, 'mary')
})

test('month helpers cover partial edge weeks', () => {
  const weeks = weeksForMonth('2026-09')
  assert.ok(weeks.includes('2026-08-30'))
  assert.ok(weeks.includes('2026-09-27'))
  assert.equal(monthKeyForWeek('2026-09-13'), '2026-09')
  assert.equal(shiftMonth('2026-09', 1), '2026-10')
  assert.equal(shiftMonth('2026-01', -1), '2025-12')
  assert.equal(monthLabel('2026-09'), 'September 2026')
})

test('v1 migration turns filled weeks on and keeps generated snapshots', () => {
  const state = migrateV1Weeks(
    { '2026-09-13': [{ slotId: 'a', employeeId: 'mary' }], '2026-09-20': [] },
    { '2026-09-13': [{ slotId: 'a', employeeId: 'mary' }] },
  )
  assert.equal(state['2026-09-13'].status, 'on')
  assert.equal(state['2026-09-13'].generated.length, 1)
  assert.equal(state['2026-09-20'].status, 'off')
})
