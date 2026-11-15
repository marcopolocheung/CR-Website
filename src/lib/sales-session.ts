/**
 * The sales code and the stores it opens, in browser memory only (never stored), separate from the manager code:
 * a store code shows only that store's Toast sales. Same subscribe/getSnapshot shape as `managerSession`.
 */
export type SalesSessionState = { token: string; stores: readonly string[]; generation: number }

export class SalesSession {
  private state: SalesSessionState = { token: '', stores: [], generation: 0 }
  private listeners = new Set<() => void>()
  getSnapshot = () => this.state
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private update(token: string, stores: readonly string[]) {
    this.state = { token, stores, generation: this.state.generation + 1 }
    this.listeners.forEach(listener => listener())
  }
  unlock = (token: string, stores: readonly string[]) => { this.update(token, stores) }
  /** Forget the code. Pass the generation seen when a request started so an old failure can't lock a newer code. */
  expire = (generation = this.state.generation) => {
    if (generation === this.state.generation && this.state.token) this.update('', [])
  }
}

export const salesSession = new SalesSession()
