const base = (process.argv[2] ?? process.env.NEXT_PUBLIC_SCHEDULE_API ?? 'https://chinarose-schedule-api.crbrucecheung.workers.dev').replace(/\/+$/, '')
const restaurants = ['CR3-diningroom', 'CR3-kitchen', 'CR2-kitchen', 'CR2-diningroom']
const month = new Date().toISOString().slice(0, 7)

async function get(path) {
  const res = await fetch(`${base}${path}`, { cache: 'no-store' })
  return { status: res.status, body: await res.json().catch(() => null) }
}

let failed = false
const health = await get('/api/health')
console.log(`health: ${health.status} ${JSON.stringify(health.body)}`)
if (health.status !== 200) failed = true

for (const restaurant of restaurants) {
  const roster = await get(`/api/employees?restaurant=${restaurant}`)
  const template = await get(`/api/template?restaurant=${restaurant}`)
  const schedule = await get(`/api/schedule?month=${month}&restaurant=${restaurant}`)
  console.log(
    `${restaurant}: roster rev=${roster.body?.rev ?? '?'} count=${roster.body?.employees?.length ?? '?'} | template rev=${template.body?.rev ?? '?'} | schedule rev=${schedule.body?.rev ?? '?'} weeks=${(schedule.body?.weeks ?? []).map((w) => w.weekStart).join(',') || 'none'}`,
  )
  if (roster.status !== 200 || template.status !== 200 || schedule.status !== 200) failed = true
}

if (failed) {
  console.error('verify failed: the store is unreachable or returned a non-200. Pages deploys never delete KV data — check the Worker + SCHEDULES binding instead.')
  process.exit(1)
}
console.log('ok: store reachable. Empty revs mean nothing was ever saved for that station, not a deploy wipe.')
