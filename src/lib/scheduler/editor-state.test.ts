import assert from 'node:assert/strict'
import test from 'node:test'
import { defaultTemplateForRestaurant, seedTemplate } from './data'
import { publishState, templateProblems } from './editor-state'

test('built-in rules have no problems', () => {
  for (const id of ['CR3-diningroom', 'CR3-kitchen', 'CR2-kitchen', 'CR2-diningroom']) {
    assert.deepEqual(templateProblems(defaultTemplateForRestaurant(id)), [])
  }
})

test('a spot that ends before it starts, or has no label, is named', () => {
  const [first, second] = seedTemplate.Monday
  const template = {
    ...seedTemplate,
    Monday: [{ ...first, start: 16 * 60, end: 9 * 60 }, { ...second, label: '  ' }],
  }
  const problems = templateProblems(template)
  assert.equal(problems.length, 2)
  assert.deepEqual(
    problems.map(({ day, index }) => [day, index]),
    [
      ['Monday', 0],
      ['Monday', 1],
    ],
  )
  assert.match(problems[0].message, /ends at 0?9:00 AM, before it starts at 0?4:00 PM/)
  assert.match(problems[1].message, /needs a label/)
})

test('publish state tells drafts, hidden, changed and live weeks apart', () => {
  const base = { fingerprintOnScreen: 'a', publishedFingerprint: 'a', visibleOnScreen: true }
  assert.equal(publishState({ ...base, published: null }), 'draft')
  assert.equal(publishState({ ...base, published: { visible: true } }), 'live')
  assert.equal(publishState({ ...base, published: { visible: false }, visibleOnScreen: false }), 'hidden')
  assert.equal(publishState({ ...base, published: { visible: true }, fingerprintOnScreen: 'b' }), 'changed')
  // Turning a week on in the editor is a change staff cannot see until it is published.
  assert.equal(publishState({ ...base, published: { visible: false } }), 'changed')
})
