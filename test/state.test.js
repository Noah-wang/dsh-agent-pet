import test from 'node:test'
import assert from 'node:assert/strict'
import { createStateEvent, normalizeObservation } from '../lib/state.js'

test('maps agent and tool lifecycle observations', () => {
  assert.equal(normalizeObservation({ kind: 'agent-status', status: 'running' }), 'thinking')
  assert.equal(normalizeObservation({ kind: 'tool-start' }), 'running_tool')
  assert.equal(normalizeObservation({ kind: 'tool-result', failed: false }), 'thinking')
  assert.equal(normalizeObservation({ kind: 'tool-result', failed: true }), 'error')
  assert.equal(normalizeObservation({ kind: 'approval', pending: true }), 'waiting_approval')
  assert.equal(normalizeObservation({ kind: 'agent-status', status: 'idle' }), 'done')
})

test('keeps the previous state for unknown observations', () => {
  assert.equal(normalizeObservation({ kind: 'future-event' }, 'running_tool'), 'running_tool')
  assert.equal(normalizeObservation(null, 'thinking'), 'thinking')
})

test('creates a small versioned event', () => {
  assert.deepEqual(createStateEvent('done', { timestamp: 42, label: '完成' }), {
    version: 1,
    state: 'done',
    label: '完成',
    timestamp: 42,
  })
  assert.throws(() => createStateEvent('unknown'), /Unknown pet state/)
})
