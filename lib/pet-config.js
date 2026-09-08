import { readFileSync } from 'node:fs'
import { dirname, isAbsolute, join, normalize, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_LABELS, PET_STATES } from './state.js'

const PACKAGE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')
export const DEFAULT_PET_FILE = join(PACKAGE_DIR, 'pets', 'default', 'pet.md')

function unquote(value) {
  const trimmed = value.trim()
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function safeAssetPath(petFile, asset) {
  if (!asset || isAbsolute(asset) || /^[a-z][a-z0-9+.-]*:/i.test(asset) || asset.includes('\0')) return undefined
  const root = dirname(petFile)
  const target = normalize(join(root, asset))
  const rel = relative(root, target)
  return rel && !rel.startsWith('..') && !isAbsolute(rel) ? target : undefined
}

export function parsePetMarkdown(source, petFile = DEFAULT_PET_FILE) {
  if (typeof source !== 'string') return { ok: false, error: 'pet.md must be text' }
  const match = source.match(/^---\s*\n([\s\S]*?)\n---(?:\s*\n|$)/)
  if (!match) return { ok: false, error: 'pet.md needs YAML frontmatter' }

  const values = {}
  let section = ''
  for (const rawLine of match[1].split(/\r?\n/)) {
    if (!rawLine.trim() || rawLine.trimStart().startsWith('#')) continue
    const indent = rawLine.match(/^\s*/)[0].length
    const separator = rawLine.indexOf(':')
    if (separator < 1) return { ok: false, error: `Invalid frontmatter line: ${rawLine.trim()}` }
    const key = rawLine.slice(0, separator).trim()
    const value = unquote(rawLine.slice(separator + 1))
    if (indent === 0) {
      section = value ? '' : key
      if (value) values[key] = value
    } else if (section === 'labels') {
      values.labels ??= {}
      values.labels[key] = value
    }
  }

  for (const key of ['id', 'name', 'version', 'avatar']) {
    if (typeof values[key] !== 'string' || !values[key]) return { ok: false, error: `Missing required field: ${key}` }
  }
  if (!/^[a-z0-9][a-z0-9-]{1,47}$/.test(values.id)) return { ok: false, error: 'id must be lowercase letters, numbers, or hyphens' }
  const avatarPath = safeAssetPath(petFile, values.avatar)
  if (!avatarPath) return { ok: false, error: 'avatar must be a local file beside pet.md' }

  const labels = { ...DEFAULT_LABELS }
  if (values.labels) {
    for (const state of PET_STATES) {
      const value = values.labels[state]
      if (typeof value === 'string' && value.length <= 40) labels[state] = value
    }
  }
  return { ok: true, value: { id: values.id, name: values.name, version: values.version, avatarPath, labels } }
}

export function loadPetDefinition(petFile = DEFAULT_PET_FILE) {
  try {
    return parsePetMarkdown(readFileSync(petFile, 'utf8'), petFile)
  } catch (error) {
    return { ok: false, error: `Unable to read pet.md: ${error instanceof Error ? error.message : String(error)}` }
  }
}
