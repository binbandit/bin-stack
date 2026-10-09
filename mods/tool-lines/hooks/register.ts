import type { Register } from 'claude-code'

const ENGINE_ROW_INDENT = 4
const DOT_COLUMN_WIDTH = 2
const MIN_TEXT_WIDTH = 20
const MIN_LINE_CHARS = 120
const MAX_LINE_ROWS = 3
const MAX_SUBJECT_CHARS = 35
const UNMEASURED_TERMINAL_COLUMNS = 120

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

function lineFor(row: ToolRow, columns: number): ToolLine {
  const textWidth = Math.max(columns - ENGINE_ROW_INDENT - DOT_COLUMN_WIDTH, MIN_TEXT_WIDTH)
  const lineBudget = Math.min(Math.max(textWidth, MIN_LINE_CHARS), textWidth * MAX_LINE_ROWS)
  const meta = META_PROBES.map(probe => probe(row))
    .filter(note => note !== undefined)
    .join(', ')
  const frameChars = `tool_call: ${row.tool}()`.length + (meta === '' ? 0 : ` - ${meta}`.length)
  const subjectRoom = Math.min(MAX_SUBJECT_CHARS, lineBudget - frameChars)
  return { tool: row.tool, subject: clip(subjectOf(row.input), subjectRoom), meta }
}

const hasFailed = (row: ToolRow) => row.isErrored || row.isInterrupted

const hasFinished = (row: ToolRow) => !row.isRunning && row.output !== undefined

function dotColor(row: ToolRow): 'error' | 'success' | 'warning' {
  if (hasFailed(row)) return 'error'
  return hasFinished(row) ? 'success' : 'warning'
}

let isTranscriptExpanded = false

const isCompact = (surface: string) => surface === 'terminal' && !isTranscriptExpanded

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
    const { Box, Text } = $.ui.resolve(e)
    const line = lineFor(e.props, e.viewport?.columns ?? UNMEASURED_TERMINAL_COLUMNS)
    const metaStyle = e.props.isErrored ? { color: 'error' } : { dimColor: true }
    const dotColumn = Box({
      minWidth: DOT_COLUMN_WIDTH,
      flexShrink: 0,
      children: [Text({ color: dotColor(e.props), children: ['●'] })],
    })
    const textColumn = Box({
      flexShrink: 1,
      children: [
        Text({
          wrap: 'wrap',
          children: [
            Text({ dimColor: true, children: ['tool_call: '] }),
            Text({ bold: true, children: [line.tool] }),
            `(${line.subject})`,
            ...(line.meta === '' ? [] : [Text({ ...metaStyle, children: [` - ${line.meta}`] })]),
          ],
        }),
      ],
    })
    return Box({ flexDirection: 'row', marginLeft: 2, children: [dotColumn, textColumn] })
  })

  on('ui.render', { component: 'ToolGroup' }, async ($, e, next) => {
    if (!isCompact(e.surface)) return next(e)
    const unfoldedGroup = { ...e.props, isExpanded: true }
    return next({ ...e, props: unfoldedGroup })
  })

  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    if (!isCompact(e.surface)) return next(e)
    const { Box } = $.ui.resolve(e)
    return Box({})
  })
}
