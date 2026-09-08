import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { DEFAULT_PREFS, loadPrefs, normalizePrefs, resetPrefs, savePrefs } from '../lib/pet-prefs.js'

async function dataDir() {
  return mkdtemp(join(tmpdir(), 'pet-prefs-'))
}

test('normalizing rejects junk and keeps the previous value', () => {
  const previous = { ...DEFAULT_PREFS, right: 120, hidden: true }
  const next = normalizePrefs({ right: 'nonsense', bottom: 40, hidden: 'yes' }, previous)
  assert.equal(next.right, 120, 'a non-numeric position falls back')
  assert.equal(next.bottom, 40)
  assert.equal(next.hidden, true, 'a non-boolean flag falls back')
  assert.deepEqual(normalizePrefs(null), { ...DEFAULT_PREFS })
  assert.deepEqual(normalizePrefs([]), { ...DEFAULT_PREFS })
})

test('positions are clamped instead of stored out of range', () => {
  assert.equal(normalizePrefs({ right: -500 }).right, 0)
  assert.equal(normalizePrefs({ bottom: 9_999_999 }).bottom, 10_000)
  assert.equal(normalizePrefs({ right: 42.6 }).right, 43)
})

test('preferences round-trip through the data directory', async () => {
  const dir = await dataDir()
  try {
    assert.deepEqual(loadPrefs(dir), { ...DEFAULT_PREFS, revision: 'initial' })
    const saved = await savePrefs(dir, { right: 300, hidden: true }, DEFAULT_PREFS)
    assert.equal(saved.right, 300)
    assert.equal(saved.hidden, true)
    assert.notEqual(saved.revision, 'initial')

    const reloaded = loadPrefs(dir)
    assert.equal(reloaded.right, 300)
    assert.equal(reloaded.revision, saved.revision, 'the revision survives a reload')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('every write gets a fresh revision so clients can tell them apart', async () => {
  const dir = await dataDir()
  try {
    const first = await savePrefs(dir, { right: 100 }, DEFAULT_PREFS)
    const second = await savePrefs(dir, { right: 100 }, first)
    assert.notEqual(first.revision, second.revision)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('reset restores the factory values', async () => {
  const dir = await dataDir()
  try {
    await savePrefs(dir, { right: 400, bottom: 400, hidden: true, showBubble: false }, DEFAULT_PREFS)
    const reset = await resetPrefs(dir)
    const { revision, ...values } = reset
    assert.deepEqual(values, { ...DEFAULT_PREFS })
    assert.ok(revision)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
