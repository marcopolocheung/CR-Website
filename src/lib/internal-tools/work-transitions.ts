/** No editor is closed until every participating working copy is recoverable. */
export type Work = { scope?: string; active?: boolean; dirty: boolean; deviceSaved: boolean; busy?: boolean; checkpoint?: () => boolean; leave?: () => void }
export function checkpointWork(entries: Work[]): boolean {
  if (entries.some(entry => entry.busy)) return false
  let saved = true
  for (const entry of entries) {
    try {
      if (entry.checkpoint ? !entry.checkpoint() : entry.dirty && !entry.deviceSaved) saved = false
    } catch { saved = false }
  }
  return saved
}
