import { PET_STATES } from './state.js'

export const SHEET_COLUMNS = 4
export const SHEET_ROWS = 2

/**
 * 精灵表的姿势顺序 = 网格里从左到右、从上到下的阅读顺序。
 * 前六个对应 PET_STATES；resting 留给「额度耗尽」，greeting 留给擦肩打招呼，
 * 两者暂时没有触发来源，但先占好格子，避免以后重新生成所有形象。
 */
export const SHEET_POSES = Object.freeze([
  'idle',
  'thinking',
  'running_tool',
  'waiting_approval',
  'done',
  'error',
  'resting',
  'greeting',
])

const POSE_BRIEFS = Object.freeze({
  idle: 'standing relaxed in three-quarter view, body angled away from the viewer, '
    + 'looking off to the side, calm neutral expression, tail down',
  thinking: 'head tilted upward, one paw at its chin, pondering, eyes looking up',
  running_tool: 'running fast in profile, legs mid-stride, leaning forward, determined',
  waiting_approval: 'sitting upright squarely facing the viewer, both front paws placed together in front, '
    + 'ears perked straight up, head tilted, staring directly at you with big expectant eyes, '
    + 'clearly asking for permission',
  done: 'jumping up in celebration, both arms raised, eyes closed happily',
  error: 'sitting with its head hung low and shoulders slumped, one paw touching the ground, '
    + 'sad downturned eyes, a single sweat drop; the EARS KEEP THE EXACT SAME SHAPE AND UPRIGHT '
    + 'SET as in every other cell, only the head is lowered',
  resting: 'lying down curled up asleep, eyes closed, peaceful',
  greeting: 'waving one front paw high in greeting, friendly open smile, facing the viewer',
})

export const SHEET_SIZE = '1536x1024'

const STYLE_BRIEFS = Object.freeze({
  auto: 'Choose a cohesive, charming desktop mascot style.',
  pixel: 'Crisp modern pixel-art mascot with a limited harmonious palette and clean silhouette.',
  sticker: 'Polished sticker mascot with a bold readable outline and compact rounded forms.',
  plush: 'Soft handmade plush mascot with simple tactile materials and a readable silhouette.',
  'flat-vector': 'Clean flat-vector mascot with rounded geometric shapes and restrained details.',
  '3d-toy': 'Small premium 3D toy mascot with soft studio materials and compact proportions.',
})

/**
 * 生成精灵表提示词。这段文本同时用于两条路径：
 *   1. 插件自己调图片服务
 *   2. 用户复制到别的生图 AI 里手动生成，再把图导回来
 * 所以它必须是自包含的——不能依赖任何插件侧的上下文。
 */
export function buildSheetPrompt({ name, description, style } = {}) {
  const listing = SHEET_POSES
    .map((pose, index) => `${index + 1}. ${pose}: ${POSE_BRIEFS[pose]}`)
    .join('\n')
  return [
    `A character sprite sheet of ONE single original character, arranged in a strict `
      + `${SHEET_COLUMNS} by ${SHEET_ROWS} grid (${SHEET_COLUMNS} columns, ${SHEET_ROWS} rows), `
      + `${SHEET_POSES.length} poses total.`,
    '',
    `Character brief: ${description}`,
    STYLE_BRIEFS[style] || STYLE_BRIEFS.auto,
    '',
    'CRITICAL: it is the SAME character in every cell. Identical design, identical colors, '
      + 'identical markings, identical proportions, identical art style in all cells. '
      + 'Only the pose and the facial expression change between cells.',
    'Keep the ear shape, head shape, body proportions, and every accessory or marking '
      + 'exactly the same in all cells, so the silhouette stays recognizable as one creature.',
    '',
    'Poses, in reading order (left to right, then top to bottom):',
    listing,
    '',
    'Every pose is a complete full body at EXACTLY the same scale: the character’s head must be '
      + 'the same size in every cell, and no pose may be drawn larger or smaller than the others. '
      + 'Center each pose inside its own invisible cell with generous empty margin '
      + 'so that no two poses touch or overlap.',
    'Make each pose clearly distinguishable from the others at a glance — '
      + 'no two cells may read as the same pose.',
    'The silhouette and face must stay readable when a single pose is shrunk to 128 by 128 pixels.',
    '',
    'Fully transparent background. Absolutely no grid lines, no borders, no frames, no cell dividers, '
      + 'no background panel, no labels, no text, no numbers, no captions, no watermark, '
      + 'no drop shadows, no ground plane, no scenery.',
    ...(name ? ['', `The character is named ${JSON.stringify(name)}.`] : []),
  ].join('\n')
}

/** 给用户看的手动生成说明，跟着提示词一起导出。 */
export function sheetInstructions() {
  return {
    columns: SHEET_COLUMNS,
    rows: SHEET_ROWS,
    poses: [...SHEET_POSES],
    size: SHEET_SIZE,
    notes: [
      `把提示词粘贴到任意生图 AI，要求输出 ${SHEET_COLUMNS}×${SHEET_ROWS} 共 ${SHEET_POSES.length} 格的精灵表。`,
      '必须是透明背景的 PNG；带白底或棋盘格底的图导入后会有底色。',
      '姿势顺序不能乱，否则状态会对不上格子。',
      '如果那个 AI 只能出别的网格，导入时把列数和行数改成实际值。',
    ],
  }
}

function positiveInteger(value, fallback, max) {
  const number = Number(value)
  return Number.isInteger(number) && number >= 1 && number <= max ? number : fallback
}

/**
 * 校验并归一化精灵表版式。导入的图可能来自任意 AI，网格未必是 4×2。
 */
export function normalizeSheetLayout(value, { width, height } = {}) {
  const columns = positiveInteger(value?.columns, SHEET_COLUMNS, 8)
  const rows = positiveInteger(value?.rows, SHEET_ROWS, 8)
  const poses = columns === SHEET_COLUMNS && rows === SHEET_ROWS
    ? [...SHEET_POSES]
    : SHEET_POSES.slice(0, columns * rows)
  return {
    columns,
    rows,
    poses,
    ...(Number.isInteger(width) && width > 0 ? { width } : {}),
    ...(Number.isInteger(height) && height > 0 ? { height } : {}),
  }
}

/** 单图宠物（老数据或用户只上传了一张图）等价于 1×1 的精灵表。 */
export function singleFrameLayout({ width, height } = {}) {
  return normalizeSheetLayout({ columns: 1, rows: 1 }, { width, height })
}

/**
 * PetState → 格子下标。没有对应格子时回落到 idle，再回落到第 0 格，
 * 这样 1×1 的老形象也能正常渲染。
 */
export function cellForState(state, layout) {
  const poses = Array.isArray(layout?.poses) ? layout.poses : SHEET_POSES
  const total = Math.max(1, (layout?.columns || 1) * (layout?.rows || 1))
  const wanted = PET_STATES.includes(state) ? state : 'idle'
  const index = poses.indexOf(wanted)
  if (index >= 0 && index < total) return index
  const fallback = poses.indexOf('idle')
  return fallback >= 0 && fallback < total ? fallback : 0
}
