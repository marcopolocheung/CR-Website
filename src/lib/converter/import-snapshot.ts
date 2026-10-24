import { businessDate, type StoreId } from '../internal-tools/contracts'
import { draftContextKey, type DraftContext } from '../internal-tools/drafts'
import { HOURS_COLUMNS, validateHoursRows, type HoursRow } from './validation'
import type { SalesReview } from './sales-review'
import { isWorkbookOutput, type WorkbookOutput } from './workbook-output'
import en from '../internal-tools/i18n/en'

export type HoursMetadata = { location: string; startDate: string; endDate: string; preparer: string }
export type ImportSnapshot = { version: 1; kind: 'sales'; review: SalesReview; output: WorkbookOutput | null }
  | { version: 1; kind: 'hours'; sourceName: string; rows: HoursRow[]; metadata: HoursMetadata; output: WorkbookOutput | null }
const FORM_KEYS = ['firstName', 'lastName', 'day', 'date', 'location', 'amDeposit', 'pmDeposit', 'amOverShort', 'pmOverShort']
const SOURCE_CELLS = ['C8', 'C9', 'C10', 'C11', 'C12', 'C13', 'C16', 'C17', 'C18', 'C19', 'C20', 'C21', 'C22', 'C23']
const ALL_CELLS = [...SOURCE_CELLS, 'C4', 'C5', 'C6', 'C7']
const SLOTS = ['general', 'lunch', 'dinner']
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const keys = (value: Record<string, unknown>, allowed: string[]) => Object.keys(value).every(key => allowed.includes(key))
const numberOrNull = (value: unknown) => value === null || (typeof value === 'number' && Number.isFinite(value))
const label = (value: unknown) => typeof value === 'string' && value.startsWith('salesReview.') && Object.hasOwn(en, value)
export function importStore(location: string): StoreId | null {
  if (location === 'CHINA ROSE #3 - 7046 W MILITARY DR') return 'CR3'
  if (location === 'CHINA ROSE #2 - 2535 SW MILITARY DR') return 'CR2'
  return null
}
function validReview(value: unknown): value is SalesReview {
  if (!object(value) || !keys(value, ['sources', 'figures', 'checks', 'metrics', 'form', 'unmapped', 'unmappedCategories'])) return false
  const { form, metrics, sources, figures, checks, unmapped, unmappedCategories } = value
  if (!object(form) || !keys(form, FORM_KEYS) || !FORM_KEYS.every(key => typeof form[key] === 'string') || !importStore(form.location as string) || !businessDate(form.date)) return false
  if (!object(metrics) || !keys(metrics, SOURCE_CELLS) || !SOURCE_CELLS.every(key => typeof metrics[key] === 'number' && Number.isFinite(metrics[key]))) return false
  if (!Array.isArray(sources) || sources.length !== 3 || new Set(sources.map(source => source?.slot)).size !== 3 || !sources.every(source => object(source) && keys(source, ['slot', 'filename', 'sheets']) && SLOTS.includes(source.slot as string) && typeof source.filename === 'string' && Array.isArray(source.sheets) && source.sheets.every(sheet => typeof sheet === 'string'))) return false
  if (!Array.isArray(figures) || figures.length !== 18 || new Set(figures.map(figure => figure?.cell)).size !== 18 || !figures.every(figure => object(figure) && keys(figure, ['cell','label','value','slot','filename','sheet','row','column','raw','absent']) && ALL_CELLS.includes(figure.cell as string) && label(figure.label) && numberOrNull(figure.value) && [...SLOTS, 'form'].includes(figure.slot as string) && ['filename','sheet','column'].every(key => typeof figure[key] === 'string') && (figure.row === null || (Number.isSafeInteger(figure.row) && (figure.row as number) > 0)) && (typeof figure.raw === 'string' || numberOrNull(figure.raw)) && typeof figure.absent === 'boolean')) return false
  const manual: Record<string, string> = { C4: 'amDeposit', C5: 'pmDeposit', C6: 'amOverShort', C7: 'pmOverShort' }
  if (!figures.every(figure => SOURCE_CELLS.includes(figure.cell) ? SLOTS.includes(figure.slot) && figure.value === metrics[figure.cell] && figure.filename === sources.find(source => source.slot === figure.slot)?.filename : figure.slot === 'form' && figure.value === (form[manual[figure.cell]] ? Number(form[manual[figure.cell]]) : null))) return false
  if (!Array.isArray(checks) || checks.length !== 8 || !checks.every(check => object(check) && keys(check, ['id','label','state','left','right','difference']) && typeof check.id === 'string' && label(check.label) && ['match','different','missing','review'].includes(check.state as string) && ['left','right','difference'].every(key => numberOrNull(check[key])))) return false
  if (!Array.isArray(unmapped) || !unmapped.every(row => object(row) && keys(row, ['row','type','subtype','value']) && Number.isSafeInteger(row.row) && (row.row as number) > 0 && typeof row.type === 'string' && typeof row.subtype === 'string' && typeof row.value === 'number' && Number.isFinite(row.value))) return false
  return Array.isArray(unmappedCategories) && unmappedCategories.every(row => object(row) && keys(row, ['slot','row','category','net','tax']) && SLOTS.includes(row.slot as string) && Number.isSafeInteger(row.row) && (row.row as number) > 0 && typeof row.category === 'string' && numberOrNull(row.net) && numberOrNull(row.tax))
}
export function isImportSnapshot(value: unknown): value is ImportSnapshot {
  if (!object(value) || value.version !== 1 || !(value.output === null || isWorkbookOutput(value.output))) return false
  if (value.kind === 'sales') {
    if (!keys(value, ['version','kind','review','output']) || !validReview(value.review)) return false
    const date = value.review.form.date
    return value.output === null || value.output.filename === `${date.slice(2,4)}-${date.slice(5,7)}${date.slice(8,10)}_${importStore(value.review.form.location)}_Daily_Sales_Report.xlsx`
  }
  if (value.kind !== 'hours' || !keys(value, ['version','kind','sourceName','rows','metadata','output']) || typeof value.sourceName !== 'string' || !Array.isArray(value.rows) || !object(value.metadata)) return false
  const meta = value.metadata
  if (!keys(meta, ['location','startDate','endDate','preparer']) || !['location','startDate','endDate','preparer'].every(key => typeof meta[key] === 'string') || !importStore(meta.location as string) || !businessDate(meta.startDate) || !businessDate(meta.endDate) || (meta.startDate as string) > (meta.endDate as string)) return false
  if (!value.rows.every(row => object(row) && keys(row, [...HOURS_COLUMNS]) && HOURS_COLUMNS.every(key => typeof row[key] === 'string'))) return false
  const format = (value: string) => `${value.slice(2,4)}_${value.slice(5,7)}${value.slice(8,10)}`
  if (value.output && value.output.filename !== `${importStore(meta.location as string)}_${format(meta.startDate as string)}-${format(meta.endDate as string)}_EMPLOYEE_HOUR_LOG_SUMMARY.xlsx`) return false
  return validateHoursRows([[...HOURS_COLUMNS], ...value.rows.map(row => HOURS_COLUMNS.map(column => row[column]))]).issues.length === 0
}
export function snapshotContext(snapshot: ImportSnapshot): DraftContext {
  const context: DraftContext = snapshot.kind === 'sales'
    ? { task: 'sales-import', storeId: importStore(snapshot.review.form.location)!, businessDate: businessDate(snapshot.review.form.date)! }
    : { task: 'hours-import', storeId: importStore(snapshot.metadata.location)!, period: { start: businessDate(snapshot.metadata.startDate)!, end: businessDate(snapshot.metadata.endDate)! } }
  return context
}

export function snapshotMatchesContext(value: unknown, context: DraftContext): value is ImportSnapshot {
  return isImportSnapshot(value) && draftContextKey(snapshotContext(value)) === draftContextKey(context)
}
