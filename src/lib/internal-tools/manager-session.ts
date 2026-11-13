/** Browser-memory session only. The internal provider explicitly owns its lifetime. */
export class SessionChangedError extends Error {
  constructor() { super('Access changed. Your working copy is retained; review before retrying.'); this.name = 'SessionChangedError' }
}
export class ManagerSession {
  private state = { token: '', generation: 0 }
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
