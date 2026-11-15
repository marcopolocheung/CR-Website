/** A result belongs to both its initiating job and the exact draft/context it read. */
export class DraftJob {
  private current: { key: string; controller: AbortController } | null = null
  begin(key: string) {
    this.cancel()
    const job = { key, controller: new AbortController() }
    this.current = job
    return job
  }
  owns(job: ReturnType<DraftJob['begin']>) { return this.current === job }
  canCommit(job: ReturnType<DraftJob['begin']>, key: string) { return this.owns(job) && !job.controller.signal.aborted && job.key === key }
  cancel() { this.current?.controller.abort(); this.current = null }
  finish(job: ReturnType<DraftJob['begin']>) { if (this.owns(job)) this.current = null }
}
