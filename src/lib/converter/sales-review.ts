import * as XLSX from 'xlsx'
import type { SalesContext } from './sales-context'
import { extractMetrics } from './parseToast'
import { sourceNumber, SourceValidationError, type SalesSlot } from './validation'
import type { TranslationKey } from '../internal-tools/i18n'

export type SalesForm = Record<'firstName' | 'lastName' | 'day' | 'date' | 'location' | 'amDeposit' | 'pmDeposit' | 'amOverShort' | 'pmOverShort', string>
export type SalesSources = Record<SalesSlot, { name: string; workbook: XLSX.WorkBook }>
export type Figure = { cell: string; label: TranslationKey; value: number | null; slot: SalesSlot | 'form'; filename: string; sheet: string; row: number | null; column: string; raw: string | number | null; absent: boolean }
export type Check = { id: string; label: TranslationKey; state: 'match' | 'different' | 'missing' | 'review'; left: number | null; right: number | null; difference: number | null }
export type SalesReview = { context?: SalesContext; sources: { slot: SalesSlot; filename: string; sheets: string[] }[]; figures: Figure[]; checks: Check[]; metrics: Record<string, number>; form: SalesForm; unmappedCategories: { slot: SalesSlot; row: number; category: string; net: number | null; tax: number | null }[]; unmapped: { row: number; type: string; subtype: string; value: number }[] }
const upper = (value: unknown) => typeof value === 'string' ? value.toUpperCase() : ''
const rows = (wb: XLSX.WorkBook, sheet: string): Record<string, unknown>[] => wb.Sheets[sheet] ? XLSX.utils.sheet_to_json(wb.Sheets[sheet]) : []
const cents = (value: number | null): number | null => {
  if (value === null) return null
  const integer = Math.round(value * 100)
  return Number.isSafeInteger(integer) && Math.abs(value * 100 - integer) < 0.000001 ? integer : null
}
const sum = (values: (number | null)[]): number | null => {
  const integers = values.map(cents)
  if (!integers.length || integers.some(value => value === null)) return null
  const total = (integers as number[]).reduce((a, b) => a + b, 0)
  return Number.isSafeInteger(total) ? total / 100 : null
}

export function reviewSales(sources: SalesSources, input: SalesForm): SalesReview {
  const form = { ...input }
  for (const name of ['amDeposit', 'pmDeposit', 'amOverShort', 'pmOverShort'] as const) {
    const value = input[name].trim() ? sourceNumber(input[name]) : null
    if (input[name].trim() && value === null) throw new SourceValidationError([{ key: 'importValidation.badMetric' }])
    form[name] = value === null ? '' : String(value)
  }
  const metrics: Record<string, number> = extractMetrics({ generalWb: sources.general.workbook, lunchWb: sources.lunch.workbook, dinnerWb: sources.dinner.workbook })
  const figures: Figure[] = []
  const figure = (slot: SalesSlot, sheet: string, column: string, cell: string, label: TranslationKey, match?: (row: Record<string, unknown>) => boolean) => {
    const data = rows(sources[slot].workbook, sheet)
    const record = match ? data.find(match) : data[0]
    const raw = record?.[column]
    figures.push({ cell, label, value: metrics[cell], slot, filename: sources[slot].name, sheet, column,
      row: record ? Number(record.__rowNum__) + 1 : null, raw: typeof raw === 'number' || typeof raw === 'string' ? raw : null, absent: !record })
  }
  figure('general', 'Revenue summary', 'Total', 'C8', 'salesReview.revenue')
  figure('general', 'Payments summary', 'Total', 'C9', 'salesReview.cash', row => upper(row['Payment type']) === 'CASH')
  for (const [subtype, cell, label] of [['DISCOVER', 'C10', 'salesReview.discover'], ['AMEX', 'C11', 'salesReview.amex'], ['MASTERCARD', 'C12', 'salesReview.mastercard'], ['VISA', 'C13', 'salesReview.visa']] as const)
    figure('general', 'Payments summary', 'Total', cell, label, row => upper(row['Payment type']) === 'CREDIT/DEBIT' && upper(row['Payment sub type']) === subtype)
  figure('general', 'Check Discounts', 'Amount', 'C16', 'salesReview.discounts', row => row.Discount === 'Total')
  figure('general', 'Void summary', 'Void amount', 'C17', 'salesReview.voids')
  for (const [slot, food, drink, tax] of [['lunch', 'C18', 'C19', 'C20'], ['dinner', 'C21', 'C22', 'C23']] as const) {
    figure(slot, 'Sales category summary', 'Net sales', food, 'salesReview.food', row => upper(row['Sales category']) === 'FOOD')
    figure(slot, 'Sales category summary', 'Net sales', drink, 'salesReview.drink', row => upper(row['Sales category']) === 'DRINK')
    figure(slot, 'Sales category summary', 'Tax amount', tax, 'salesReview.tax', row => row['Sales category'] === 'Total')
  }
  for (const [name, cell, label] of [
    ['amDeposit', 'C4', 'salesReview.amDeposit'], ['pmDeposit', 'C5', 'salesReview.pmDeposit'],
    ['amOverShort', 'C6', 'salesReview.amDifference'], ['pmOverShort', 'C7', 'salesReview.pmDifference'],
  ] as const) figures.push({ cell, label, value: form[name] ? Number(form[name]) : null, slot: 'form', filename: '', sheet: '', row: null, column: name, raw: input[name] || null, absent: !form[name] })

  const checks: Check[] = []
  const compare = (id: string, label: TranslationKey, left: number | null, right: number | null, differentScopes = false) => {
    const a = cents(left), b = cents(right)
    const difference = a !== null && b !== null && Number.isSafeInteger(a - b) ? (a - b) / 100 : null
    checks.push({ id, label, left, right, difference, state: difference === null ? 'missing' : differentScopes ? 'review' : difference === 0 ? 'match' : 'different' })
  }
  const totals: (number | null)[] = []
  const unmappedCategories: SalesReview['unmappedCategories'] = []
  for (const slot of ['lunch', 'dinner'] as const) {
    const data = rows(sources[slot].workbook, 'Sales category summary')
    const total = data.find(row => row['Sales category'] === 'Total')!
    const detail = data.filter(row => row !== total)
    for (const row of detail) if (!['FOOD', 'DRINK'].includes(upper(row['Sales category']))) unmappedCategories.push({ slot, row: Number(row.__rowNum__) + 1, category: String(row['Sales category']), net: sourceNumber(row['Net sales']), tax: sourceNumber(row['Tax amount']) })
    const net = sourceNumber(total['Net sales'])
    totals.push(net)
    compare(slot + '-sales', slot === 'lunch' ? 'salesReview.lunchSales' : 'salesReview.dinnerSales', net, sum(detail.map(row => sourceNumber(row['Net sales']))))
    compare(slot + '-tax', slot === 'lunch' ? 'salesReview.lunchTax' : 'salesReview.dinnerTax', sourceNumber(total['Tax amount']), sum(detail.map(row => sourceNumber(row['Tax amount']))))
  }
  const payments = rows(sources.general.workbook, 'Payments summary')
  const totalPayments = payments.filter(row => upper(row['Payment type']) === 'TOTAL')
  const mappedPayments = sum(['C9', 'C10', 'C11', 'C12', 'C13'].map(cell => metrics[cell]))
  compare('payments', 'salesReview.payments', totalPayments.length === 1 ? sourceNumber(totalPayments[0].Total) : null, mappedPayments)
  compare('revenue-sales', 'salesReview.crossSales', metrics.C8, sum(totals), true)
  compare('revenue-payments', 'salesReview.crossPayments', metrics.C8, mappedPayments, true)
  compare('cash-deposits', 'salesReview.cashDeposits', metrics.C9, sum([form.amDeposit ? Number(form.amDeposit) : null, form.pmDeposit ? Number(form.pmDeposit) : null]), true)
  const unmapped = payments.filter(row => upper(row['Payment type']) !== 'TOTAL' && upper(row['Payment type']) !== 'CASH' && !(upper(row['Payment type']) === 'CREDIT/DEBIT' && ['DISCOVER', 'AMEX', 'MASTERCARD', 'VISA'].includes(upper(row['Payment sub type']))))
    .map(row => ({ row: Number(row.__rowNum__) + 1, type: String(row['Payment type'] ?? ''), subtype: String(row['Payment sub type'] ?? ''), value: sourceNumber(row.Total)! }))
  return { sources: (['general', 'lunch', 'dinner'] as const).map(slot => ({ slot, filename: sources[slot].name, sheets: sources[slot].workbook.SheetNames.slice() })), figures, checks, metrics, form, unmapped, unmappedCategories }
}
