import { createServer } from 'node:http'
import { mkdirSync, chmodSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createAgentService } from './service'
import { anthropicPlanner } from './planner'
import { canonicalJson } from '../src/lib/internal-tools/json'
import { validRequestData } from '../src/lib/scheduler/requests'
import { type StationId } from '../src/lib/internal-tools/contracts'

const host = process.env.AGENT_HOST ?? '127.0.0.1'
const port = Number(process.env.AGENT_PORT ?? 8790)
const databasePath = resolve(process.env.AGENT_DB_PATH ?? '.agent-data/scheduling.sqlite')
const api = new URL(process.env.AGENT_SCHEDULE_API ?? 'http://127.0.0.1:8787')
if (!['http:', 'https:'].includes(api.protocol)) throw new Error('AGENT_SCHEDULE_API must be an HTTP(S) URL.')
if (api.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(api.hostname)) throw new Error('Use HTTPS for a remote schedule API.')
process.umask(0o077)
mkdirSync(dirname(databasePath), { recursive: true, mode: 0o700 })
const service = createAgentService({ databasePath, managerToken: process.env.AGENT_MANAGER_TOKEN ?? '',
  allowedOrigin: process.env.AGENT_ALLOWED_ORIGIN ?? 'http://localhost:3000',
  planner: process.env.ANTHROPIC_API_KEY && process.env.AGENT_ANTHROPIC_MODEL
    ? anthropicPlanner(process.env.ANTHROPIC_API_KEY, process.env.AGENT_ANTHROPIC_MODEL) : undefined,
  async checkRequests(context, token) {
    if (context.requests.phase !== 'ready') return false
    const url = new URL(`/api/internal/schedule-requests/${context.stationId}`, api)
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000), redirect: 'error' })
    if (!response.ok) return false
    const body = await response.json() as { record?: { revision?: number; data?: unknown } | null }
    if (body.record === null) return context.requests.revision === 0 && context.requests.data === null
    return !!body.record && body.record.revision === context.requests.revision
      && validRequestData(body.record.data, context.stationId as StationId)
      && canonicalJson(body.record.data) === canonicalJson(context.requests.data)
  },
})
chmodSync(databasePath, 0o600)
await service.ready
const server = createServer(async (req, res) => {
  try {
    const chunks: Buffer[] = []; let bytes = 0
    for await (const chunk of req) {
      bytes += chunk.length
      if (bytes > 256000) { res.writeHead(413); res.end(); return }
      chunks.push(chunk)
    }
    const headers = new Headers()
    for (const [key, value] of Object.entries(req.headers)) if (value) headers.set(key, Array.isArray(value) ? value.join(', ') : value)
    const result = await service.handle(new Request(`http://localhost${req.url}`, {
      method: req.method, headers, ...(chunks.length ? { body: Buffer.concat(chunks) } : {}),
    }))
    res.writeHead(result.status, Object.fromEntries(result.headers)); res.end(await result.text())
  } catch { res.writeHead(500); res.end('{"error":"service_unavailable"}') }
})
server.requestTimeout = 30000
server.headersTimeout = 10000
server.listen(port, host, () => console.log(`Scheduling agent listening on http://${host}:${port}`))
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => {
  server.close(() => { void service.close().then(() => process.exit(0)) })
})
