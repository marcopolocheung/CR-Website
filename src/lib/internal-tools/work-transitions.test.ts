import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkpointWork } from './work-transitions'

test('failed storage checkpoints other tasks without closing any editor', () => {
  const visited: string[] = []
  const entries = [
    { dirty: true, deviceSaved: false, checkpoint: () => { visited.push('cash'); throw Error('quota') }, leave: () => visited.push('closed cash') },
    { dirty: true, deviceSaved: false, checkpoint: () => { visited.push('form'); return true }, leave: () => visited.push('closed form') },
  ]
  assert.equal(checkpointWork(entries), false)
  assert.deepEqual(visited, ['cash', 'form'])
})
test('busy work prevents partial handoff and unsupported memory-only work stays open', () => {
  let writes = 0
  assert.equal(checkpointWork([{ dirty: true, deviceSaved: false, busy: true }, { dirty: true, deviceSaved: false, checkpoint: () => { writes++; return true } }]), false)
  assert.equal(writes, 0)
  assert.equal(checkpointWork([{ dirty: true, deviceSaved: false }]), false)
  assert.equal(checkpointWork([{ dirty: true, deviceSaved: true }, { dirty: false, deviceSaved: false }]), true)
})
