import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_SHEETS, filterBySupplier, listProblem, newItemId, ordersBySupplier, parseAmount, suggestOrder } from './inventory'

const ITEMS = DEFAULT_SHEETS.flatMap(s => s.items)

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
  const groups = ordersBySupplier(DEFAULT_SHEETS, { rice: { inv: '11', order: '4' }, sugar: { inv: '5', order: '3' }, egg: { inv: '3', order: ' ' } })
  assert.deepEqual(groups.map(g => [g.sup, g.lines.map(l => l.order)]), [['D', ['3']], ['L/D', ['4']]])
})

test('supplier filter keeps rows shared between suppliers', () => {
  const ids = (picked: string[]) => filterBySupplier(DEFAULT_SHEETS, picked).flatMap(s => s.items.map(i => i.id))
  assert.equal(ids([]).length, ITEMS.length)
  assert.ok(ids(['D']).includes('rice')) // L/D
  assert.ok(ids(['L']).includes('egg')) // D/L
  assert.ok(!ids(['D']).includes('pork'))
  assert.ok(!ids(['B']).includes('degreaser')) // no supplier: only with no filter
  assert.deepEqual(filterBySupplier(DEFAULT_SHEETS, ['Pepsi']).map(s => s.id), ['pepsi'])
})

test('orders carry the ordered check-off', () => {
  const [group] = ordersBySupplier(DEFAULT_SHEETS, { sugar: { inv: '5', order: '3', done: true } })
  assert.equal(group.lines[0].done, true)
})

test('new item ids are readable and never collide', () => {
  const taken = new Set(['pork'])
  assert.equal(newItemId('Pork', taken), 'pork-2')
  assert.equal(newItemId('Pork', taken), 'pork-3')
  assert.equal(newItemId('Bok Choy (Baby)', taken), 'bok-choy-baby')
  assert.equal(newItemId('✓✓', taken), 'item')
})

test('edited lists are checked before saving', () => {
  assert.equal(listProblem(DEFAULT_SHEETS), null)
  const edit = (patch: object) => [{ ...DEFAULT_SHEETS[0], items: [{ ...DEFAULT_SHEETS[0].items[0], ...patch }] }]
  assert.match(listProblem(edit({ name: '  ' }))!, /needs an item name/)
  assert.match(listProblem(edit({ use: 'lots' }))!, /Use must be a number/)
  assert.equal(listProblem(edit({ use: '1 1/2' })), null)
  assert.equal(listProblem(edit({ use: '' })), null)
})
