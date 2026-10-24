export type WorkbookOutput = { filename: string; base64: string; sha256: string }
const FILENAME = /^[A-Za-z0-9_.-]+\.xlsx$/
export function isWorkbookOutput(value: unknown): value is WorkbookOutput {
  if (!value || typeof value !== 'object') return false
  const output = value as WorkbookOutput
  return Object.keys(output).every(key => ['filename', 'base64', 'sha256'].includes(key))
    && typeof output.filename === 'string' && FILENAME.test(output.filename)
    && typeof output.base64 === 'string' && output.base64.length > 0 && output.base64.length % 4 === 0
    && /^[A-Za-z0-9+/]+={0,2}$/.test(output.base64) && typeof output.sha256 === 'string' && /^[a-f0-9]{64}$/.test(output.sha256)
}
async function checksum(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('')
}
export async function workbookOutput(filename: string, buffer: BlobPart): Promise<WorkbookOutput> {
  if (!FILENAME.test(filename)) throw new Error('invalid_output_filename')
  const bytes = await new Blob([buffer]).arrayBuffer()
  const array = new Uint8Array(bytes)
  let binary = ''
  for (let offset = 0; offset < array.length; offset += 8192) binary += String.fromCharCode(...array.subarray(offset, offset + 8192))
  return { filename, base64: btoa(binary), sha256: await checksum(bytes) }
}
export async function workbookBytes(output: WorkbookOutput): Promise<Uint8Array<ArrayBuffer>> {
  if (!isWorkbookOutput(output)) throw new Error('invalid_workbook_output')
  const bytes = Uint8Array.from(atob(output.base64), value => value.charCodeAt(0))
  if (await checksum(bytes.buffer) !== output.sha256) throw new Error('workbook_checksum_mismatch')
  return bytes
}
export async function downloadWorkbookOutput(output: WorkbookOutput): Promise<void> {
  const bytes = await workbookBytes(output)
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = output.filename; anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
