// Prints synthetic browser fixture bytes. Run from repository root with node + jiti.
import * as XLSX from 'xlsx'
const csv = (rows: unknown[][]) => rows.map(row => row.map(value => '"' + String(value).replace(/"/g, '""') + '"').join(',')).join('\r\n')
import { salesFixtures, hoursRecords } from './fixtures/imports'
const books = salesFixtures()
const bad = salesFixtures().general
bad.Sheets['Revenue summary'].A2 = { t: 's', v: '12oops' }
const fixtures: Record<string, string> = {}
for (const [name, wb] of Object.entries({ ...books, bad })) fixtures[name] = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' })
fixtures.hours = Buffer.from(csv(hoursRecords)).toString('base64')
const badRows = hoursRecords.map(row => [...row])
badRows[1][0] = ''
badRows[2][5] = '7hours'
fixtures.badHours = Buffer.from(csv(badRows)).toString('base64')
console.log(JSON.stringify(fixtures))
