// One-shot reset for the kitchen scheduler stations.
//
// Replaces the dining-room crew on CR3-kitchen with the fixed kitchen crew
// (Muk / Jeffrey / Carolina) and pushes the kitchen schedule rules to both
// CR3-kitchen and CR2-kitchen. Dining stations are untouched.
//
// Usage:
//   SCHEDULE_WRITE_TOKEN=... node --import jiti/register scripts/seed-kitchen-stations.mjs [--api BASE] [--dry-run]
//
// The script reads each station's current rev first, so re-runs are safe
// (stale revs abort with a conflict message instead of overwriting).

import { createJiti } from 'jiti'

const jiti = createJiti(import.meta.url)
const { seedKitchenEmployeesCR03, seedKitchenTemplateCR02, seedKitchenTemplateCR03 } = jiti('../src/lib/scheduler/data.ts')
const { toRosterEmployee } = jiti('../src/lib/employee-store.ts')

const args = new Set(process.argv.slice(2))
const dryRun = args.has('--dry-run')
const apiFlag = process.argv.find((arg) => arg.startsWith('--api='))
const API = (apiFlag ? apiFlag.slice('--api='.length) : process.env.SCHEDULE_API || 'https://chinarose-schedule-api.crbrucecheung.workers.dev').replace(/\/+$/, '')
const TOKEN = process.env.SCHEDULE_WRITE_TOKEN || ''

async function getJson(path) {
  const response = await fetch(`${API}${path}`, { cache: 'no-store' })
  if (!response.ok) throw new Error(`GET ${path} -> ${response.status}`)
  return response.json()
}

async function putJson(path, body) {
  const response = await fetch(`${API}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`PUT ${path} -> ${response.status} ${JSON.stringify(payload)}`)
  return payload
}

const plans = [
  {
    restaurant: 'CR3-kitchen',
    roster: seedKitchenEmployeesCR03.map(toRosterEmployee),
    template: seedKitchenTemplateCR03,
  },
  {
    restaurant: 'CR2-kitchen',
    roster: null, // starts empty; only reset if the server somehow holds dining staff
    template: seedKitchenTemplateCR02,
  },
]

let failed = false
for (const plan of plans) {
  const rosterDoc = await getJson(`/api/employees?restaurant=${plan.restaurant}`)
  const templateDoc = await getJson(`/api/template?restaurant=${plan.restaurant}`)
  console.log(`\n== ${plan.restaurant} ==`)
  console.log(`roster: rev=${rosterDoc.rev} count=${rosterDoc.employees.length}`)
  console.log(`template: rev=${templateDoc.rev} present=${templateDoc.template !== null}`)

  const rosterPayload = plan.roster ?? (rosterDoc.employees.length > 0 ? [] : null)
  if (dryRun) {
    console.log(`[dry-run] would PUT roster (${rosterPayload ? rosterPayload.length : 'skip'}) baseRev=${rosterDoc.rev}`)
    console.log(`[dry-run] would PUT template baseRev=${templateDoc.rev}`)
    continue
  }
  if (!TOKEN) {
    console.error('Missing SCHEDULE_WRITE_TOKEN. Re-run with the manager write token, or add --dry-run to preview.')
    process.exitCode = 1
    failed = true
    continue
  }
  try {
    if (rosterPayload) {
      const saved = await putJson(`/api/employees?restaurant=${plan.restaurant}`, { employees: rosterPayload, baseRev: rosterDoc.rev })
      console.log(`roster saved rev=${saved.rev}`)
    } else {
      console.log('roster already empty — skipped')
    }
    const savedTemplate = await putJson(`/api/template?restaurant=${plan.restaurant}`, { template: plan.template, baseRev: templateDoc.rev })
    console.log(`template saved rev=${savedTemplate.rev}`)
  } catch (error) {
    console.error(String(error))
    failed = true
  }
}
process.exitCode = failed ? 1 : 0
