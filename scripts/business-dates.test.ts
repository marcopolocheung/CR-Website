import test from 'node:test'
import assert from 'node:assert/strict'
import { dateForDay, shiftWeek, weekStartFor } from '../src/lib/scheduler/week'
const date = (instant: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(instant))
test('Central midnight is seasonal rather than a fixed CST offset', () => {
  for (const [input, expected] of [['2026-01-02T05:59:59Z','2026-01-01'],['2026-01-02T06:00:00Z','2026-01-02'],['2026-07-02T04:59:59Z','2026-07-01'],['2026-07-02T05:00:00Z','2026-07-02']]) assert.equal(date(input),expected)
})
test('DST transitions preserve dates; repeated fall clock is two distinct instants', () => {
 for (const input of ['2026-03-08T07:59:59Z','2026-03-08T08:00:00Z']) assert.equal(date(input),'2026-03-08')
 for (const input of ['2026-11-01T06:30:00Z','2026-11-01T07:30:00Z']) assert.equal(date(input),'2026-11-01')
 const clock = (input: string) => new Intl.DateTimeFormat('en-US',{ timeZone:'America/Chicago',hour:'numeric',minute:'2-digit' }).format(new Date(input))
 assert.equal(clock('2026-03-08T07:59:59Z'),'1:59 AM'); assert.equal(clock('2026-03-08T08:00:00Z'),'3:00 AM')
 assert.equal(clock('2026-11-01T06:30:00Z'),clock('2026-11-01T07:30:00Z'))
})
test('existing Sunday weeks and calendar arithmetic remain stable across DST', () => {
 assert.equal(weekStartFor(new Date(2026,9,21)),'2026-10-18')
 assert.equal(dateForDay('2026-10-18','Wednesday'),'2026-10-21')
 assert.equal(shiftWeek('2026-03-01',1),'2026-03-08');assert.equal(shiftWeek('2026-03-08',1),'2026-03-15')
 assert.equal(shiftWeek('2026-10-25',1),'2026-11-01');assert.equal(shiftWeek('2026-11-01',1),'2026-11-08')
})
