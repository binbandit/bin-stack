import { atom, memberOf, read, update } from 'claude-code'
import type { Register, SessionMessage } from 'claude-code'

const ENGINE_ROW_INDENT = 4
const DOT_COLUMN_WIDTH = 2
const MIN_TEXT_WIDTH = 20
const MIN_LINE_CHARS = 120
const MAX_LINE_ROWS = 3
const MAX_SUBJECT_CHARS = 35
const UNMEASURED_TERMINAL_COLUMNS = 120
// No-break space: a long path wraps inside itself instead of leaving the prefix alone on its row.
const TOOL_CALL_PREFIX = 'tool_call:\u00a0'
const RESULT_GUTTER_WIDTH = 3
const MAX_RESULT_LINES = 40
const MAX_RESULT_LINE_CHARS = 500

type ToolRow = {
  tool: string
  input: unknown
  output?: unknown
  isRunning: boolean
  isErrored: boolean
  isInterrupted: boolean
}

const SUBJECT_KEYS_BY_PRIORITY = [
  'command',
  'file_path',
  'notebook_path',
  'pattern',
  'url',
  'query',
  'skill',
  'description',
  'path',
  'action',
  'prompt',
]

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

const asOneLine = (text: string) => text.replace(/\s+/g, ' ').trim()

function subjectOf(input: unknown): string {
  if (!isRecord(input)) return ''
  const subjectKey = SUBJECT_KEYS_BY_PRIORITY.find(key => typeof input[key] === 'string' && input[key] !== '')
  if (subjectKey !== undefined) return asOneLine(String(input[subjectKey]))
  return Object.keys(input).length === 0 ? '' : asOneLine(JSON.stringify(input))
}

const resultField = (row: ToolRow, name: string): unknown => (isRecord(row.output) ? row.output[name] : undefined)

const printedOutput = (row: ToolRow) => `${resultField(row, 'stdout') ?? ''}\n${resultField(row, 'stderr') ?? ''}`

type MetaProbe = (row: ToolRow) => string | undefined

const META_PROBES: MetaProbe[] = [
  row => (row.isInterrupted ? 'interrupted' : undefined),
  row => (row.isErrored && !row.isInterrupted ? 'error' : undefined),
  row => (resultField(row, 'backgroundTaskId') !== undefined ? 'background' : undefined),
  row => (resultField(row, 'timedOutAfterMs') !== undefined ? 'timed out' : undefined),
  row => (/Shell cwd was reset/.test(printedOutput(row)) ? 'shell cwd was reset' : undefined),
  row => {
    const note = resultField(row, 'returnCodeInterpretation')
    return typeof note === 'string' && note !== '' ? note : undefined
  },
]

type ToolLine = { tool: string; subject: string; meta: string }

function clip(text: string, room: number): string {
  if (text.length <= room) return text
  return room <= 1 ? '…' : text.slice(0, room - 1) + '…'
}

// An open call shows its whole subject; a closed one cuts it so the tool name and meta stay readable.
function lineFor(row: ToolRow, columns: number, isOpen: boolean): ToolLine {
  const meta = META_PROBES.map(probe => probe(row))
    .filter(note => note !== undefined)
    .join(', ')
  const subject = subjectOf(row.input)
  if (isOpen) return { tool: row.tool, subject, meta }
  const textWidth = Math.max(columns - ENGINE_ROW_INDENT - DOT_COLUMN_WIDTH, MIN_TEXT_WIDTH)
  const lineBudget = Math.min(Math.max(textWidth, MIN_LINE_CHARS), textWidth * MAX_LINE_ROWS)
  const frameChars = `${TOOL_CALL_PREFIX}${row.tool}()`.length + (meta === '' ? 0 : ` - ${meta}`.length)
  const subjectRoom = Math.min(MAX_SUBJECT_CHARS, lineBudget - frameChars)
  return { tool: row.tool, subject: clip(subject, subjectRoom), meta }
}

const hasFailed = (row: ToolRow) => row.isErrored || row.isInterrupted

const hasFinished = (row: ToolRow) => !row.isRunning && row.output !== undefined

function dotColor(row: ToolRow): 'error' | 'success' | 'warning' {
  if (hasFailed(row)) return 'error'
  return hasFinished(row) ? 'success' : 'warning'
}

// What the model read back is the one result text every tool has, MCP and plugin tools included.
// An answered call's text never changes, so it is looked up in the transcript once.
const answeredTextById = new Map<string, string>()

async function answeredTextOf(id: string, transcript: () => Promise<SessionMessage[]>): Promise<string | undefined> {
  const cached = answeredTextById.get(id)
  if (cached !== undefined) return cached
  const toolUses = (await transcript()).flatMap(message => message.toolUses)
  const text = toolUses.find(use => use.tool_use_id === id)?.text
  if (text !== undefined) answeredTextById.set(id, text)
  return text
}

// A call the main transcript does not hold (a subagent's, or one past its newest entries) shows its stored result.
function storedTextOf(row: ToolRow): string {
  if (row.output === undefined) return ''
  return typeof row.output === 'string' ? row.output : JSON.stringify(row.output, null, 2)
}

const SYSTEM_REMINDER = /<system-reminder>[\s\S]*?<\/system-reminder>/g
// Text refuses every control character but tab and newline, so colour codes and carriage returns go.
const ANSI_ESCAPE = /\u001b\[[0-?]*[ -/]*[@-~]/g
const CONTROL_CHARACTER = /[\u0000-\u0008\u000b-\u001f\u007f]/g

function resultLinesOf(text: string): string[] {
  const lines = text
    .replace(SYSTEM_REMINDER, '')
    .replace(ANSI_ESCAPE, '')
    .replace(CONTROL_CHARACTER, '')
    .replaceAll('\t', '  ')
    .trimEnd()
    .split('\n')
    .map(line => clip(line, MAX_RESULT_LINE_CHARS))
  if (lines.length <= MAX_RESULT_LINES) return lines
  const shown = lines.slice(0, MAX_RESULT_LINES - 1)
  return [...shown, `… +${lines.length - shown.length} lines`]
}

let isTranscriptExpanded = false

const isCompact = (surface: string) => surface === 'terminal' && !isTranscriptExpanded

// Calls the engine groups draw their result inside their own row; any other call has a ToolResult row.
const groupedCallIds = new Set<string>()

// The theme's dim grey as a colour: the engine lifts dimColor across a whole group while the pointer is on it.
const FAINT = { color: 'inactive' }

const isOpenCall = atom({ plugin: 'tool-lines', key: 'isOpen' } as const, false)

export const register: Register = on => {
  on('ui.render', { component: 'UserMessage', props: { origin: { kind: 'composer' } } }, async ($, e, next) => {
    if (e.surface === 'terminal' && e.props.isExpanded !== isTranscriptExpanded) {
      isTranscriptExpanded = e.props.isExpanded
      $.ui.invalidate('ui.render')
    }
    if (!isCompact(e.surface)) return next(e)
    const { Box } = $.ui.resolve(e)
    return Box({ flexDirection: 'column', marginBottom: 1, children: [await next(e)] })
  })

  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    if (!isCompact(e.surface)) return next(e)
    const { Box, Button, Text } = $.ui.resolve(e)
    const isOpenHere = memberOf(isOpenCall, e)
    const isOpen = await read($, isOpenHere)
    const toggle = () => void update($, isOpenHere, wasOpen => !wasOpen)
    const line = lineFor(e.props, e.viewport?.columns ?? UNMEASURED_TERMINAL_COLUMNS, isOpen)
    const metaStyle = e.props.isErrored ? { color: 'error' } : FAINT

    // Every glyph of a row is a Button: a click outside one reaches the engine's group toggle, which shifts the rows.
    const dotColumn = Box({
      minWidth: DOT_COLUMN_WIDTH,
      flexShrink: 0,
      children: [
        Button({
          key: 'dot',
          plain: true,
          onPress: toggle,
          children: [Text({ color: dotColor(e.props), children: ['●'] })],
        }),
      ],
    })
    const summary = Button({
      key: 'summary',
      plain: true,
      onPress: toggle,
      children: [
        Text({
          wrap: 'wrap',
          children: [
            Text({ ...FAINT, children: [TOOL_CALL_PREFIX] }),
            Text({ bold: true, children: [line.tool] }),
            `(${line.subject})`,
            ...(line.meta === '' ? [] : [Text({ ...metaStyle, children: [` - ${line.meta}`] })]),
          ],
        }),
      ],
    })

    const hasInlineResult = isOpen && groupedCallIds.has(e.props.tool_use_id)
    const resultText = hasInlineResult
      ? ((await answeredTextOf(e.props.tool_use_id, () => $.session.messages())) ?? storedTextOf(e.props))
      : ''
    const gutter = Button({ key: 'gutter', plain: true, onPress: toggle, children: [Text({ ...FAINT, children: ['⎿'] })] })
    // One Button per line: the pointer inverts only the first row of a Button whose text holds a newline.
    const resultRows = (resultText === '' ? [] : resultLinesOf(resultText)).map((resultLine, index) =>
      Box({
        flexDirection: 'row',
        children: [
          Box({ minWidth: RESULT_GUTTER_WIDTH, flexShrink: 0, children: index === 0 ? [gutter] : [] }),
          Box({
            flexShrink: 1,
            children: [
              Button({
                key: `result-${index}`,
                plain: true,
                onPress: toggle,
                // A blank line still takes its row.
                children: [Text({ ...FAINT, wrap: 'wrap', children: [resultLine === '' ? ' ' : resultLine] })],
              }),
            ],
          }),
        ],
      }),
    )

    const textColumn = Box({ flexShrink: 1, flexDirection: 'column', children: [summary, ...resultRows] })
    return Box({ flexDirection: 'row', marginLeft: 2, children: [dotColumn, textColumn] })
  })

  on('ui.render', { component: 'ToolGroup' }, async ($, e, next) => {
    if (!isCompact(e.surface)) return next(e)
    for (const call of e.props.calls) {
      if (call.tool_use_id !== undefined) groupedCallIds.add(call.tool_use_id)
    }
    const unfoldedGroup = { ...e.props, isExpanded: true }
    return next({ ...e, props: unfoldedGroup })
  })

  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    if (!isCompact(e.surface)) return next(e)
    const { Box } = $.ui.resolve(e)
    if (!(await read($, memberOf(isOpenCall, e)))) return Box({})
    // The engine's own result (an Edit's diff) is the richest; indented, it sits under the line's text.
    return Box({ marginLeft: 2, children: [await next(e)] })
  })
}
