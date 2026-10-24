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
const reviewBooks = salesFixtures()
XLSX.utils.sheet_add_aoa(reviewBooks.general.Sheets['Payments summary'], [['Total', '', 1300], ['GIFT CARD', '', 50]], { origin: 'A5' })
reviewBooks.lunch.Sheets['Sales category summary'] = XLSX.utils.aoa_to_sheet([['Sales category', 'Net sales', 'Tax amount'], ['FOOD', 500, 40], ['DRINK', 23.45, 3.19], ['Total', 500, 43.19]])
for (const [slot, wb] of Object.entries(reviewBooks)) fixtures['review-' + slot] = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' })
console.log(JSON.stringify(fixtures))
