import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { loadStoredPet, resetStoredPet, saveStoredPet } from '../lib/pet-store.js'

test('saves, reloads, replaces, and resets a generated pet', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-agent-pet-store-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const first = await saveStoredPet(root, {
    name: 'Miu', description: 'cloud fox', style: 'sticker', bytes: Buffer.from('first'),
  })
  assert.equal(loadStoredPet(root).name, 'Miu')
  assert.equal((await readFile(first.avatarPath)).toString(), 'first')

  const second = await saveStoredPet(root, {
    name: 'Nono', description: 'moon rabbit', style: 'plush', bytes: Buffer.from('second'),
  })
  assert.equal(loadStoredPet(root).name, 'Nono')
  await assert.rejects(readFile(first.avatarPath), /ENOENT/)
  assert.equal((await readFile(second.avatarPath)).toString(), 'second')

  await resetStoredPet(root)
  assert.equal(loadStoredPet(root), undefined)
})

test('ignores malformed metadata and paths outside the data directory', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-agent-pet-store-invalid-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  await readFile(new URL('../package.json', import.meta.url))
  const { writeFile } = await import('node:fs/promises')
  await writeFile(join(root, 'current-pet.json'), JSON.stringify({
    schemaVersion: 1, revision: 'x', id: 'bad', name: 'Bad', avatarFile: '../outside.png',
  }))
  assert.equal(loadStoredPet(root), undefined)
})

