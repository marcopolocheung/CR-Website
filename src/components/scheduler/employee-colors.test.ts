import assert from 'node:assert/strict'
import { test } from 'node:test'
import { EMPLOYEE_PALETTE, employeeColorsFor } from './employee-colors'

test('a 100-person roster has unique, readable colors regardless of roster order', () => {
  const ids = Array.from({ length: 100 }, (_, i) => `employee-${i}`)
  const colors = employeeColorsFor(ids)
  assert.equal(new Set(colors.values()).size, ids.length)
  assert.deepEqual(colors, employeeColorsFor([...ids].reverse()))
  for (const hex of colors.values()) {
    const rgb = hex.match(/[0-9a-f]{2}/gi)!.map(v => parseInt(v, 16) / 255)
    const [r, g, b] = rgb.map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
    assert(1.05 / (.2126 * r + .7152 * g + .0722 * b + .05) >= 4.5, hex)
    const [wr, wg, wb] = rgb.map(v => .09 * v + .91).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
    assert((.2126 * wr + .7152 * wg + .0722 * wb + .05) / (.2126 * r + .7152 * g + .0722 * b + .05) >= 4.5, `Team card ${hex}`)
  }
})
test('adding/removing staff or switching weeks preserves previously assigned colors', () => {
  const first = employeeColorsFor(['b', 'c', 'd'])
  const next = employeeColorsFor(['new', 'a', 'c'], first)
  for (const [id, color] of first) assert.equal(next.get(id), color)
  assert.equal(new Set(next.values()).size, next.size)
  assert.equal(employeeColorsFor(['b'], next).get('b'), first.get('b'))
})
test('identities beyond the palette still get distinct colors', () => {
  const colors = employeeColorsFor(Array.from({ length: EMPLOYEE_PALETTE.length + 10 }, (_, i) => String(i)))
  assert.equal(new Set(colors.values()).size, colors.size)
})
