import test from 'node:test'
import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadPetDefinition, parsePetMarkdown } from '../lib/pet-config.js'

const here = dirname(fileURLToPath(import.meta.url))
const petFile = join(here, '..', 'pets', 'default', 'pet.md')

test('loads the bundled declarative pet', () => {
  const result = loadPetDefinition(petFile)
  assert.equal(result.ok, true)
  assert.equal(result.value.id, 'cloud-cat')
  assert.equal(result.value.name, 'Momo')
  assert.match(result.value.avatarPath, /pet\.svg$/)
  assert.equal(result.value.labels.done, '做好啦')
})

test('rejects missing fields and remote assets', () => {
  assert.deepEqual(parsePetMarkdown('hello', petFile), { ok: false, error: 'pet.md needs YAML frontmatter' })
  const remote = `---\nid: cloud-cat\nname: Momo\nversion: 1\navatar: https://example.com/pet.svg\n---\n`
  assert.deepEqual(parsePetMarkdown(remote, petFile), { ok: false, error: 'avatar must be a local file beside pet.md' })
})

test('ignores unknown label keys and bounds label length', () => {
  const source = `---\nid: cloud-cat\nname: Momo\nversion: 1\navatar: pet.svg\nlabels:\n  done: Yay\n  unknown: Nope\n  error: ${'x'.repeat(41)}\n---\n`
  const result = parsePetMarkdown(source, petFile)
  assert.equal(result.ok, true)
  assert.equal(result.value.labels.done, 'Yay')
  assert.equal(result.value.labels.error, '遇到了一点问题')
})
