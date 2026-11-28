import test from 'node:test'
import assert from 'node:assert/strict'
import { decodeMeta, encodeMeta, fileName, folderPath, labelsList, linkKey, mediaType, parseLinkKey, sha256Hex, validFileChange, validFileMeta, MAX_BYTES } from './files'

const base = { operationId: 'op-1', baseRevision: 0, versionId: 'ver_12345678-aaaa', name: 'Order.xlsx', folder: 'Ordering', labels: ['Weekly'], links: [], addedBy: 'Maria', sha256: 'a'.repeat(64), size: 10 }

test('filenames keep an allowed extension and reject paths, control characters and disallowed types', () => {
  assert.equal(fileName('  Ventas día.CSV '), 'Ventas día.CSV')
  assert.equal(mediaType('Ventas.CSV'), 'text/csv')
  for (const bad of ['page.html', 'run.exe', '../x.pdf', 'a\\b.pdf', 'tab\t.pdf', 'noext', 'x'.repeat(197) + '.pdf']) assert.equal(fileName(bad), null, bad)
})

test('folders and labels normalize and enforce limits', () => {
  assert.equal(folderPath(' Ordering / Suppliers /'), 'Ordering/Suppliers')
  assert.equal(folderPath(''), '')
  assert.equal(folderPath('a/b/c/d/e/f'), null)
  assert.equal(folderPath('ok/..'), null)
  assert.deepEqual(labelsList(['CR3', 'cr3', ' Weekly ', '']), ['CR3', 'Weekly'])
  assert.equal(labelsList(Array.from({ length: 11 }, (_, i) => `l${i}`)), null)
  assert.equal(labelsList(['x'.repeat(41)]), null)
})

test('links use exact keys per tool', () => {
  assert.deepEqual(parseLinkKey('cash-close:CR2:2026-11-27'), { kind: 'cash-close', key: 'CR2:2026-11-27' })
  assert.equal(linkKey({ kind: 'import', key: 'imp_abc' }), 'import:imp_abc')
  for (const bad of ['inventory-count:CR2:2026-11-27', 'form:short', 'unknown:x', 'import:']) assert.equal(parseLinkKey(bad), null, bad)
})

test('upload metadata round-trips through the header and rejects anything outside attachments-v1', () => {
  const meta = { ...base, name: 'Horas – señal.csv' }
  assert.deepEqual(validFileMeta(decodeMeta(encodeMeta(meta))), meta)
  assert.equal(decodeMeta('not base64!'), null)
  for (const change of [{ size: MAX_BYTES + 1 }, { sha256: 'xyz' }, { versionId: 'doc_12345678' }, { addedBy: '' }, { links: [{ kind: 'form', key: 'bad' }] }])
    assert.equal(validFileMeta({ ...base, ...change }), null, JSON.stringify(change))
})

test('changes are update, trash or restore only', () => {
  assert.deepEqual(validFileChange({ operationId: 'op', baseRevision: 2, addedBy: 'Luis', action: 'trash' }), { operationId: 'op', baseRevision: 2, addedBy: 'Luis', action: 'trash' })
  assert.equal(validFileChange({ operationId: 'op', baseRevision: 2, addedBy: 'Luis', action: 'delete' }), null)
  assert.equal(validFileChange({ operationId: 'op', baseRevision: 2, addedBy: 'Luis', action: 'update', name: 'x.exe', folder: '', labels: [] }), null)
})

test('sha256Hex matches a known digest', async () => {
  assert.equal(await sha256Hex(new TextEncoder().encode('abc').buffer as ArrayBuffer), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
})
