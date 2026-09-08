import { existsSync, readFileSync } from 'node:fs'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { randomUUID } from 'node:crypto'

const META_FILE = 'current-pet.json'
const AVATAR_PATTERN = /^avatar-[a-f0-9-]+\.png$/

function metadataPath(dataDir) {
  return join(dataDir, META_FILE)
}

function validMetadata(value, dataDir) {
  if (!value || value.schemaVersion !== 1 || typeof value.revision !== 'string') return undefined
  if (typeof value.id !== 'string' || typeof value.name !== 'string' || typeof value.avatarFile !== 'string') return undefined
  if (!AVATAR_PATTERN.test(value.avatarFile) || basename(value.avatarFile) !== value.avatarFile) return undefined
  const avatarPath = join(dataDir, value.avatarFile)
  if (!existsSync(avatarPath)) return undefined
  return {
    id: value.id,
    name: value.name,
    version: value.version || '1.0.0',
    description: typeof value.description === 'string' ? value.description : '',
    style: typeof value.style === 'string' ? value.style : 'auto',
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : '',
    revision: value.revision,
    avatarPath,
    avatarFile: value.avatarFile,
  }
}

export function loadStoredPet(dataDir) {
  try {
    return validMetadata(JSON.parse(readFileSync(metadataPath(dataDir), 'utf8')), dataDir)
  } catch {
    return undefined
  }
}

export async function saveStoredPet(dataDir, { name, description, style, bytes }) {
  await mkdir(dataDir, { recursive: true, mode: 0o700 })
  const previous = loadStoredPet(dataDir)
  const revision = randomUUID()
  const avatarFile = `avatar-${revision}.png`
  const avatarPath = join(dataDir, avatarFile)
  const metaTemp = join(dataDir, `.current-pet-${revision}.tmp`)
  const metadata = {
    schemaVersion: 1,
    id: `generated-${revision}`,
    name,
    version: '1.0.0',
    description,
    style,
    createdAt: new Date().toISOString(),
    revision,
    avatarFile,
  }

  await writeFile(avatarPath, bytes, { mode: 0o600, flag: 'wx' })
  try {
    await writeFile(metaTemp, `${JSON.stringify(metadata, null, 2)}\n`, { mode: 0o600, flag: 'wx' })
    await rename(metaTemp, metadataPath(dataDir))
  } catch (error) {
    await Promise.allSettled([rm(metaTemp, { force: true }), rm(avatarPath, { force: true })])
    throw error
  }
  if (previous?.avatarPath && previous.avatarPath !== avatarPath) {
    await rm(previous.avatarPath, { force: true }).catch(() => {})
  }
  return validMetadata(metadata, dataDir)
}

export async function resetStoredPet(dataDir) {
  const current = loadStoredPet(dataDir)
  await rm(metadataPath(dataDir), { force: true })
  if (current?.avatarPath) await rm(current.avatarPath, { force: true })
}

export async function readStoredAvatar(stored) {
  return readFile(stored.avatarPath)
}

