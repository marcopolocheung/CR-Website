import { canWriteV1, type CapabilityResult } from './compatibility'
import { canonicalJson } from './json'
import { apiError, isStoreId, operationId, recordId, revision, utcTimestamp, type ErrorEnvelope, type Json, type MutationEnvelope, type RecordEnvelope, type RecordFamily, type StoreId } from './contracts'

export class SingleFlight<T> {
  private pending: Promise<T> | null = null
  run(task: () => Promise<T>): Promise<T> {
    if (this.pending) return this.pending
    const pending = Promise.resolve().then(task)
    this.pending = pending
    const clear = () => { if (this.pending === pending) this.pending = null }
    void pending.then(clear, clear)
    return pending
  }
}
export type MutationTarget = Readonly<{ storeId: StoreId; family: RecordFamily; id: string; action: string }>
export type RecoveryResult<T extends Json> = { ok: true; record: RecordEnvelope<T> } | { ok: false; status: number; body: ErrorEnvelope }
export type MutationAdapter<T extends Json> = (mutation: MutationEnvelope<T>) => Promise<RecoveryResult<T>>
export type RecoveryCheckpoint<T extends Json> = { version: 1; target: MutationTarget; attempt: MutationEnvelope<T> }

/** Client coordinator for explicitly advertised v1 services, never legacy KV writes. */
export class MutationRecovery<T extends Json> {
  private attempt: MutationEnvelope<T> | null = null
  private result: RecoveryResult<T> | null = null
  private flight = new SingleFlight<RecoveryResult<T>>()
  private sending = false
  private server: RecordEnvelope<T> | null = null
  constructor(readonly target: MutationTarget, capabilities: CapabilityResult, checkpoint?: RecoveryCheckpoint<T>) {
    this.target = Object.freeze(structuredClone(target))
    if (Object.keys(target).some(key => !['storeId','family','id','action'].includes(key)) || !isStoreId(target.storeId) || !recordId(target.id) || !recordId(target.action) || !canWriteV1(capabilities,target.family)) throw new Error('capability_unavailable')
    if (checkpoint) {
      if (Object.keys(checkpoint).some(key => !['version','target','attempt'].includes(key)) || Object.keys(checkpoint.attempt).some(key => !['schemaVersion','baseRevision','operationId','data'].includes(key)) || checkpoint.version !== 1 || canonicalJson(checkpoint.target) !== canonicalJson(target) || checkpoint.attempt.schemaVersion !== 1 || !operationId(checkpoint.attempt.operationId) || revision(checkpoint.attempt.baseRevision) === null || checkpoint.attempt.baseRevision >= Number.MAX_SAFE_INTEGER) throw new Error('invalid_checkpoint')
      canonicalJson(checkpoint.attempt.data)
      this.attempt = structuredClone(checkpoint.attempt)
    }
  }
  get state() { return this.sending ? 'sending' : !this.result ? 'idle' : this.result.ok ? 'saved' : this.result.status === 409 ? 'conflict' : 'failed' }
  checkpoint(): RecoveryCheckpoint<T> | null { return this.attempt ? structuredClone({ version: 1, target: this.target, attempt: this.attempt }) : null }
  localCopy(): T | null { return this.attempt ? structuredClone(this.attempt.data) : null }
  serverCopy(): RecordEnvelope<T> | null { return this.server ? structuredClone(this.server) : null }
  private matches(record: RecordEnvelope<T>): boolean {
    return record.schemaVersion === 1 && record.storeId === this.target.storeId && record.family === this.target.family && record.id === this.target.id && revision(record.revision) !== null && record.revision > 0 && utcTimestamp(record.createdAt) !== null && utcTimestamp(record.updatedAt) !== null
  }
  submit(data: T, baseRevision: number, adapter: MutationAdapter<T>): Promise<RecoveryResult<T>> {
    if (this.sending) return this.flight.run(() => { throw new Error('unreachable') })
    if (revision(baseRevision) === null || baseRevision >= Number.MAX_SAFE_INTEGER) return Promise.resolve({ok:false,status:400,body:apiError('validation_failed')})
    canonicalJson(data)
    if (this.result && !this.result.ok && this.result.status === 409) return Promise.resolve(this.result)
    const same = this.attempt && this.attempt.baseRevision === baseRevision && canonicalJson(this.attempt.data) === canonicalJson(data)
    if (same && this.result?.ok) return Promise.resolve(structuredClone(this.result))
    if (this.attempt && !same && (!this.result || (!this.result.ok && this.result.body.error.code !== 'validation_failed'))) return Promise.resolve({ok:false,status:409,body:apiError('operation_reused')})
    if (!same) this.attempt = {schemaVersion:1,baseRevision:revision(baseRevision)!,operationId:operationId(crypto.randomUUID())!,data:structuredClone(data)}
    return this.retry(adapter)
  }
  retry(adapter: MutationAdapter<T>): Promise<RecoveryResult<T>> {
    if (!this.attempt) throw new Error('no_attempt')
    if (this.result && !this.result.ok && this.result.status === 409) return Promise.resolve(structuredClone(this.result))
    if (this.sending) return this.flight.run(() => { throw new Error('unreachable') })
    this.sending = true
    const original = structuredClone(this.attempt)
    return this.flight.run(async () => {
      try {
        const result = await adapter(structuredClone(original))
        canonicalJson(result)
        if (result.ok && (!this.matches(result.record) || result.record.revision <= original.baseRevision)) this.result = {ok:false,status:503,body:apiError('unavailable')}
        else this.result = structuredClone(result)
      } catch (caught) {
        const name = caught instanceof Error ? caught.name : ''
        const rev = caught && typeof caught === 'object' && 'rev' in caught ? revision(caught.rev) : null
        this.result = name === 'StoreAuthError' ? {ok:false,status:401,body:apiError('unauthorized')}
          : name === 'StoreConflictError' ? {ok:false,status:409,body:apiError('revision_conflict',rev === null ? {} : {currentRevision:rev})}
          : {ok:false,status:503,body:apiError('unavailable')}
      } finally { this.sending = false }
      return structuredClone(this.result!)
    })
  }
  async reload(read: () => Promise<RecordEnvelope<T>>): Promise<RecordEnvelope<T>> {
    const record = await read()
    if (!this.matches(record)) throw new Error('invalid_server_record')
    canonicalJson(record.data)
    this.server = structuredClone(record)
    return structuredClone(record)
  }
  /** Explicit review action; reload alone never changes the pending/local version. */
  acceptServer(): RecordEnvelope<T> {
    if (this.sending || !this.server) throw new Error('server_not_ready')
    const record = structuredClone(this.server)
    this.attempt = null; this.result = null
    return record
  }
}
