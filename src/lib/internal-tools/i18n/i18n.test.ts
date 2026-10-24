import test from 'node:test'
import assert from 'node:assert/strict'
import { dictionaries, translate, errorKey } from './index'

test('English/Spanish dictionaries have identical keys, nonempty text and matching placeholders', () => {
  assert.deepEqual(Object.keys(dictionaries.en).sort(), Object.keys(dictionaries.es).sort())
  for (const [key, english] of Object.entries(dictionaries.en)) {
    const spanish = dictionaries.es[key as keyof typeof dictionaries.es]
    assert.ok(english.trim() && spanish.trim(), key)
    const fields = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort()
    assert.deepEqual(fields(english), fields(spanish), key)
  }
})
test('missing keys and parameters stay visible; original input is never translated or coerced', () => {
  assert.equal(translate('es','missing.button'), '[missing.button]')
  assert.equal(translate('es','__proto__'), '[__proto__]')
  assert.equal(translate('es','cash.loaded',{ store: 'CR3', date: '2026-10-24' }), 'Se cargó CR3 del 2026-10-24.')
  assert.equal(translate('en','cash.cashierPlaceholder'), 'Cashier {number}')
  const original = Object.freeze({ name: 'Original name / Nombre original', cents: 0, missing: null, raw: '3B/2T' })
  for (const locale of ['en','es'] as const) translate(locale,'cash.saved',{ store: 'CR3', date: '2026-10-24' })
  assert.deepEqual(original, { name: 'Original name / Nombre original', cents: 0, missing: null, raw: '3B/2T' })
})
test('legacy failures map to stable translation keys without exposing arbitrary server text', () => {
  const auth = new Error('protected arbitrary text'); auth.name = 'StoreAuthError'
  assert.equal(errorKey(auth), 'errors.unauthorized')
  assert.equal(errorKey(new Error('Saving is not set up yet.')), 'errors.unconfigured')
  assert.equal(errorKey(new Error('Too many wrong codes.')), 'errors.rateLimited')
  assert.equal(errorKey(new Error('The server rejected this sheet.')), 'errors.rejected')
  assert.equal(errorKey(new Error('unrecognized secret content')), 'errors.unavailable')
  assert.equal(errorKey(null), 'errors.unavailable')
})
