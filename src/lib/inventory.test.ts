import assert from 'node:assert/strict'
import test from 'node:test'
import { ITEMS, ordersBySupplier, parseAmount, suggestOrder } from './inventory'

test('item ids are unique and fit the Worker pattern', () => {
  const ids = ITEMS.map(i => i.id)
  assert.equal(new Set(ids).size, ids.length)
  for (const id of ids) assert.match(id, /^[a-z0-9-]{1,60}$/)
})

test('amounts parse whole numbers and fractions only', () => {
  assert.equal(parseAmount('15'), 15)
  assert.equal(parseAmount('1/2'), 0.5)
  assert.equal(parseAmount('1 1/2'), 1.5)
  assert.equal(parseAmount('✓'), null)
  assert.equal(parseAmount('3B/2T'), null)
  assert.equal(parseAmount('1/0'), null)
  assert.equal(parseAmount(''), null)
})

test('orders top up to Use, matching the paper sheets', () => {
  assert.equal(suggestOrder('15', '11'), '4') // Rice 10/1
  assert.equal(suggestOrder('20', '12'), '8') // ToGo Soy Sauce 10/1
  assert.equal(suggestOrder('1/2', '0'), '1') // Napa Cabbage out → "+"
  assert.equal(suggestOrder('2', '1/2'), '2')
  assert.equal(suggestOrder('6', '6'), '')
  assert.equal(suggestOrder('6', '9'), '')
  assert.equal(suggestOrder('6', '✓'), '')
  assert.equal(suggestOrder('10', '3B/2T'), '')
  assert.equal(suggestOrder('', '0'), '')
})

test('orders group by supplier and skip blanks', () => {
  const groups = ordersBySupplier({ rice: { inv: '11', order: '4' }, sugar: { inv: '5', order: '3' }, egg: { inv: '3', order: ' ' } })
  assert.deepEqual(groups.map(g => [g.sup, g.lines.map(l => l.order)]), [['D', ['3']], ['L/D', ['4']]])
})
