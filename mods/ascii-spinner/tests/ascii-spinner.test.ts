import type { RenderElement } from 'claude-code'
import { expect, test, type TestBody } from 'claude-code/testing'

type Engine = Parameters<TestBody>[0]

const ENGINE_DRAWING: RenderElement = { type: 'Text', props: {}, children: ['engine'] }
const SPINNER = { word: 'Orchestrating', message: null, suffix: '…', mode: 'thinking' } as const
const STEP_MS = 400

function flattenedText(node: unknown): string {
  if (typeof node === 'string') return node
  if (typeof node !== 'object' || node === null) return ''
  const children = (node as { children?: unknown[] }).children ?? []
  return children.map(flattenedText).join('')
}

async function mountWorm($: Engine, columns = 120, overrides: { message?: string; suffix?: string } = {}) {
  const ui = await $.ui.mount({
    plugin: 'ascii-spinner',
    surface: 'terminal',
    component: 'Spinner',
    props: { ...SPINNER, ...overrides },
    viewport: { columns, rows: 40 },
  })
  const line = async () => flattenedText(await ui.drawn({ in: 'weaveworm' }))
  const tape = async () => (await line()).slice(2, -2)
  return { ui, line, tape }
}

test('draws one bracketed row of silk, with no words, time, tokens or effort', async $ => {
  const { line } = await mountWorm($, 120, { message: 'Compacting conversation…', suffix: '' })
  expect(await line()).toMatch(/^◤ [╳┼╪▗▄▀]{24} ◢$/)
})

test('crawls a cell per arch, weaving a new layer behind and eating the old one ahead', async $ => {
  const { ui, tape } = await mountWorm($)
  await ui.advance(STEP_MS * 12)
  const tail = (await tape()).indexOf('▗')
  await ui.advance(STEP_MS * 5)
  const silk = await tape()
  expect(silk.indexOf('▗')).toBe(tail + 5)
  expect(silk.slice(0, tail + 5)).toMatch(/^┼+$/)
  expect(silk.slice(tail + 13)).toMatch(/^╳+$/)
})

test('shortens the silk to fit a narrow terminal', async $ => {
  const tapeCells = async (columns: number) => (await (await mountWorm($, columns)).tape()).length
  expect(await tapeCells(20)).toBe(16)
  expect(await tapeCells(10)).toBe(14)
})

test('leaves the desktop row to the engine', async ($, on) => {
  on('ui.render', { component: 'Spinner' }, () => ENGINE_DRAWING)
  const ui = await $.ui.mount({ plugin: 'ascii-spinner', surface: 'desktop', component: 'Spinner', props: SPINNER })
  expect(flattenedText(await ui.drawn())).toBe('engine')
})
