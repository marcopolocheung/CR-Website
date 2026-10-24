import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import * as XLSX from 'xlsx'
import ExcelJS from 'exceljs'
import { salesFixtures } from '../../../scripts/fixtures/imports'
import { reviewSales, type SalesSources, type SalesForm } from './sales-review'
import { createFilledWorkbook } from './fillTemplate'
import { SourceValidationError } from './validation'
import { translate } from '../internal-tools/i18n'

const form: SalesForm = { firstName: 'Original', lastName: 'Preparer', day: 'TUE', date: '2026-10-20', location: 'CHINA ROSE #3 - 7046 W MILITARY DR', amDeposit: '0', pmDeposit: '234.56', amOverShort: '', pmOverShort: '-1.23' }
function sources(): SalesSources {
  const fixtures = salesFixtures()
  return Object.fromEntries(Object.entries(fixtures).map(([slot, workbook]) => [slot, { workbook, name: slot + '-original.xlsx' }])) as SalesSources
}
function matchingSources() {
  const source = sources()
  source.lunch.workbook.Sheets['Sales category summary'] = XLSX.utils.aoa_to_sheet([['Sales category', 'Net sales', 'Tax amount'], ['FOOD', 500, 40], ['DRINK', 23.45, 3.19], ['Total', 523.45, 43.19]])
  XLSX.utils.sheet_add_aoa(source.general.workbook.Sheets['Payments summary'], [['Total', '', 1234.56]], { origin: 'A5' })
  return source
}

test('all 14 mapped source figures and four manual amounts have traceable original evidence', () => {
  const review = reviewSales(sources(), form)
  assert.equal(review.figures.length, 18)
  assert.equal(new Set(review.figures.map(figure => figure.cell)).size, 18)
  const revenue = review.figures.find(figure => figure.cell === 'C8')!
  assert.equal(revenue.filename, 'general-original.xlsx')
  assert.equal(revenue.sheet, 'Revenue summary')
  assert.equal(revenue.row, 2)
  assert.equal(revenue.column, 'Total')
  assert.equal(revenue.raw, 1234.56)
  assert.equal(revenue.value, 1234.56)
  const food = review.figures.find(figure => figure.cell === 'C18')!
  assert.equal(food.slot, 'lunch')
  assert.equal(food.row, 3)
  const absentCard = review.figures.find(figure => figure.cell === 'C10')!
  assert.equal(absentCard.absent, true)
  assert.equal(absentCard.raw, null)
  assert.equal(absentCard.value, 0)
  const zero = review.figures.find(figure => figure.cell === 'C4')!
  const blank = review.figures.find(figure => figure.cell === 'C6')!
  assert.equal(zero.value, 0); assert.equal(zero.absent, false)
  assert.equal(blank.value, null); assert.equal(blank.absent, true)
})

test('same-report arithmetic compares complete source detail and shows inconsistent sales, tax and payments', () => {
  const source = matchingSources()
  let review = reviewSales(source, form)
  for (const id of ['lunch-sales', 'lunch-tax', 'dinner-sales', 'dinner-tax', 'payments']) {
    const check = review.checks.find(check => check.id === id)!
    assert.equal(check.state, 'match', id)
    assert.equal(check.difference, 0, id)
  }
  source.lunch.workbook.Sheets['Sales category summary'].B4.v = 500
  source.lunch.workbook.Sheets['Sales category summary'].C4.v = 42
  source.general.workbook.Sheets['Payments summary'].C5.v = 1200
  review = reviewSales(source, form)
  assert.equal(review.checks.find(check => check.id === 'lunch-sales')?.difference, -23.45)
  assert.equal(review.checks.find(check => check.id === 'lunch-tax')?.difference, -1.19)
  assert.equal(review.checks.find(check => check.id === 'payments')?.difference, -34.56)
  assert.equal(review.checks.filter(check => check.state === 'different').length, 3)
})

test('missing totals/detail never become confirmed zero and cross-report comparisons never imply matching scope', () => {
  const review = reviewSales(sources(), { ...form, amDeposit: '' })
  assert.equal(review.checks.find(check => check.id === 'lunch-sales')?.state, 'missing')
  assert.equal(review.checks.find(check => check.id === 'lunch-tax')?.state, 'missing')
  assert.equal(review.checks.find(check => check.id === 'payments')?.left, null)
  assert.equal(review.checks.find(check => check.id === 'cash-deposits')?.state, 'missing')
  assert.equal(review.checks.find(check => check.id === 'revenue-payments')?.difference, 0)
  assert.equal(review.checks.find(check => check.id === 'revenue-payments')?.state, 'review')
  const matchedDeposit = reviewSales(sources(), form).checks.find(check => check.id === 'cash-deposits')!
  assert.equal(matchedDeposit.state, 'review')
  assert.equal(matchedDeposit.difference, 0)
})

test('payment rows outside the legacy mapping remain visible and do not silently change output', () => {
  const source = matchingSources()
  XLSX.utils.sheet_add_aoa(source.general.workbook.Sheets['Payments summary'], [['GIFT CARD', '', 50]], { origin: 'A6' })
  const review = reviewSales(source, form)
  assert.deepEqual(review.unmapped, [{ row: 6, type: 'GIFT CARD', subtype: '', value: 50 }])
  assert.equal(review.metrics.C9, 234.56)
  assert.equal(review.metrics.C13, 1000)
  assert.equal(review.figures.filter(figure => figure.slot === 'general' && figure.sheet === 'Payments summary').reduce((sum, figure) => sum + figure.value!, 0), 1234.56)
})

test('arithmetic includes extra sales categories even though the established workbook maps FOOD/DRINK only', () => {
  const source = matchingSources()
  XLSX.utils.sheet_add_aoa(source.lunch.workbook.Sheets['Sales category summary'], [['OTHER', 10, 1]], { origin: 'A5' })
  const review = reviewSales(source, form)
  assert.equal(review.checks.find(check => check.id === 'lunch-sales')?.difference, -10)
  assert.equal(review.checks.find(check => check.id === 'lunch-tax')?.difference, -1)
  assert.equal(review.metrics.C18, 500)
  assert.deepEqual(review.unmappedCategories, [{ slot: 'lunch', row: 5, category: 'OTHER', net: 10, tax: 1 }])
})

test('fractional cents and unsafe sums are not rounded into a successful reconciliation', () => {
  const source = matchingSources()
  source.lunch.workbook.Sheets['Sales category summary'].B2.v = 500.001
  const review = reviewSales(source, form)
  assert.equal(review.checks.find(check => check.id === 'lunch-sales')?.state, 'missing')
  assert.equal(review.metrics.C18, 500.001)
})

test('review retains its selected context and primitive figures independently of later input changes', () => {
  const input = { ...form, pmDeposit: '$234.56' }
  const source = sources()
  const review = reviewSales(source, input)
  input.location = 'changed'; input.pmDeposit = '999'
  source.general.name = 'changed.xlsx'
  source.general.workbook.Sheets['Revenue summary'].A2.v = 999
  assert.equal(review.form.location, form.location)
  assert.equal(review.form.pmDeposit, '234.56')
  assert.equal(review.sources[0].filename, 'general-original.xlsx')
  assert.equal(review.figures[0].value, 1234.56)
  assert.equal(review.metrics.C8, 1234.56)
  assert.throws(() => reviewSales(sources(), { ...form, amDeposit: '12oops' }), SourceValidationError)
})

test('generated workbook matches known existing cells and preserves template sheets, formulas, styles and print setup', async () => {
  const review = reviewSales(sources(), form)
  const templateBytes = await readFile('public/internal/daily-sales-template.xlsx')
  const before = new ExcelJS.Workbook()
  await before.xlsx.load(Uint8Array.from(templateBytes).buffer)
  const after = await createFilledWorkbook(review.metrics, review.form, templateBytes)
  assert.deepEqual(after.worksheets.map(sheet => sheet.name), before.worksheets.map(sheet => sheet.name))
  const expected: Record<string, unknown> = {
    B1: 'Original Preparer', B2: 'TUE', B3: '2026-10-20', D1: form.location,
    C4: 0, C5: 234.56, C6: null, C7: -1.23,
    C8: 1234.56, C9: 234.56, C10: 0, C11: 0, C12: 0, C13: 1000, C16: 0, C17: 12.34,
    C18: 500, C19: 23.45, C20: 43.19, C21: 600, C22: 50, C23: 53.63,
  }
  for (const [cell, value] of Object.entries(expected)) assert.deepEqual(after.getWorksheet('DATAINPUT')!.getCell(cell).value, value, cell)
  for (const sheet of before.worksheets) {
    const result = after.getWorksheet(sheet.name)!
    assert.deepEqual(result.pageSetup, sheet.pageSetup)
    sheet.eachRow({ includeEmpty: true }, row => row.eachCell({ includeEmpty: true }, cell => {
      const produced = result.getCell(cell.address)
      assert.deepEqual(produced.style, cell.style, sheet.name + ':' + cell.address + ' style')
      if (sheet.name !== 'DATAINPUT' || !(cell.address in expected)) assert.deepEqual(produced.value, cell.value, sheet.name + ':' + cell.address)
    }))
  }
})

test('all labels and check states have matching English/Spanish translations without changing source evidence', () => {
  const review = reviewSales(sources(), form)
  for (const locale of ['en', 'es'] as const) {
    for (const key of [...review.figures.map(figure => figure.label), ...review.checks.flatMap(check => [check.label, 'salesReview.' + check.state])]) assert.ok(!translate(locale, key).startsWith('['), key)
  }
})
