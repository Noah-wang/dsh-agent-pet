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
  assert.match(prompt, /4 by 2 grid/)
  assert.match(prompt, /cloud fox/)
  assert.match(prompt, /Miu/)
  assert.match(prompt, /SAME character in every cell/)
  assert.match(prompt, /Fully transparent background/)
  assert.match(prompt, /no grid lines/)
  // 姿势必须按阅读顺序编号，否则导入时状态会错格。
  for (const [index, pose] of SHEET_POSES.entries()) {
    assert.match(prompt, new RegExp(`${index + 1}\\. ${pose}:`))
  }
})

test('every pet state maps to its own cell in the default sheet', () => {
  const layout = normalizeSheetLayout()
  assert.equal(layout.columns, SHEET_COLUMNS)
  assert.equal(layout.rows, SHEET_ROWS)
  const cells = PET_STATES.map((state) => cellForState(state, layout))
  assert.deepEqual(cells, [0, 1, 2, 3, 4, 5])
  assert.equal(new Set(cells).size, PET_STATES.length)
})

test('single-frame pets keep working and every state falls back to the only cell', () => {
  const layout = singleFrameLayout({ width: 1254, height: 1254 })
  assert.deepEqual({ columns: layout.columns, rows: layout.rows }, { columns: 1, rows: 1 })
  for (const state of PET_STATES) assert.equal(cellForState(state, layout), 0)
  assert.equal(cellForState('not-a-state', layout), 0)
})

test('imported layouts are clamped and never index past the grid', () => {
  assert.equal(normalizeSheetLayout({ columns: 99, rows: 0 }).columns, SHEET_COLUMNS)
  assert.equal(normalizeSheetLayout({ columns: 2.5, rows: 3 }).rows, 3)
  const small = normalizeSheetLayout({ columns: 2, rows: 1 })
  assert.equal(small.poses.length, 2)
  for (const state of PET_STATES) {
    const cell = cellForState(state, small)
    assert.ok(cell >= 0 && cell < 2, `${state} escaped a 2x1 grid: ${cell}`)
  }
  assert.deepEqual(normalizeSheetLayout({}, { width: 1536, height: 1024 }).width, 1536)
})

test('the exported instructions describe the same grid the prompt asks for', () => {
  const instructions = sheetInstructions()
  assert.equal(instructions.columns, SHEET_COLUMNS)
  assert.equal(instructions.rows, SHEET_ROWS)
  assert.deepEqual(instructions.poses, [...SHEET_POSES])
  assert.ok(instructions.notes.length > 0)
})
