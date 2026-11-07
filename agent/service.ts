import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import { SqliteSaver } from '@langchain/langgraph-checkpoint-sqlite'
import { Command } from '@langchain/langgraph'
import { z } from 'zod'
import { canonicalJson } from '../src/lib/internal-tools/json'
import { agentContextSchema, contextFingerprint, goalSchema, type AgentContext, type AgentRunView } from '../src/lib/scheduler/agent-contracts'
import { buildSchedulingGraph, proposalProblems, runView, type AgentState, type Planner } from './graph'

const createSchema = z.object({ id: z.uuid(), context: agentContextSchema, goal: goalSchema,
  instructions: z.string().max(2000).default(''), }).strict()
const decisionSchema = z.object({ accept: z.boolean(), context: agentContextSchema.optional() }).strict()
const hash = (text: string) => createHash('sha256').update(text).digest('hex')
type Row = { id: string; owner: string; fingerprint: string; created: number; input: string; view: string }
export type ServiceOptions = {
  databasePath: string; managerToken: string; allowedOrigin: string; planner?: Planner
  /** Read the current request revision from the existing Worker; never mutate it. */
  checkRequests: (context: AgentContext, token: string) => Promise<boolean>
}

export function createAgentService(options: ServiceOptions) {
  if (options.managerToken.length < 16) throw new Error('Set AGENT_MANAGER_TOKEN to the existing manager code (at least 16 characters).')
  const saver = SqliteSaver.fromConnString(options.databasePath)
  const db = saver.db
  db.pragma('journal_mode = WAL')
  db.pragma('busy_timeout = 5000')
  db.exec('CREATE TABLE IF NOT EXISTS agent_runs (id TEXT PRIMARY KEY, owner TEXT NOT NULL, fingerprint TEXT NOT NULL, created INTEGER NOT NULL, input TEXT NOT NULL, view TEXT NOT NULL)')
  const graph = buildSchedulingGraph(saver, { planner: options.planner })
  type GraphInput = Parameters<typeof graph.stream>[0]
  const active = new Set<string>()
  let closing = false
  const tasks = new Set<Promise<void>>()
  const config = (id: string) => ({ configurable: { thread_id: id }, recursionLimit: 24 })
  const row = (id: string) => db.prepare('SELECT * FROM agent_runs WHERE id = ?').get(id) as Row | undefined
  const save = (id: string, view: AgentRunView) => db.prepare('UPDATE agent_runs SET view = ? WHERE id = ?').run(JSON.stringify(view), id)

  async function execute(id: string, input: GraphInput) {
    active.add(id)
    try {
      const stream = await graph.stream(input, { ...config(id), streamMode: 'values', durability: 'sync' })
      for await (const state of stream) if (state.context && state.status) save(id, runView(id, state as AgentState))
    } catch {
      const record = row(id)
      if (record) save(id, { ...JSON.parse(record.view), status: 'failed', summary: 'The run stopped unexpectedly. Start a new proposal; your current schedule is unchanged.' })
    } finally { active.delete(id) }
  }
  function launch(id: string, input: Partial<AgentState> | null) {
    const task = execute(id, input)
    tasks.add(task)
    void task.finally(() => tasks.delete(task))
  }
  async function cleanup() {
    const expired = db.prepare('SELECT id FROM agent_runs WHERE created < ?').all(Date.now() - 7 * 86400000) as { id: string }[]
    for (const item of expired) if (!active.has(item.id)) {
      await saver.deleteThread(item.id)
      db.prepare('DELETE FROM agent_runs WHERE id = ?').run(item.id)
    }
  }
  async function recover() {
    await cleanup()
    const records = db.prepare('SELECT * FROM agent_runs ORDER BY created').all() as Row[]
    // One process owns this SQLite file. Deterministic tools can safely replay an unfinished node.
    for (const record of records) if (['running', 'review'].includes((JSON.parse(record.view) as AgentRunView).status)) {
      const checkpoint = await graph.getState(config(record.id))
      await execute(record.id, checkpoint.values?.context ? null : JSON.parse(record.input))
    }
  }
  const ready = recover()
  const retentionTimer = setInterval(() => { if (!closing) void cleanup().catch(() => {}) }, 3600000)
  retentionTimer.unref()

  async function handle(request: Request): Promise<Response> {
    const origin = request.headers.get('origin')
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin' }
    if (origin === options.allowedOrigin) {
      headers['Access-Control-Allow-Origin'] = origin
      headers['Access-Control-Allow-Headers'] = 'Authorization, Content-Type'
      headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    }
    const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers })
    if (origin && origin !== options.allowedOrigin) return reply(403, { error: 'origin_not_allowed' })
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    const supplied = request.headers.get('authorization') ?? ''
    const expected = `Bearer ${options.managerToken}`
    if (!timingSafeEqual(Buffer.from(hash(supplied)), Buffer.from(hash(expected)))) return reply(401, { error: 'unauthorized' })
    if (closing) return reply(503, { error: 'shutting_down' })
    await ready
    const owner = hash(options.managerToken)
    const url = new URL(request.url)
    if (url.pathname === '/api/agent/health' && request.method === 'GET') return reply(200, { ok: true, planner: options.planner ? 'model' : 'built-in' })
    try {
      let body: unknown
      if (request.method === 'POST') {
        const raw = await request.text()
        if (Buffer.byteLength(raw) > 256000) return reply(413, { error: 'body_too_large' })
        try { body = JSON.parse(raw) } catch { return reply(400, { error: 'invalid_json' }) }
      }
      if (url.pathname === '/api/agent/runs' && request.method === 'POST') {
        const parsed = createSchema.safeParse(body)
        if (!parsed.success) return reply(400, { error: 'invalid_input' })
        const { id, context, goal, instructions } = parsed.data
        const fingerprint = hash(contextFingerprint(context))
        const existing = row(id)
        if (existing) {
          if (existing.owner !== owner) return reply(404, { error: 'not_found' })
          if (existing.fingerprint !== fingerprint || existing.input !== canonicalJson({ context, goal, instructions }))
            return reply(409, { error: 'operation_changed' })
          return reply(200, JSON.parse(existing.view))
        }
        if (active.size >= 2) return reply(429, { error: 'busy' })
        await cleanup()
        const count = db.prepare('SELECT count(*) AS n FROM agent_runs WHERE owner = ? AND created > ?').get(owner, Date.now() - 3600000) as { n: number }
        if (count.n >= 12) return reply(429, { error: 'run_budget' })
        if (!await options.checkRequests(context, options.managerToken)) return reply(409, { error: 'requests_changed' })
        // Re-check limits after the network await; concurrent requests must not race the quota.
        if (active.size >= 2) return reply(429, { error: 'busy' })
        const raced = row(id)
        if (raced) return raced.input === canonicalJson({ context, goal, instructions })
          ? reply(200, JSON.parse(raced.view)) : reply(409, { error: 'operation_changed' })
        const currentCount = db.prepare('SELECT count(*) AS n FROM agent_runs WHERE owner = ? AND created > ?').get(owner, Date.now() - 3600000) as { n: number }
        if (currentCount.n >= 12) return reply(429, { error: 'run_budget' })
        const view: AgentRunView = { id, stationId: context.stationId, weekStart: context.weekStart, goal,
          status: 'running', summary: 'Inspecting your week…', events: [], problems: [], proposal: null }
        db.prepare('INSERT INTO agent_runs VALUES (?, ?, ?, ?, ?, ?)').run(id, owner, fingerprint, Date.now(),
          canonicalJson({ context, goal, instructions }), JSON.stringify(view))
        launch(id, { context, goal, instructions })
        return reply(202, view)
      }
      const match = /^\/api\/agent\/runs\/([0-9a-f-]{36})(\/decision)?$/.exec(url.pathname)
      if (!match) return reply(404, { error: 'not_found' })
      const record = row(match[1])
      if (!record || record.owner !== owner) return reply(404, { error: 'not_found' })
      const view = JSON.parse(record.view) as AgentRunView
      if (request.method === 'GET' && !match[2]) return reply(200, view)
      if (request.method !== 'POST' || !match[2]) return reply(405, { error: 'method_not_allowed' })
      const decision = decisionSchema.safeParse(body)
      if (!decision.success) return reply(400, { error: 'invalid_input' })
      if (active.has(record.id)) return reply(409, { error: 'run_in_progress' })
      const { accept, context } = decision.data
      if (accept) {
        if (!context || hash(contextFingerprint(context)) !== record.fingerprint) return reply(409, { error: 'draft_changed' })
        if (!await options.checkRequests(context, options.managerToken)) return reply(409, { error: 'requests_changed' })
        if (!view.proposal || proposalProblems(context, view.proposal.assignments).length) return reply(409, { error: 'proposal_failed_validation' })
      }
      if (active.has(record.id)) return reply(409, { error: 'run_in_progress' })
      const latest = JSON.parse(row(record.id)!.view) as AgentRunView
      // Idempotent decisions survive a lost response. The browser still checks its draft before applying.
      if ((accept && latest.status === 'accepted') || (!accept && latest.status === 'rejected')) return reply(200, latest)
      if (latest.status !== 'review') return reply(409, { error: 'not_awaiting_review' })
      await execute(record.id, new Command({ resume: { accept } }))
      return reply(200, JSON.parse(row(record.id)!.view))
    } catch { return reply(503, { error: 'service_unavailable' }) }
  }
  return { handle, ready, async close() { closing = true; clearInterval(retentionTimer); await ready; await Promise.all(tasks); db.close() },
    async idle() { await ready; await Promise.all(tasks) }, newId: randomUUID }
}
