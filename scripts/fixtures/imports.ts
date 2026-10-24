/** Synthetic source reports; no staff or production data. */
import * as XLSX from 'xlsx'
import { HOURS_COLUMNS } from '../../src/lib/converter/validation'
export function salesFixtures() {
  const general = XLSX.utils.book_new()
  const add = (wb: XLSX.WorkBook, name: string, rows: unknown[][]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name)
  add(general, 'Revenue summary', [['Total'], [1234.56]])
  add(general, 'Payments summary', [['Payment type', 'Payment sub type', 'Total'], ['CASH', '', 234.56], ['CREDIT/DEBIT', 'VISA', 1000]])
  add(general, 'Void summary', [['Void amount'], [12.34]])
  const lunch = XLSX.utils.book_new()
  add(lunch, 'Sales category summary', [['Sales category', 'Net sales', 'Tax amount'], ['DRINK', 23.45, null], ['FOOD', 500, null], ['Total', null, 43.19]])
  const dinner = XLSX.utils.book_new()
  add(dinner, 'Sales category summary', [['Sales category', 'Net sales', 'Tax amount'], ['DRINK', 50, 4.13], ['FOOD', 600, 49.5], ['Total', 650, 53.63]])
  return { general, lunch, dinner }
}
export const hoursRecords = [
  [...HOURS_COLUMNS],
  ['EMP-B', 'Original Name B', 'Server', '10/21/2026 08:00 AM', '10/21/2026 04:00 PM', '8.00', '7.50', '0.50'],
  ['EMP-A', 'Nombre original', 'Cook', '10/22/2026 08:00 AM', '10/22/2026 03:00 PM', '7', '7', '0'],
  ['EMP-B', 'Original Name B', 'Server', '10/20/2026 08:00 AM', '10/20/2026 05:00 PM', '9', '8', '1'],
]
