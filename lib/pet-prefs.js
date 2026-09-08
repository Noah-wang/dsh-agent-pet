import { readFileSync } from 'node:fs'
import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

const PREFS_FILE = 'prefs.json'

/** 界面偏好的出厂值。位置以窗口右下角为原点。 */
export const DEFAULT_PREFS = Object.freeze({
  right: 24,
  bottom: 24,
  hidden: false,
  showBubble: true,
  animations: true,
})

function boundedNumber(value, fallback, min, max) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback
}

function boolean(value, fallback) {
  return typeof value === 'boolean' ? value : fallback
}

/**
 * 校验并归一化一份偏好。位置上限取一个宽松的窗口尺寸——真正的边界钳制
 * 在客户端按实际视口做，这里只防住明显越界和非法值。
 */
export function normalizePrefs(value, previous = DEFAULT_PREFS) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  return {
    right: boundedNumber(source.right, previous.right, 0, 10_000),
    bottom: boundedNumber(source.bottom, previous.bottom, 0, 10_000),
    hidden: boolean(source.hidden, previous.hidden),
    showBubble: boolean(source.showBubble, previous.showBubble),
    animations: boolean(source.animations, previous.animations),
  }
}

export function loadPrefs(dataDir) {
  try {
    const stored = JSON.parse(readFileSync(join(dataDir, PREFS_FILE), 'utf8'))
    return {
      ...normalizePrefs(stored),
      revision: typeof stored?.revision === 'string' ? stored.revision : 'initial',
    }
  } catch {
    return { ...DEFAULT_PREFS, revision: 'initial' }
  }
}

/**
 * 原子写入。`revision` 每次变化都会换新值，客户端据此判断该不该采纳
 * 服务端的位置——否则轮询会把用户正在拖拽的位置反复覆盖回去。
 */
export async function savePrefs(dataDir, value, previous) {
  await mkdir(dataDir, { recursive: true, mode: 0o700 })
  const next = { ...normalizePrefs(value, previous), revision: randomUUID() }
  const temp = join(dataDir, `.prefs-${next.revision}.tmp`)
  try {
    await writeFile(temp, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600, flag: 'wx' })
    await rename(temp, join(dataDir, PREFS_FILE))
  } catch (error) {
    await rm(temp, { force: true }).catch(() => {})
    throw error
  }
  return next
}

export async function resetPrefs(dataDir) {
  return savePrefs(dataDir, DEFAULT_PREFS, DEFAULT_PREFS)
}
