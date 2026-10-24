import { hoursRecords } from './imports'
import { validateHoursRows } from '../../src/lib/converter/validation'
import type { ImportSnapshot } from '../../src/lib/converter/import-snapshot'
export function historySnapshot():Extract<ImportSnapshot,{kind:'hours'}>{
 return {version:1,kind:'hours',rows:validateHoursRows(hoursRecords,[],true).value!,sourceName:'synthetic-hours.csv',metadata:{location:'CHINA ROSE #3 - 7046 W MILITARY DR',startDate:'2026-10-01',endDate:'2026-10-31',preparer:'Synthetic reviewer',fingerprint:'sha256:'+'a'.repeat(64)},output:{filename:'CR3_26_1001-26_1031_EMPLOYEE_HOUR_LOG_SUMMARY.xlsx',sha256:'b'.repeat(64),base64:'UEsDBA=='}}
}
