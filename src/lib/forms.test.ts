import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'
import { BLANK_FORMS, blankFormHref } from './forms'

const DIR = new URL('../../public/internal/forms/', import.meta.url)
// xlsx and docx are zip containers; PDFs start with %PDF.
const SIGNATURE: Record<string, string> = { xlsx: '504b0304', docx: '504b0304', pdf: '25504446' }

test('every blank form in the catalog exists with its original format', () => {
  assert.equal(BLANK_FORMS.length, 11)
  assert.deepEqual(BLANK_FORMS.map(f => f.file).sort(), readdirSync(DIR).sort())
  for (const { file } of BLANK_FORMS) {
    const bytes = readFileSync(new URL(file, DIR))
    assert.equal(bytes.subarray(0, 4).toString('hex'), SIGNATURE[file.split('.').pop()!], file)
    assert.ok(bytes.length > 1000, file)
  }
})

test('blank form links respect the deploy base path', () => {
  assert.equal(blankFormHref('', 'new-hire.pdf'), '/internal/forms/new-hire.pdf')
  assert.equal(blankFormHref('/chinarose', 'new-hire.pdf'), '/chinarose/internal/forms/new-hire.pdf')
})
