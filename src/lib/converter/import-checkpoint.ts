import { newDraft, saveDraft, type DraftStorage } from '../internal-tools/drafts'
import { isImportSnapshot, snapshotContext, type ImportSnapshot } from './import-snapshot'

/** Checkpoint reviewed values as a new device copy; never overwrite a recovery source. */
export function checkpointImport(storage: DraftStorage, snapshot: ImportSnapshot | null, preparer: string): boolean {
  if (!snapshot || !isImportSnapshot(snapshot) || !preparer.trim() || preparer.length > 120) return false
  try {
    return saveDraft(storage, newDraft(snapshotContext(snapshot), preparer.trim(), snapshot), isImportSnapshot).state === 'saved'
  } catch { return false }
}
