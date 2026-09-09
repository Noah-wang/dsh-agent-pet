import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildSheetPrompt,
  cellForState,
  normalizeSheetLayout,
  SHEET_COLUMNS,
  SHEET_POSES,
  SHEET_ROWS,
  sheetInstructions,
  singleFrameLayout,
} from '../lib/sprite-sheet.js'
import { PET_STATES } from '../lib/state.js'

test('the sheet prompt is self-contained enough to paste into any image AI', () => {
  const prompt = buildSheetPrompt({ name: 'Miu', description: 'a small cloud fox', style: 'plush' })
  assert.match(prompt, /6 by 8 grid/)
  // 少了这句，模型会把一行画成六个不同姿势而不是一个动作的六帧。
  assert.match(prompt, /CONSECUTIVE FRAMES/)
  assert.match(prompt, /each ROW is one complete looping animation/)
  assert.match(prompt, /cloud fox/)
  assert.match(prompt, /Miu/)
  assert.match(prompt, /SAME character in every single cell/)
  assert.match(prompt, /Fully transparent background/)
  assert.match(prompt, /no grid lines/)
  // 姿势必须按阅读顺序编号，否则导入时状态会错格。
  for (const [index, pose] of SHEET_POSES.entries()) {
    assert.match(prompt, new RegExp(`${index + 1}\\. ${pose}:`))
  }
})

test('every pet state gets its own animation row in the default sheet', () => {
  const layout = normalizeSheetLayout()
  assert.equal(layout.kind, 'frames')
  assert.equal(layout.columns, SHEET_COLUMNS)
  assert.equal(layout.rows, SHEET_ROWS)
  assert.equal(layout.frames, SHEET_COLUMNS)
  const rows = PET_STATES.map((state) => cellForState(state, layout).row)
  assert.deepEqual(rows, [0, 1, 2, 3, 4, 5], 'each state owns one row')
  assert.equal(new Set(rows).size, PET_STATES.length)
  // 动画从每行第一格起步，帧数等于列数。
  for (const state of PET_STATES) {
    const cell = cellForState(state, layout)
    assert.equal(cell.column, 0)
    assert.equal(cell.frames, SHEET_COLUMNS)
  }
})

test('the older pose grid still resolves one cell per state', () => {
  const layout = normalizeSheetLayout({ columns: 4, rows: 2 })
  assert.equal(layout.kind, 'poses', '4x2 is not the animation layout')
  assert.equal(layout.frames, 1, 'pose grids never animate')
  const cells = PET_STATES.map((state) => cellForState(state, layout))
  assert.deepEqual(cells.map((c) => c.row * 4 + c.column), [0, 1, 2, 3, 4, 5])
})

test('single-frame pets keep working and every state falls back to the only cell', () => {
  const layout = singleFrameLayout({ width: 1254, height: 1254 })
  assert.deepEqual({ columns: layout.columns, rows: layout.rows }, { columns: 1, rows: 1 })
  assert.equal(layout.frames, 1)
  for (const state of PET_STATES) {
    assert.deepEqual(cellForState(state, layout), { column: 0, row: 0, frames: 1 })
  }
  assert.deepEqual(cellForState('not-a-state', layout), { column: 0, row: 0, frames: 1 })
})

test('imported layouts are clamped and never index past the grid', () => {
  assert.equal(normalizeSheetLayout({ columns: 99, rows: 0 }).columns, SHEET_COLUMNS)
  assert.equal(normalizeSheetLayout({ columns: 2.5, rows: 3 }).rows, 3)
  const small = normalizeSheetLayout({ columns: 2, rows: 1 })
  assert.equal(small.poses.length, 2)
  for (const state of PET_STATES) {
    const cell = cellForState(state, small)
    assert.ok(cell.column >= 0 && cell.column < 2, `${state} escaped a 2x1 grid`)
    assert.equal(cell.row, 0)
  }
  assert.deepEqual(normalizeSheetLayout({}, { width: 1024, height: 1536 }).width, 1024)
})

test('the exported instructions describe the same grid the prompt asks for', () => {
  const instructions = sheetInstructions()
  assert.equal(instructions.columns, SHEET_COLUMNS)
  assert.equal(instructions.rows, SHEET_ROWS)
  assert.deepEqual(instructions.poses, [...SHEET_POSES])
  assert.equal(instructions.frames, SHEET_COLUMNS)
  assert.ok(instructions.notes.length > 0)
})
