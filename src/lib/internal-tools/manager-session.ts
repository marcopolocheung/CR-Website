/** Browser-memory session only. The internal provider explicitly owns its lifetime. */
export class SessionChangedError extends Error {
  constructor() { super('Access changed. Your working copy is retained; review before retrying.'); this.name = 'SessionChangedError' }
}
/** How long a code checked on the /staff page waits for the internal tools to open before it is dropped. */
const HANDOFF_MS = 30_000

export class ManagerSession {
  private state = { token: '', generation: 0 }
  private pending: { token: string; at: number } | null = null
  private listeners = new Set<() => void>()
  active = false
  getSnapshot = () => this.state
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private update(token: string) {
    this.state = { token, generation: this.state.generation + 1 }
    this.listeners.forEach(listener => listener())
  }
  unlock = (token: string, generation = this.state.generation) => {
    if (!this.active || generation !== this.state.generation) return false
    this.update(token); return true
  }
  expire = (generation = this.state.generation) => {
    if (generation === this.state.generation) this.update('')
  }
  /**
   * The /staff entry page checks the code before the internal tools (and this session's provider) exist. It parks the
   * code here, in memory only, and the provider claims it on mount; the page then moves to /internal without a reload.
   */
  handoff = (token: string, now = Date.now()) => { this.pending = { token, at: now } }
  /** The parked code if it is fresh, cleared either way so it can be used once. */
  takeHandoff = (now = Date.now()) => {
    const pending = this.pending
    this.pending = null
    return pending && now - pending.at < HANDOFF_MS ? pending.token : ''
  }
  capture(token: string) {
    if (!this.active) return () => {}
    const { generation, token: current } = this.state
    if (!current || current !== token) throw new SessionChangedError()
    return (status?: number) => {
      if (!this.active || generation !== this.state.generation) throw new SessionChangedError()
      if (status === 401 || status === 403) this.expire(generation)
    }
  }
}
export const managerSession = new ManagerSession()
