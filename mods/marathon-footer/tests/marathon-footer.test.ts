import type { RenderElement, RenderSurface } from 'claude-code'
import { expect, test, type Engine } from 'claude-code/testing'

const ENGINE_DRAWING: RenderElement = { type: 'Text', props: {}, children: ['engine'] }
const AUTO_MODE_HINT = '(shift+tab to cycle) · ← 1 agent'

type Drawing = { surface?: RenderSurface; isFullscreen?: boolean }

function flattenedText(node: unknown): string {
  if (typeof node === 'string') return node
  if (typeof node !== 'object' || node === null) return ''
  const children = (node as { children?: unknown[] }).children ?? []
  return children.map(flattenedText).join('')
}

async function drawnHint($: Engine, hint: string, { surface = 'terminal', isFullscreen = true }: Drawing = {}) {
  const ui = await $.ui.mount({
    plugin: 'marathon-footer',
    surface,
    component: 'PromptHint',
    props: { isDraft: false, isWorking: false, hint },
    viewport: { columns: 120, rows: 40, isFullscreen },
  })
  const drawn = await ui.drawn()
  return { ui, drawn, text: flattenedText(drawn) }
}

test('reads the hints as volt keys, dim actions and // separators after the mode label', async ($, on) => {
  on('ui.render', () => ENGINE_DRAWING)
  const { ui, drawn, text } = await drawnHint($, AUTO_MODE_HINT)
  expect(text).toBe('⇧⇥ CYCLE  //  ← 1 AGENT')
  expect((await ui.find({ type: 'Text', text: /^⇧⇥$/ }))?.props.color).toBe('#C8FF00')
  expect(drawn?.type === 'Text' ? drawn.props?.wrap : undefined).toBe('truncate-end')
})

test('spells modifier keys as glyphs and named keys in caps', async ($, on) => {
  on('ui.render', () => ENGINE_DRAWING)
  expect((await drawnHint($, 'ctrl+t to hide tasks · ← for agents')).text).toBe('⌃T HIDE TASKS  //  ← AGENTS')
  expect((await drawnHint($, 'esc to interrupt')).text).toBe('ESC INTERRUPT')
  expect((await drawnHint($, '? for shortcuts')).text).toBe('? SHORTCUTS')
})

test('never repeats the mode label the hint sometimes carries', async ($, on) => {
  on('ui.render', () => ENGINE_DRAWING)
  expect((await drawnHint($, 'plan mode on (shift+tab to cycle) · ← 1 agent')).text).toBe('⇧⇥ CYCLE  //  ← 1 AGENT')
  expect((await drawnHint($, 'manual mode on · ← 1 agent')).text).toBe('← 1 AGENT')
})

test('hands notices and empty lines back to the engine', async ($, on) => {
  on('ui.render', () => ENGINE_DRAWING)
  for (const hint of ['Press Ctrl-C again to exit', '', '(shift+tab to cycle) · Press Ctrl-C again to exit']) {
    expect((await drawnHint($, hint)).text).toBe('engine')
  }
})

test('draws on both terminal layouts and leaves other surfaces alone', async ($, on) => {
  on('ui.render', () => ENGINE_DRAWING)
  expect((await drawnHint($, AUTO_MODE_HINT, { isFullscreen: false })).text).toBe('⇧⇥ CYCLE  //  ← 1 AGENT')
  expect((await drawnHint($, AUTO_MODE_HINT, { surface: 'desktop' })).text).toBe('engine')
})
