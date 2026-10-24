import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as XLSX from 'xlsx'
import { salesFixtures, hoursRecords } from '../../../scripts/fixtures/imports'
import { HOURS_COLUMNS, SourceValidationError, readSalesFile, sourceNumber, validateHoursRows, validateSalesWorkbook } from './validation'
import { extractMetrics, toNumber } from './parseToast'
import { buildHoursWorkbook, parseCsvAndExport, parseHoursText, readHoursFile } from './parseCSV'
import { translate } from '../internal-tools/i18n'

const file = (text: string, name = 'hours.csv') => ({ name, size: text.length, text: async () => text })
const csv = (rows: unknown[][]) => rows.map(row => row.map(value => '"' + String(value).replace(/"/g, '""') + '"').join(',')).join('\r\n')
const keys = (issues: { key: string }[]) => issues.map(issue => issue.key)

test('existing sales mapping is preserved, including explicit zeros for absent cards/discounts and blank unused category cells', () => {
  const { general, lunch, dinner } = salesFixtures()
  assert.deepEqual(validateSalesWorkbook(general, 'general'), [])
  assert.deepEqual(validateSalesWorkbook(lunch, 'lunch'), [])
  assert.deepEqual(extractMetrics({ generalWb: general, lunchWb: lunch, dinnerWb: dinner }), {
    C8: 1234.56, C9: 234.56, C10: 0, C11: 0, C12: 0, C13: 1000, C16: 0, C17: 12.34,
    C19: 23.45, C18: 500, C20: 43.19, C22: 50, C21: 600, C23: 53.63,
  })
  general.Sheets['Check Discounts'] = XLSX.utils.aoa_to_sheet([['Discount', 'Amount']])
  assert.deepEqual(validateSalesWorkbook(general, 'general'), [])
})

test('source numbers never coerce blank, partial, ambiguous separators or nonfinite values to zero', () => {
  for (const value of ['', ' ', null, undefined, '12abc', '1,23', '7.5.2', 'NaN', Infinity, true, '(10)', '0x10']) {
    assert.equal(sourceNumber(value), null, String(value))
    assert.throws(() => toNumber(value), SourceValidationError)
  }
  assert.equal(sourceNumber('$1,234.50'), 1234.5)
  assert.equal(sourceNumber('-12.34'), -12.34)
  assert.equal(sourceNumber(0), 0)
  assert.equal(sourceNumber('0'), 0)
})

test('sales rejects missing/wrong/empty sheets, columns, duplicate headers and missing or duplicate metric rows with evidence', () => {
  const books = salesFixtures()
  assert.ok(keys(validateSalesWorkbook(books.lunch, 'general')).includes('importValidation.sheet'))
  books.general.Sheets['Revenue summary'] = XLSX.utils.aoa_to_sheet([['Total']])
  assert.ok(keys(validateSalesWorkbook(books.general, 'general')).includes('importValidation.emptySheet'))
  books.lunch.Sheets['Sales category summary'] = XLSX.utils.aoa_to_sheet([['Sales category', 'Net sales', 'Net sales'], ['FOOD', 0, 0]])
  const issues = validateSalesWorkbook(books.lunch, 'lunch')
  assert.ok(keys(issues).includes('importValidation.column'))
  assert.ok(keys(issues).includes('importValidation.duplicateColumn'))
  books.lunch.Sheets['Sales category summary'] = XLSX.utils.aoa_to_sheet([['Sales category', 'Net sales', 'Tax amount'], ['FOOD', 1, 0], ['FOOD', 2, 0], ['Total', 3, 0]])
  const rowIssues = validateSalesWorkbook(books.lunch, 'lunch')
  assert.ok(keys(rowIssues).includes('importValidation.requiredRow'))
  assert.ok(keys(rowIssues).includes('importValidation.duplicateRow'))
})

test('sales blocks malformed numbers and spreadsheet errors at their actual sheet/cell rows, including direct extraction', () => {
  const { general, lunch, dinner } = salesFixtures()
  general.Sheets['Revenue summary'].A2 = { t: 's', v: '12oops' }
  assert.deepEqual(validateSalesWorkbook(general, 'general')[0], { key: 'importValidation.number', params: { sheet: 'Revenue summary', row: 2, column: 'Total' } })
  assert.throws(() => extractMetrics({ generalWb: general, lunchWb: lunch, dinnerWb: dinner }), SourceValidationError)
  general.Sheets['Revenue summary'].A2 = { t: 'e', v: 0 }
  assert.ok(keys(validateSalesWorkbook(general, 'general')).includes('importValidation.number'))
  general.Sheets['Revenue summary'] = XLSX.utils.aoa_to_sheet([])
  XLSX.utils.sheet_add_aoa(general.Sheets['Revenue summary'], [['Total'], [0]], { origin: 'B4' })
  general.Sheets['Revenue summary']['!ref'] = 'B4:B5'
  assert.deepEqual(validateSalesWorkbook(general, 'general'), [])
})

test('sales file reader rejects empty/unreadable/unsupported files and verifies actual workbook bytes', async () => {
  const bytes = XLSX.write(salesFixtures().general, { type: 'buffer', bookType: 'xlsx' })
  const good = { name: 'general.xlsx', size: bytes.length, arrayBuffer: async () => Uint8Array.from(bytes).buffer }
  assert.ok((await readSalesFile(good, 'general')).value)
  assert.equal((await readSalesFile({ ...good, size: 0 }, 'general')).issues[0].key, 'importValidation.empty')
  assert.equal((await readSalesFile({ ...good, name: 'picture.png' }, 'general')).issues[0].key, 'importValidation.salesType')
  assert.equal((await readSalesFile({ ...good, arrayBuffer: async () => { throw new Error('read denied') } }, 'general')).issues[0].key, 'importValidation.unreadable')
  assert.equal((await readSalesFile({ ...good, arrayBuffer: async () => Uint8Array.from(Buffer.from('garbage')).buffer }, 'general')).value, null)
})

test('hours rejects wrong, empty and header-only reports and identifies missing and duplicate columns', () => {
  assert.equal(parseHoursText('').value, null)
  assert.ok(keys(parseHoursText('date,sales\n2026-10-20,5').issues).includes('importValidation.hoursReport'))
  assert.ok(keys(parseHoursText(csv([hoursRecords[0]])).issues).includes('importValidation.noRows'))
  assert.ok(keys(parseHoursText(csv(hoursRecords.map(row => row.slice(1)))).issues).includes('importValidation.csvColumn'))
  assert.ok(keys(parseHoursText(csv(hoursRecords.map(row => [...row, row[0]]))).issues).includes('importValidation.csvDuplicateColumn'))
})

test('hours reports every missing identity, bad number and unreadable source date without a partial export', () => {
  const records = structuredClone(hoursRecords)
  records[1][0] = ''
  records[2][5] = '12hours'
  records[3][4] = '02/30/2026 17:00'
  const result = parseHoursText(csv(records))
  assert.equal(result.value, null)
  assert.ok(result.issues.some(issue => issue.key === 'importValidation.csvRequired' && issue.params?.row === 2))
  assert.ok(result.issues.some(issue => issue.key === 'importValidation.csvNumber' && issue.params?.row === 3))
  assert.ok(result.issues.some(issue => issue.key === 'importValidation.csvDate' && issue.params?.row === 4))
  assert.equal(records[1][1], 'Original Name B')
})

test('hours handles quoted commas/multiline fields, reordered/extra columns, BOM and CRLF without dropping rows', () => {
  const order = [4, 0, 5, 2, 6, 1, 3, 7]
  const records = hoursRecords.map(row => [...order.map(index => row[index]), 'ignored source extra'])
  records[1][5] = 'Nombre,\noriginal'
  const result = parseHoursText('\ufeff' + csv(records))
  assert.equal(result.issues.length, 0)
  assert.equal(result.value?.length, 3)
  assert.equal(result.value?.[0].Employee, 'Nombre,\noriginal')
  assert.equal(result.value?.[0]['Regular Hours'], '7.50')
  assert.deepEqual(Object.keys(result.value![0]), HOURS_COLUMNS)
})

test('hours flags malformed quotes and column-width problems, including blank-record offsets', () => {
  assert.ok(keys(parseHoursText(csv([hoursRecords[0]]) + '\n"unfinished').issues).includes('importValidation.csv'))
  const result = parseHoursText(csv([hoursRecords[0]]) + '\n\n' + csv([hoursRecords[1].slice(0, 7)]))
  assert.ok(result.issues.some(issue => issue.key === 'importValidation.csvWidth' && issue.params?.row === 3))
})

test('hours workbook preserves grouping, source regular/overtime, English headers, totals, column positions and names', async () => {
  const result = parseHoursText(csv(hoursRecords))
  assert.ok(result.value)
  const wb = buildHoursWorkbook(result.value!)
  const bytes = await wb.xlsx.writeBuffer()
  const reloaded = XLSX.read(bytes, { type: 'buffer' })
  const rows = XLSX.utils.sheet_to_json<unknown[]>(reloaded.Sheets['All Employees'], { header: 1, defval: null })
  assert.deepEqual(rows[0], ['Employee Id', ...HOURS_COLUMNS.slice(1)])
  assert.equal(rows[1][0], 'EMP-B')
  assert.equal(rows[1][3], '10/20/2026 08:00 AM')
  assert.equal(rows[1][5], 9)
  assert.equal(rows[1][6], 8)
  assert.equal(rows[1][7], 1)
  assert.equal(rows[3][3], 'TOTAL')
  assert.equal(rows[3][5], 17)
  assert.equal(rows[3][6], 15.5)
  assert.equal(rows[3][7], 1.5)
  assert.ok(rows.some(row => row[1] === 'Nombre original'))
  assert.equal(rows.at(-1)?.[0], '*** END OF REPORT ***')
  assert.throws(() => buildHoursWorkbook([{ ...result.value![0], 'Regular Hours': 'bad' }]), SourceValidationError)
})

test('arbitrary external IDs stay data, including prototype names, and no ID is dropped', () => {
  const records = structuredClone(hoursRecords)
  records[1][0] = '__proto__'; records[2][0] = 'constructor'
  const result = validateHoursRows(records)
  assert.equal(result.value?.length, 3)
  assert.doesNotThrow(() => buildHoursWorkbook(result.value!))
})

test('file read failure/invalid CSV invokes failure instead of completion; export failure is awaited', async () => {
  let completed = 0
  const errors: unknown[] = []
  await parseCsvAndExport(file('not,a,report\n1,2,3'), () => completed++, (error: unknown) => errors.push(error))
  assert.equal(completed, 0)
  assert.ok(errors[0] instanceof SourceValidationError)
  await parseCsvAndExport(file(csv(hoursRecords)), () => completed++, (error: unknown) => errors.push(error))
  assert.equal(completed, 0) // Node has no DOM: generating the download fails after writeBuffer.
  assert.equal(errors.length, 2)
  assert.equal((await readHoursFile(file('', 'bad.csv'))).value, null)
  assert.equal((await readHoursFile(file(csv(hoursRecords), 'bad.xlsx'))).issues[0].key, 'importValidation.hoursType')
  assert.equal((await readHoursFile({ ...file('x'), text: async () => { throw new Error('denied') } })).issues[0].key, 'importValidation.unreadable')
})

test('source issue keys render in English and Spanish with raw headers and row evidence retained', () => {
  const rows = structuredClone(hoursRecords); rows[1][0] = ''
  for (const issue of validateHoursRows(rows).issues) for (const locale of ['en', 'es'] as const) {
    const message = translate(locale, issue.key, issue.params)
    assert.ok(!message.startsWith('['))
    assert.ok(!/\{\w+\}/.test(message))
    assert.ok(message.includes('Employee External Id'))
    assert.ok(message.includes('2'))
  }
})

test('sales preserves cash-only reports but rejects missing or non-text labels before extraction', () => {
  const { general, lunch } = salesFixtures()
  general.Sheets['Payments summary'] = XLSX.utils.aoa_to_sheet([['Payment type', 'Total'], ['CASH', 0]])
  assert.deepEqual(validateSalesWorkbook(general, 'general'), [])
  general.Sheets['Payments summary'] = XLSX.utils.aoa_to_sheet([['Payment type', 'Total'], ['CASH', 0], ['CREDIT/DEBIT', 10]])
  assert.ok(keys(validateSalesWorkbook(general, 'general')).includes('importValidation.requiredCell'))
  lunch.Sheets['Sales category summary'].A2 = { t: 'n', v: 12 }
  assert.ok(keys(validateSalesWorkbook(lunch, 'lunch')).includes('importValidation.requiredCell'))
})
