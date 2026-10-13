import type { RenderElement } from 'claude-code'
import { expect, test } from 'claude-code/testing'

const ENGINE_ROW_INDENT = 4
const DOT_COLUMN_WIDTH = 2
const ENGINE_DRAWING: RenderElement = { type: 'Text', props: {}, children: ['engine'] }

const BASH_ROW = {
  tool_use_id: 'toolu_1',
  tool: 'Bash',
  input: { command: 'grep -rn "needle" packages' },
  isRunning: false,
  isErrored: false,
  isInterrupted: false,
  output: { stdout: 'a\nb\nc', stderr: 'Shell cwd was reset to /repo', interrupted: false },
}

// The line's no-break space reads as the space the terminal paints.
function flattenedText(node: unknown): string {
  if (typeof node === 'string') return node.replaceAll(' ', ' ')
  if (typeof node !== 'object' || node === null) return ''
  const children = (node as { children?: unknown[] }).children ?? []
  return children.map(flattenedText).join('')
}

async function summaryLineOf(ui: { find: (query: { type: string; text: RegExp }) => Promise<unknown> }): Promise<string> {
  return flattenedText(await ui.find({ type: 'Text', text: /tool_call|\(/ }))
}

test('draws a tool call as one compact line with its meta', async $ => {
  const ui = await $.ui.mount({
    plugin: 'tool-lines',
    surface: 'terminal',
    component: 'ToolUse',
    props: BASH_ROW,
    viewport: { columns: 200, rows: 50 },
  })
  expect(await summaryLineOf(ui)).toBe('tool_call: Bash(grep -rn "needle" packages) - shell cwd was reset')
})

test('cuts a long input to 35 characters so the tool name and meta stay readable', async $ => {
  const long = { ...BASH_ROW, input: { command: 'echo ' + 'x'.repeat(400) } }
  const ui = await $.ui.mount({
    plugin: 'tool-lines',
    surface: 'terminal',
    component: 'ToolUse',
    props: long,
    viewport: { columns: 200, rows: 50 },
  })
  const clippedSubject = `echo ${'x'.repeat(29)}…`
  expect(await summaryLineOf(ui)).toBe(`tool_call: Bash(${clippedSubject}) - shell cwd was reset`)
})

test('wraps a very narrow terminal onto at most three rows', async $ => {
  const long = { ...BASH_ROW, input: { command: 'echo ' + 'x'.repeat(400) } }
  const columns = 26
  const ui = await $.ui.mount({
    plugin: 'tool-lines',
    surface: 'terminal',
    component: 'ToolUse',
    props: long,
    viewport: { columns, rows: 40 },
  })
  const rowWidth = columns - ENGINE_ROW_INDENT - DOT_COLUMN_WIDTH
  expect((await summaryLineOf(ui)).length).toBe(rowWidth * 3)
})

test('colors the dot yellow while running, green when done, red when errored', async $ => {
  const dotColor = async (props: typeof BASH_ROW) => {
    const ui = await $.ui.mount({
      plugin: 'tool-lines',
      surface: 'terminal',
      component: 'ToolUse',
      props,
      viewport: { columns: 200, rows: 50 },
    })
    return (await ui.find({ type: 'Text', text: '●' }))?.props.color
  }
  const running = { ...BASH_ROW, isRunning: true }
  const waitingItsTurn = { ...BASH_ROW, output: undefined } as never
  expect(await dotColor(running)).toBe('warning')
  expect(await dotColor(waitingItsTurn)).toBe('warning')
  expect(await dotColor(BASH_ROW)).toBe('success')
  expect(await dotColor({ ...BASH_ROW, isErrored: true })).toBe('error')
})

test('leaves running to the dot and marks errored calls', async $ => {
  const running = await $.ui.mount({
    plugin: 'tool-lines',
    surface: 'terminal',
    component: 'ToolUse',
    props: { ...BASH_ROW, isRunning: true, output: undefined },
    viewport: { columns: 200, rows: 50 },
  })
  expect(await summaryLineOf(running)).toBe('tool_call: Bash(grep -rn "needle" packages)')

  const failed = await $.ui.mount({
    plugin: 'tool-lines',
    surface: 'terminal',
    component: 'ToolUse',
    props: { ...BASH_ROW, isErrored: true, output: 'Exit code 1' },
    viewport: { columns: 200, rows: 50 },
  })
  expect(await summaryLineOf(failed)).toMatch(/\) - error$/)
})

test('names a file tool by its path', async $ => {
  const ui = await $.ui.mount({
    plugin: 'tool-lines',
    surface: 'terminal',
    component: 'ToolUse',
    props: {
      ...BASH_ROW,
      tool: 'Read',
      input: { file_path: '/notes.md', limit: 20 },
      output: { type: 'text' },
    },
    viewport: { columns: 200, rows: 50 },
  })
  expect(await summaryLineOf(ui)).toBe('tool_call: Read(/notes.md)')
})

test('pads below the prompt so the tool block starts apart from it', async ($, on) => {
  on('ui.render', () => ENGINE_DRAWING)
  const ui = await $.ui.mount({
    plugin: 'tool-lines',
    surface: 'terminal',
    component: 'UserMessage',
    props: { text: 'find the costs', origin: { kind: 'composer' }, isExpanded: false },
    viewport: { columns: 200, rows: 50 },
  } as never)
  const root = (await ui.drawn()) as { type: string; props?: { marginBottom?: number } }
  expect(root.type).toBe('Box')
  expect(root.props?.marginBottom).toBe(1)
  expect(flattenedText(root)).toBe('engine')
})

test('leaves tool rows to the engine while ctrl+o is open', async ($, on) => {
  on('ui.render', () => ENGINE_DRAWING)
  const mountOn = (component: 'UserMessage' | 'ToolUse' | 'ToolResult', props: object) =>
    $.ui.mount({ plugin: 'tool-lines', surface: 'terminal', component, props, viewport: { columns: 200, rows: 50 } } as never)
  const prompt = { text: 'find the costs', origin: { kind: 'composer' } }

  await mountOn('UserMessage', { ...prompt, isExpanded: true })
  expect(flattenedText(await (await mountOn('ToolUse', BASH_ROW)).drawn())).toBe('engine')
  const result = { tool_use_id: 'toolu_1', tool: 'Bash', output: BASH_ROW.output, isErrored: false }
  expect(flattenedText(await (await mountOn('ToolResult', result)).drawn())).toBe('engine')

  await mountOn('UserMessage', { ...prompt, isExpanded: false })
  expect(flattenedText(await (await mountOn('ToolUse', BASH_ROW)).drawn())).toMatch(/^●tool_call: Bash/)
})

test('unfolds a group of reads and searches into one row per call', async ($, on) => {
  let expansionAskedOfEngine: boolean | undefined
  on('ui.render', { component: 'ToolGroup' }, async ($, e) => {
    expansionAskedOfEngine = e.props.isExpanded
    const { Text } = $.ui.resolve(e)
    return Text({ children: ['engine'] })
  })
  await $.ui.mount({
    plugin: 'tool-lines',
    surface: 'terminal',
    component: 'ToolGroup',
    props: {
      calls: [{ tool: 'Read', input: { file_path: '/a.md' }, isRunning: false, isErrored: false, isInterrupted: false }],
      isActive: false,
      isExpanded: false,
    },
    viewport: { columns: 200, rows: 50 },
  })
  expect(expansionAskedOfEngine).toBe(true)
})

test('hides the result block', async $ => {
  const ui = await $.ui.mount({
    plugin: 'tool-lines',
    surface: 'terminal',
    component: 'ToolResult',
    props: { tool_use_id: 'toolu_1', tool: 'Bash', output: BASH_ROW.output, isErrored: false },
    viewport: { columns: 200, rows: 50 },
  })
  expect(flattenedText(await ui.drawn())).toBe('')
})

test('opens a grouped call on a press to show what the tool returned, and closes it on the next', async ($, on) => {
  on('ui.render', () => ENGINE_DRAWING)
  const row = { ...BASH_ROW, tool_use_id: 'toolu_grouped' }
  const returned = 'a\tb\nc\n<system-reminder>for the model only</system-reminder>'
  on('session.messages', () => ({
    value: [{ role: 'assistant', text: '', toolUses: [{ ...row, input: row.input, text: returned }] }],
  }))
  const viewport = { columns: 200, rows: 50 }
  await $.ui.mount({
    plugin: 'tool-lines',
    surface: 'terminal',
    component: 'ToolGroup',
    props: { calls: [row], isActive: false, isExpanded: false },
    viewport,
  })
  const ui = await $.ui.mount({
    plugin: 'tool-lines',
    surface: 'terminal',
    component: 'ToolUse',
    requestId: row.tool_use_id,
    props: row,
    viewport,
  })
  const resultRows = async () =>
    (await ui.findAll({ type: 'Button' })).filter(button => button.key?.startsWith('result-')).map(button => button.text)

  expect(await resultRows()).toEqual([])
  await ui.press({ key: 'summary' })
  expect(await resultRows()).toEqual(['a  b', 'c'])
  await ui.press({ key: 'result-1' })
  expect(await resultRows()).toEqual([])
})

test('opens a standalone call on a press to its whole input and the engine result beneath', async ($, on) => {
  on('ui.render', () => ENGINE_DRAWING)
  const path = `/repo/${'nested/'.repeat(8)}costs.ts`
  const row = { ...BASH_ROW, tool_use_id: 'toolu_edit', tool: 'Edit', input: { file_path: path }, output: {} }
  const viewport = { columns: 200, rows: 50 }
  const call = await $.ui.mount({
    plugin: 'tool-lines',
    surface: 'terminal',
    component: 'ToolUse',
    requestId: row.tool_use_id,
    props: row,
    viewport,
  })
  const result = await $.ui.mount({
    plugin: 'tool-lines',
    surface: 'terminal',
    component: 'ToolResult',
    requestId: row.tool_use_id,
    props: { tool_use_id: row.tool_use_id, tool: row.tool, output: row.output, isErrored: false },
    viewport,
  })

  expect(await summaryLineOf(call)).toMatch(/…\)$/)
  expect(flattenedText(await result.drawn())).toBe('')
  await call.press({ key: 'summary' })
  expect(await summaryLineOf(call)).toBe(`tool_call: Edit(${path})`)
  expect(flattenedText(await result.drawn())).toBe('engine')
})
