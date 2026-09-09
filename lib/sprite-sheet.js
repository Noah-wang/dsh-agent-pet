import { PET_STATES } from './state.js'

/**
 * 逐帧动画精灵表：**一行是一个状态的循环动画，一行里的每一格是一帧**。
 * 横轴是时间，纵轴是状态——这和「一格一个静态姿势」的老布局是两回事，
 * 元数据里的 `kind` 用来区分，老形象仍按 'poses' 渲染。
 */
export const SHEET_COLUMNS = 6  // 每个动画的帧数
export const SHEET_ROWS = 8     // 状态数，与 SHEET_POSES 一一对应

/** 一帧停留多少毫秒。6 帧 × 130ms ≈ 0.8 秒一轮，接近手绘循环的手感。 */
export const FRAME_DURATION_MS = 130

/**
 * 行顺序 = 从上到下。前六个对应 PET_STATES；resting 留给「额度耗尽」，
 * greeting 留给擦肩打招呼，两者暂时没有触发来源，但先占好行，
 * 避免以后加状态要重新生成形象。
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

/**
 * 每一行描述的是一段**来回往复的运动**，不是一个静止姿势。
 *
 * 写成 A→B→A 的往复是刻意的：这种动作天然首尾相接，不需要额外交代
 * 循环怎么闭合。实测过更啰嗦的逐帧编排（"frames 1-3 …, frames 4-6 …"），
 * 模型反而更不听话——角色漂移翻倍，而且六帧里只有两帧真在做动作。
 * 对这个模型，简短 > 精确。
 */
const MOTION_BRIEFS = Object.freeze({
  idle: 'a calm breathing loop: the body rises and settles back down again, ears and tail drifting slightly',
  thinking: 'a pondering loop: one paw taps in to the chin and draws back out again, the head tilting up and back down',
  running_tool: 'a side-view run cycle seen from the same side throughout, the legs cycling back to where they started',
  waiting_approval: 'a waiting loop facing the viewer: the head tilts to one side and back again, with one blink',
  // 大幅度腾空实测画不连贯：模型给出的是忽大忽小的六帧，不是一条弧线。
  // 改成原地小幅庆祝，把纵向位移压到和呼吸同量级。
  done: 'a cheering loop: both front paws pump up and down while the body bobs in place, feet staying on the ground',
  error: 'a dejected loop: the shoulders and head sag down and lift part way back up again',
  resting: 'a sleeping loop: the curled body swells and shrinks back again with slow breathing',
  greeting: 'a waving loop: one raised front paw swings across to the other side and back again',
})

export const SHEET_SIZE = '1024x1536'

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
    .map((pose, index) => `${index + 1}. ${pose}: ${MOTION_BRIEFS[pose]}`)
    .join('\n')
  return [
    'A frame-by-frame character animation sprite sheet of ONE single original character, '
      + `arranged in a strict ${SHEET_COLUMNS} by ${SHEET_ROWS} grid `
      + `(${SHEET_COLUMNS} columns, ${SHEET_ROWS} rows).`,
    '',
    `Character brief: ${description}`,
    STYLE_BRIEFS[style] || STYLE_BRIEFS.auto,
    '',
    // 不写这段，模型会把一行画成六个不同姿势，而不是一个动作的六帧。
    'HOW TO READ THE GRID: each ROW is one complete looping animation, read left to right. '
      + `The ${SHEET_COLUMNS} cells in a row are CONSECUTIVE FRAMES of that single motion — not `
      + `${SHEET_COLUMNS} different poses. Neighbouring frames in a row must differ only slightly, `
      + 'the way adjacent frames of a hand-drawn animation do.',
    // 循环是首尾相接，不是首尾相同——相同会让那一帧显示两倍时长，反而卡一拍。
    `The row plays on repeat, frame ${SHEET_COLUMNS} straight back to frame 1, so frame ${SHEET_COLUMNS} `
      + 'is the step just before frame 1 — close to it, never an identical copy of it.',
    '',
    'Rows, top to bottom:',
    listing,
    '',
    'CRITICAL: it is the SAME character in every single cell. Identical design, identical colors, '
      + 'identical markings, identical proportions, identical art style throughout. Keep the ear shape, '
      + 'head shape, body proportions and every accessory exactly the same in all cells.',
    // 位置漂移比首尾不接更毁流畅度：帧是原地播放的，任何位移都读成瞬移。
    'Every frame is a complete full body drawn at EXACTLY the same scale, with the character’s head '
      + 'the same size and in the same place in every cell. These frames are played in place, so any '
      + 'drift in position or size reads as the character teleporting. Center each frame in its own '
      + 'invisible cell with generous margin so no two frames touch.',
    'A single frame must stay readable when shrunk to 128 by 128 pixels.',
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
    frames: SHEET_COLUMNS,
    notes: [
      `把提示词粘贴到任意生图 AI，要求输出 ${SHEET_COLUMNS}×${SHEET_ROWS} 的精灵表：`
        + `${SHEET_ROWS} 行状态，每行 ${SHEET_COLUMNS} 帧。`,
      '一行是一个动作的连续帧，不是一行六个不同姿势——这一点最容易被模型理解错。',
      '必须是透明背景的 PNG；带白底或棋盘格底的图导入后会有底色。',
      '行的顺序不能乱，否则状态会对不上。',
      '如果那个 AI 出的网格不一样也没关系——导入时会从图里的透明间隔自己数出行列。',
    ],
  }
}

function positiveInteger(value, fallback, max) {
  const number = Number(value)
  return Number.isInteger(number) && number >= 1 && number <= max ? number : fallback
}

/**
 * 两种版式：
 *   'frames' — 一行一个状态，一行里的每格是一帧（当前生成的版式）
 *   'poses'  — 一格一个静态姿势（0.3/0.4 生成的老形象，以及网格不匹配的导入图）
 * 老数据里没有 `kind`，按网格反推：只有正好 6×8 才当动画表。
 */
function layoutKind(value, columns, rows) {
  if (value === 'frames' || value === 'poses') return value
  return columns === SHEET_COLUMNS && rows === SHEET_ROWS ? 'frames' : 'poses'
}

/** 校验并归一化精灵表版式。导入的图可能来自任意 AI，网格未必是 6×8。 */
export function normalizeSheetLayout(value, { width, height } = {}) {
  const columns = positiveInteger(value?.columns, SHEET_COLUMNS, 12)
  const rows = positiveInteger(value?.rows, SHEET_ROWS, 12)
  const kind = layoutKind(value?.kind, columns, rows)
  // 'frames' 版式一行一个状态，所以状态数受行数限制；'poses' 版式受总格数限制。
  const capacity = kind === 'frames' ? rows : columns * rows
  return {
    columns,
    rows,
    kind,
    frames: kind === 'frames' ? columns : 1,
    poses: SHEET_POSES.slice(0, Math.min(SHEET_POSES.length, capacity)),
    ...(Number.isInteger(width) && width > 0 ? { width } : {}),
    ...(Number.isInteger(height) && height > 0 ? { height } : {}),
  }
}

/** 单图宠物（默认 pet.svg、老数据、用户只上传了一张图）等价于 1×1。 */
export function singleFrameLayout({ width, height } = {}) {
  return normalizeSheetLayout({ columns: 1, rows: 1, kind: 'poses' }, { width, height })
}

/**
 * PetState → 格子坐标 `{ column, row, frames }`。
 * 'frames' 版式里状态决定行、动画推进列；'poses' 版式里状态直接决定格子。
 * 找不到对应状态时回落到 idle，再回落到第一格——1×1 的老形象也能渲染。
 */
export function cellForState(state, layout) {
  const columns = Math.max(1, layout?.columns || 1)
  const rows = Math.max(1, layout?.rows || 1)
  const poses = Array.isArray(layout?.poses) ? layout.poses : SHEET_POSES
  const wanted = PET_STATES.includes(state) ? state : 'idle'

  let index = poses.indexOf(wanted)
  if (index < 0) index = poses.indexOf('idle')

  if (layout?.kind === 'frames') {
    const row = index >= 0 && index < rows ? index : 0
    return { column: 0, row, frames: columns }
  }
  const total = columns * rows
  const cell = index >= 0 && index < total ? index : 0
  return { column: cell % columns, row: Math.floor(cell / columns), frames: 1 }
}
