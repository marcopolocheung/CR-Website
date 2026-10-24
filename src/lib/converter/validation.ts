import * as XLSX from 'xlsx'
import type { TranslationKey } from '../internal-tools/i18n'

export type SalesSlot = 'general' | 'lunch' | 'dinner'
export type SourceIssue = { key: TranslationKey; params?: Record<string, string | number> }
export type SourceResult<T> = { value: T | null; issues: SourceIssue[] }
export class SourceValidationError extends Error {
  constructor(public issues: SourceIssue[]) { super('Source validation failed'); this.name = 'SourceValidationError' }
}
const problem = (key: TranslationKey, params?: SourceIssue['params']): SourceIssue => ({ key, params })
export const HOURS_COLUMNS = ['Employee External Id', 'Employee', 'Job Title', 'In Date', 'Out Date', 'Total Hours', 'Regular Hours', 'Overtime Hours'] as const
export type HoursRow = Record<(typeof HOURS_COLUMNS)[number], string> & { __sourceRow?: number }

/** Preserve the supported USD syntax; never turn blank/malformed cells into zero. */
export function sourceNumber(value: unknown, money = true): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string' || !value.trim()) return null
  const text = value.trim()
  const pattern = money
    ? /^[+-]?\$?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?|\.\d+)$/
    : /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/
  if (!pattern.test(text)) return null
  const parsed = Number(text.replace(/[$,]/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

/** Header is the first row in the declared sheet range, matching the existing SheetJS reader. */
export function validateSalesWorkbook(wb: XLSX.WorkBook, slot: SalesSlot): SourceIssue[] {
  const issues: SourceIssue[] = []
  const sheetRows = (sheet: string, columns: string[], optional = false) => {
    const ws = wb.Sheets[sheet]
    if (!ws) {
      if (!optional) issues.push(problem('importValidation.sheet', { sheet }))
      return null
    }
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null, blankrows: true })
    const start = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']).s.r : 0
    const startColumn = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']).s.c : 0
    const headers = rows[0] ?? []
    const errors = Object.entries(ws).filter(([address, cell]) => !address.startsWith('!') && cell.t === 'e')
    if (errors.length) {
      for (const [address] of errors) {
        const cell = XLSX.utils.decode_cell(address)
        issues.push(problem('importValidation.number', { sheet, row: cell.r + 1, column: String(headers[cell.c - startColumn] ?? address) }))
      }
      return null
    }
    if (!rows.length || !rows.slice(1).some(row => row.some(v => v !== null && v !== ''))) {
      if (optional) return []
      issues.push(problem('importValidation.emptySheet', { sheet })); return null
    }
    let valid = true
    for (const column of columns) {
      const occurrences = headers.filter(value => value === column).length
      if (occurrences !== 1) {
        issues.push(problem(occurrences ? 'importValidation.duplicateColumn' : 'importValidation.column', { sheet, column })); valid = false
      }
    }
    if (!valid) return null
    return rows.slice(1).map((cells, index) => ({
      cells, row: start + index + 2,
      get: (column: string) => cells[headers.indexOf(column)],
    })).filter(record => record.cells.some(v => v !== null && v !== ''))
  }
  const numeric = (rows: NonNullable<ReturnType<typeof sheetRows>>, sheet: string, column: string) => {
    for (const record of rows) if (sourceNumber(record.get(column)) === null)
      issues.push(problem('importValidation.number', { sheet, row: record.row, column }))
  }
  const labels = (rows: NonNullable<ReturnType<typeof sheetRows>>, sheet: string, column: string) => {
    for (const record of rows) if (typeof record.get(column) !== 'string' || !String(record.get(column)).trim())
      issues.push(problem('importValidation.requiredCell', { sheet, row: record.row, column }))
  }
  const requireRow = (rows: NonNullable<ReturnType<typeof sheetRows>>, sheet: string, label: string, match: (value: typeof rows[number]) => boolean) => {
    const count = rows.filter(match).length
    if (count !== 1) issues.push(problem(count ? 'importValidation.duplicateRow' : 'importValidation.requiredRow', { sheet, label }))
  }
  const upper = (value: unknown) => typeof value === 'string' ? value.toUpperCase() : ''
  if (slot === 'general') {
    const revenue = sheetRows('Revenue summary', ['Total'])
    if (revenue) numeric(revenue, 'Revenue summary', 'Total')
    const payments = sheetRows('Payments summary', ['Payment type', 'Total'])
    if (payments) {
      numeric(payments, 'Payments summary', 'Total')
      labels(payments, 'Payments summary', 'Payment type')
      if (payments.some(row => upper(row.get('Payment type')) === 'CREDIT/DEBIT')) sheetRows('Payments summary', ['Payment type', 'Payment sub type', 'Total'])
      for (const row of payments) if (upper(row.get('Payment type')) === 'CREDIT/DEBIT' && !upper(row.get('Payment sub type')))
        issues.push(problem('importValidation.requiredCell', { sheet: 'Payments summary', row: row.row, column: 'Payment sub type' }))
      requireRow(payments, 'Payments summary', 'CASH', r => upper(r.get('Payment type')) === 'CASH')
      for (const sub of ['DISCOVER', 'AMEX', 'MASTERCARD', 'VISA']) {
        if (payments.filter(r => upper(r.get('Payment type')) === 'CREDIT/DEBIT' && upper(r.get('Payment sub type')) === sub).length > 1)
          issues.push(problem('importValidation.duplicateRow', { sheet: 'Payments summary', label: sub }))
      }
    }
    const discounts = sheetRows('Check Discounts', ['Discount', 'Amount'], true)
    if (discounts?.length) {
      numeric(discounts, 'Check Discounts', 'Amount')
      labels(discounts, 'Check Discounts', 'Discount')
      requireRow(discounts, 'Check Discounts', 'Total', r => r.get('Discount') === 'Total')
    }
    const voids = sheetRows('Void summary', ['Void amount'])
    if (voids) numeric(voids, 'Void summary', 'Void amount')
  } else {
    const sheet = 'Sales category summary'
    const rows = sheetRows(sheet, ['Sales category', 'Net sales', 'Tax amount'])
    if (rows) {
      labels(rows, sheet, 'Sales category')
      numeric(rows.filter(r => ['DRINK', 'FOOD'].includes(upper(r.get('Sales category'))) || (r.get('Net sales') !== null && r.get('Net sales') !== undefined && r.get('Net sales') !== '')), sheet, 'Net sales')
      numeric(rows.filter(r => r.get('Sales category') === 'Total' || (r.get('Tax amount') !== null && r.get('Tax amount') !== undefined && r.get('Tax amount') !== '')), sheet, 'Tax amount')
      requireRow(rows, sheet, 'DRINK', r => upper(r.get('Sales category')) === 'DRINK')
      requireRow(rows, sheet, 'FOOD', r => upper(r.get('Sales category')) === 'FOOD')
      requireRow(rows, sheet, 'Total', r => r.get('Sales category') === 'Total')
    }
  }
  return issues
}

export async function readSalesFile(file: Pick<File, 'name' | 'size' | 'arrayBuffer'>, slot: SalesSlot): Promise<SourceResult<XLSX.WorkBook>> {
  if (!file.size) return { value: null, issues: [problem('importValidation.empty')] }
  if (!/\.(xlsx|xls|csv)$/i.test(file.name)) return { value: null, issues: [problem('importValidation.salesType')] }
  try {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
    const issues = validateSalesWorkbook(workbook, slot)
    return { value: issues.length ? null : workbook, issues }
  } catch { return { value: null, issues: [problem('importValidation.unreadable')] } }
}

// This validates source timestamps only; it does not assign a business date,
// filter periods, split overnight shifts or recalculate regular/overtime hours.
function validSourceDate(value: string): boolean {
  if (!value.trim() || !Number.isFinite(Date.parse(value))) return false
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:\D|$)/.exec(value)
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\D|$)/.exec(value)
  if (!iso && !us) return true // retain other formats already understood by the existing reader
  const [year, month, day] = iso ? [+iso[1], +iso[2], +iso[3]] : [+us![3], +us![1], +us![2]]
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

/** Row numbers are CSV record numbers, counting the header and empty records. */
export function validateHoursRows(records: unknown[][], parserErrors: { code: string; row?: number }[] = [], review = false): SourceResult<HoursRow[]> {
  const issues: SourceIssue[] = parserErrors.map(error => problem('importValidation.csv', { row: (error.row ?? 0) + 1, code: error.code }))
  const nonempty = records.some(row => row.some(value => String(value ?? '').trim()))
  if (!nonempty) return { value: null, issues: [problem('importValidation.empty')] }
  const headers = (records[0] ?? []).map(value => String(value ?? ''))
  if (!HOURS_COLUMNS.some(column => headers.includes(column))) return { value: null, issues: [...issues, problem('importValidation.hoursReport')] }
  for (const column of HOURS_COLUMNS) {
    const count = headers.filter(value => value === column).length
    if (count !== 1) issues.push(problem(count ? 'importValidation.csvDuplicateColumn' : 'importValidation.csvColumn', { column }))
  }
  if (issues.length) return { value: null, issues }
  let malformed = false
  const rows: HoursRow[] = []
  records.slice(1).forEach((cells, index) => {
    if (cells.every(value => !String(value ?? '').trim())) return
    const row = index + 2
    if (cells.length !== headers.length) { malformed = true; issues.push(problem('importValidation.csvWidth', { row })) }
    const record: HoursRow = Object.fromEntries(HOURS_COLUMNS.map(column => [column, String(cells[headers.indexOf(column)] ?? '')])) as Record<(typeof HOURS_COLUMNS)[number], string>
    for (const column of ['Employee External Id', 'Employee'] as const) {
      if (!record[column].trim()) issues.push(problem('importValidation.csvRequired', { row, column }))
    }
    for (const column of ['Total Hours', 'Regular Hours', 'Overtime Hours'] as const) {
      if (sourceNumber(record[column], false) === null) issues.push(problem('importValidation.csvNumber', { row, column }))
    }
    for (const column of ['In Date', 'Out Date'] as const) {
      if (!validSourceDate(record[column])) issues.push(problem('importValidation.csvDate', { row, column }))
    }
    if (review) record.__sourceRow = row
    rows.push(record)
  })
  if (!rows.length) issues.push(problem('importValidation.noRows'))
  return { value: malformed || !rows.length || (!review && issues.length) ? null : rows, issues }
}
