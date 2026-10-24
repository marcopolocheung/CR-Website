import { businessDate } from '../internal-tools/contracts'
export const DATE_POLICY = 'DEC-01-v1'
export const STORE_TIME_ZONE = 'America/Chicago'
export function weekday(date: string): string {
  return businessDate(date) ? ['SUN','MON','TUE','WED','THU','FRI','SAT'][new Date(`${date}T12:00:00Z`).getUTCDay()] : ''
}
const parts = (ms: number) => Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: STORE_TIME_ZONE, year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23' }).formatToParts(new Date(ms)).map(p => [p.type,p.value]))
export function instantDate(ms: number): string {
 const p=parts(ms);return `${p.year}-${p.month}-${p.day}`
}
export type SourceTime = { date: string; instant: number | null; issue: 'ambiguous' | 'invalid' | null }
/** Explicit ISO/US source formats only. Unzoned local times are checked for DST gaps/repeats. */
export function sourceTime(raw: string): SourceTime {
 const invalid: SourceTime={date:'',instant:null,issue:'invalid'}
 const text=raw.trim()
 const iso=/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?)?$/.exec(text)
 const us=/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i.exec(text)
 if(!iso&&!us)return invalid
 const y=+(iso?iso[1]:us![3]),m=+(iso?iso[2]:us![1]),d=+(iso?iso[3]:us![2])
 const date=`${String(y).padStart(4,'0')}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`
 if(!businessDate(date))return invalid
 if(!(iso?.[4]||us?.[4]))return {date,instant:null,issue:null}
 let hour=+(iso?.[4]??us![4]);const minute=+(iso?.[5]??us![5]),second=+(iso?.[6]??us?.[6]??0)
 if(us?.[7]) {if(hour<1||hour>12)return invalid;hour=hour%12+(us[7].toUpperCase()==='PM'?12:0)}
 if(hour>23||minute>59||second>59)return invalid
 if(iso?.[7]) {
   const instant=Date.parse(text.replace(' ','T'))
   return Number.isFinite(instant)?{date:instantDate(instant),instant,issue:null}:invalid
 }
 const local=Date.UTC(y,m-1,d,hour,minute,second)
 const candidates=[300,360].map(offset=>local+offset*60_000).filter(ms=>{
   const p=parts(ms);return instantDate(ms)===date&&+p.hour===hour&&+p.minute===minute&&+p.second===second
 })
 return {date,instant:candidates.length===1?candidates[0]:null,issue:candidates.length===1?null:candidates.length?'ambiguous':'invalid'}
}
