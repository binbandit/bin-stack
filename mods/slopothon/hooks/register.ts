import type { Elements, EngineInterface, Register, RenderNode, SessionMessage, TextProps } from 'claude-code'

const VOLT = '#C8FF00'
const BONE = '#E4E4DC'
const INK = '#0A0A0A'
const SIGNAL_PINK = '#FF2E88'

const PLUGIN = 'slopothon'
const COMMAND = 'slopothon'
const BOOT_TEXT = 'SLOPOTHON'
const SHOW_TEXT = 'SLOPOTHON banner'

const WORDMARK = [
  '▄▄▄▄▄▄ ▄▄     ▄▄▄▄▄▄ ▄▄▄▄▄▄ ▄▄▄▄▄▄ ▄▄▄▄▄▄ ▄▄  ▄▄ ▄▄▄▄▄▄ ▄▄   ▄▄',
  '██▄▄▄▄ ██     ██  ██ ██▄▄██ ██  ██   ██   ██▄▄██ ██  ██ ██▀▄ ██',
  '▄▄▄▄██ ██▄▄▄▄ ██▄▄██ ██     ██▄▄██   ██   ██  ██ ██▄▄██ ██  ▀██',
]
const WORDMARK_COLUMNS = WORDMARK[0]?.length ?? 0
const LETTER_PITCH = 7
const SLOP_COLUMNS = 'SLOP'.length * LETTER_PITCH
const SPACED_SLOP = 'S L O P '
const SPACED_OTHON = 'O T H O N'

const TAGLINES = [
  'SLOP IS A MARATHON, NOT A SPRINT',
  'NO DIFF LEFT BEHIND',
  'TOKENS IN, SLOP OUT',
  'PROMPT. DIFF. REPEAT.',
  "GREEN TESTS OR IT DIDN'T HAPPEN",
  'READ THE DIFF BEFORE YOU SHIP',
  'ONE MORE PROMPT',
  'ALL GAS, SOME BRAKES',
]
const BARS = ['▌', '║', '│', '█']
const BARCODE_COLUMNS = 14
const KATAKANA = 'スロップ・マラソン'
const NO_GIT = 'NO GIT'
const COLUMN_GAP = '   '
const CARD_COLUMNS = 30
const DOT_MATRIX_PITCH = 3
const PLATE_COLUMNS = WORDMARK_COLUMNS + COLUMN_GAP.length + CARD_COLUMNS
const UNMEASURED_COLUMNS = 80

const DOT_MATRIX_FONT: Record<string, string> = {
  A: '.###.|#...#|#...#|#####|#...#|#...#|#...#',
  B: '####.|#...#|#...#|####.|#...#|#...#|####.',
  C: '.###.|#...#|#....|#....|#....|#...#|.###.',
  D: '####.|#...#|#...#|#...#|#...#|#...#|####.',
  E: '#####|#....|#....|####.|#....|#....|#####',
  F: '#####|#....|#....|####.|#....|#....|#....',
  G: '.###.|#...#|#....|#.###|#...#|#...#|.####',
  H: '#...#|#...#|#...#|#####|#...#|#...#|#...#',
  I: '.###.|..#..|..#..|..#..|..#..|..#..|.###.',
  J: '..###|...#.|...#.|...#.|...#.|#..#.|.##..',
  K: '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#',
  L: '#....|#....|#....|#....|#....|#....|#####',
  M: '#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#',
  N: '#...#|#...#|##..#|#.#.#|#..##|#...#|#...#',
  O: '.###.|#...#|#...#|#...#|#...#|#...#|.###.',
  P: '####.|#...#|#...#|####.|#....|#....|#....',
  Q: '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#',
  R: '####.|#...#|#...#|####.|#.#..|#..#.|#...#',
  S: '.####|#....|#....|.###.|....#|....#|####.',
  T: '#####|..#..|..#..|..#..|..#..|..#..|..#..',
  U: '#...#|#...#|#...#|#...#|#...#|#...#|.###.',
  V: '#...#|#...#|#...#|#...#|#...#|.#.#.|..#..',
  W: '#...#|#...#|#...#|#.#.#|#.#.#|#.#.#|.#.#.',
  X: '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
  Y: '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..',
  Z: '#####|....#|...#.|..#..|.#...|#....|#####',
  '0': '.###.|#...#|#..##|#.#.#|##..#|#...#|.###.',
  '1': '..#..|.##..|..#..|..#..|..#..|..#..|.###.',
  '2': '.###.|#...#|....#|...#.|..#..|.#...|#####',
  '3': '#####|...#.|..#..|...#.|....#|#...#|.###.',
  '4': '...#.|..##.|.#.#.|#..#.|#####|...#.|...#.',
  '5': '#####|#....|####.|....#|....#|#...#|.###.',
  '6': '..##.|.#...|#....|####.|#...#|#...#|.###.',
  '7': '#####|....#|...#.|..#..|.#...|.#...|.#...',
  '8': '.###.|#...#|#...#|.###.|#...#|#...#|.###.',
  '9': '.###.|#...#|#...#|.####|....#|...#.|.##..',
  '.': '.....|.....|.....|.....|.....|.##..|.##..',
  '-': '.....|.....|.....|#####|.....|.....|.....',
  '/': '.....|....#|...#.|..#..|.#...|#....|.....',
}
const BRAILLE_DOTS = [
  [0x01, 0x08],
  [0x02, 0x10],
  [0x04, 0x20],
  [0x40, 0x80],
]
const BRAILLE_BLANK = 0x2800

const ROWS_FROM_LOGO_TO_BOOT_ROW = 6
const ROWS_PER_RECORD_ABOVE_BOOT_ROW = 2
const ROWS_FROM_LOGO_TO_FIRST_PROMPT = 4
const SLACK_ROWS = 3
const TRANSCRIPT_HEAD_BYTES = 512 * 1024
const CHAT_ENTRY_TYPES = new Set(['user', 'assistant', 'system'])
const BOOT_RECORD_TEXT = `<command-name>/${COMMAND}</command-name>`

type Run = { version: string; model: string; branch: string | undefined; id: string }
type Notice = { text: string; command: string | null }
type Style = Pick<TextProps, 'color' | 'backgroundColor' | 'bold' | 'dimColor'>
type Span = { text: string; style?: Style }
type Line = Span[]
type TerminalElements = Elements['terminal']

const DIM: Style = { dimColor: true }
const MARK: Style = { color: SIGNAL_PINK }
const PLAIN: Style = { color: BONE }

type Anchor = { row: 'boot'; recordsAbove: number } | { row: 'first prompt'; id: string }
type EntryKind = 'meta' | 'prompt' | 'boot' | 'command' | 'shell' | 'output' | 'reply'
type TranscriptEntry = { uuid: string; parent: string | null; kind: EntryKind }

let run: Run | undefined
let anchor: Anchor | undefined
let resumedAnchor: Anchor | undefined
const notices = new Map<string, Notice>()

const FAMILIES = 'fable|mythos|opus|sonnet|haiku'
const FAMILY_THEN_VERSION = new RegExp(`(${FAMILIES})[-_ ]?(\\d{1,2})(?!\\d)(?:[-.](\\d{1,2})(?!\\d))?`)
const VERSION_THEN_FAMILY = new RegExp(`claude-(\\d)(?:[-.](\\d))?-(${FAMILIES})`)
const FAMILY_ONLY = new RegExp(`(${FAMILIES})`)
const OPAQUE_BEDROCK_ARN = /^arn:aws[\w-]*:bedrock:/

const versioned = (family: string, major: string, minor: string | undefined) =>
  `${family.toUpperCase()} ${minor === undefined ? major : `${major}.${minor}`}`

function modelLabel(model: string): string {
  const routed = model.toLowerCase()
  const id = routed.split('/').at(-1) ?? routed
  const familyFirst = FAMILY_THEN_VERSION.exec(id)
  if (familyFirst !== null) return versioned(familyFirst[1] ?? '', familyFirst[2] ?? '', familyFirst[3])
  const versionFirst = VERSION_THEN_FAMILY.exec(id)
  if (versionFirst !== null) return versioned(versionFirst[3] ?? '', versionFirst[1] ?? '', versionFirst[2])
  const family = FAMILY_ONLY.exec(id)?.[1]
  if (family !== undefined) return family.toUpperCase()
  if (OPAQUE_BEDROCK_ARN.test(routed)) return 'BEDROCK'
  const name = id
    .replace(/\[.*\]$/, '')
    .replace(/@.*$/, '')
    .replace(/-v\d+(:\d+)?$/, '')
    .replace(/^([a-z]+\.)+/, '')
  return name.replace(/[^a-z0-9.\-/ ]/g, '-').toUpperCase()
}

async function currentBranch($: EngineInterface, cwd: string): Promise<string | undefined> {
  const git = (...args: string[]) => $.process.run(['git', ...args], { cwd, timeoutMs: 2000 }).catch(() => undefined)
  const branch = await git('symbolic-ref', '--short', '-q', 'HEAD')
  if (branch?.exitCode === 0) return branch.stdout.trim()
  const detached = await git('rev-parse', '--short', 'HEAD')
  return detached?.exitCode === 0 ? `HEAD@${detached.stdout.trim()}` : undefined
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

function promptTextOf(content: unknown): string | undefined {
  if (typeof content === 'string') return content
  const first = Array.isArray(content) ? content.find(isRecord) : undefined
  return first?.type === 'text' && typeof first.text === 'string' ? first.text : undefined
}

function userEntryKind(text: string | undefined): EntryKind {
  if (text === undefined) return 'output'
  if (text.startsWith(BOOT_RECORD_TEXT)) return 'boot'
  if (text.startsWith('<command-name>')) return 'command'
  if (text.startsWith('<bash-input>')) return 'shell'
  if (/^\s*<(?:bash-|local-command)/.test(text)) return 'output'
  return 'prompt'
}

function transcriptEntryOf(line: string): TranscriptEntry | undefined {
  let value: unknown
  try {
    value = JSON.parse(line)
  } catch {
    return undefined
  }
  if (!isRecord(value) || typeof value.uuid !== 'string' || typeof value.type !== 'string' || !CHAT_ENTRY_TYPES.has(value.type)) return undefined
  const parent = typeof value.parentUuid === 'string' ? value.parentUuid : null
  if (value.isMeta === true) return { uuid: value.uuid, parent, kind: 'meta' }
  if (value.type === 'system') return { uuid: value.uuid, parent, kind: 'output' }
  if (value.type === 'assistant') return { uuid: value.uuid, parent, kind: 'reply' }
  return { uuid: value.uuid, parent, kind: userEntryKind(isRecord(value.message) ? promptTextOf(value.message.content) : undefined) }
}

async function resumedAnchorOf($: EngineInterface, transcriptPath: string): Promise<Anchor | undefined> {
  const head = await $.process.run(['head', '-c', String(TRANSCRIPT_HEAD_BYTES), transcriptPath], { timeoutMs: 2000 }).catch(() => undefined)
  if (head?.exitCode !== 0) return undefined
  const entries = head.stdout.split('\n').flatMap(line => transcriptEntryOf(line) ?? [])
  const firstChildOf = new Map(entries.toReversed().flatMap(entry => (entry.parent === null ? [] : [[entry.parent, entry] as const])))
  let recordsAbove = 0
  for (let entry = entries.find(candidate => candidate.parent === null); entry !== undefined; entry = firstChildOf.get(entry.uuid)) {
    if (entry.kind === 'boot') return { row: 'boot', recordsAbove }
    if (entry.kind === 'prompt') return recordsAbove === 0 ? { row: 'first prompt', id: entry.uuid } : undefined
    if (entry.kind === 'command') recordsAbove += 1
    if (entry.kind === 'shell' || entry.kind === 'reply') return undefined
  }
  return undefined
}

const isCommandRecord = (message: SessionMessage) => message.text.startsWith('<command-name>/')

const isBootRecord = (message: SessionMessage) => message.text.startsWith(BOOT_RECORD_TEXT)

const isWide = (char: string) => /[\u3000-\u30ff]/.test(char)

const cellsOf = (text: string) => [...text].reduce((sum, char) => sum + (isWide(char) ? 2 : 1), 0)

const width = (line: Line) => line.reduce((sum, piece) => sum + cellsOf(piece.text), 0)

const span = (text: string, style?: Style): Span => ({ text, style })

const rule = (cells: number): Span => span('_'.repeat(Math.max(cells, 1)), DIM)

const shortened = (text: string, cells: number) => (text.length <= cells ? text : `${text.slice(0, cells - 1)}…`)

const runDigits = (id: string) => [...id.replace(/[^0-9a-f]/gi, '')].map(digit => Number.parseInt(digit, 16))

const runCode = (id: string) => {
  const hex = id.replace(/[^0-9a-f]/gi, '').toUpperCase()
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}`
}

function dotMatrix(text: string): string[] {
  const letters = [...text.toUpperCase()].slice(0, CARD_COLUMNS / DOT_MATRIX_PITCH)
  const glyphs = letters.map(letter => DOT_MATRIX_FONT[letter]?.split('|') ?? [])
  const isLit = (x: number, y: number) => glyphs[Math.floor(x / 6)]?.[y - 1]?.[x % 6] === '#'
  return [0, 1].map(row =>
    Array.from({ length: glyphs.length * DOT_MATRIX_PITCH }, (_, cell) => {
      const dots = BRAILLE_DOTS.flatMap((pair, dy) => pair.filter((_, dx) => isLit(cell * 2 + dx, row * 4 + dy)))
      return dots.length === 0 ? ' ' : String.fromCharCode(BRAILLE_BLANK + dots.reduce((sum, dot) => sum + dot, 0))
    })
      .join('')
      .trimEnd(),
  )
}

const wordmarkRow = (row: string): Line => [
  span(row.slice(0, SLOP_COLUMNS), { color: VOLT }),
  span(row.slice(SLOP_COLUMNS), { color: BONE }),
]

function tagStrip(id: string): Line {
  const digits = runDigits(id)
  const tagline = ` ${TAGLINES[(digits[0] ?? 0) % TAGLINES.length]} `
  const barcode = Array.from({ length: BARCODE_COLUMNS }, (_, i) => BARS[(digits.at(-1 - i) ?? i) % BARS.length]).join('')
  const hazard = '╱'.repeat(WORDMARK_COLUMNS - tagline.length - barcode.length - 2)
  return [span(tagline, { color: INK, backgroundColor: VOLT, bold: true }), span(` ${hazard} `, MARK), span(barcode, DIM)]
}

function modelCard({ model, branch }: Run): Line[] {
  const header = [span('01', { ...MARK, bold: true }), span(' // ', DIM), span('MODEL', PLAIN), span(' ')]
  const branchLabel = [span('BRANCH', PLAIN), span(' // ', DIM)]
  const branchName =
    branch === undefined ? span(NO_GIT, DIM) : span(shortened(branch, CARD_COLUMNS - width(branchLabel) - 2), { ...PLAIN, bold: true })
  const footer = [...branchLabel, branchName, span(' ')]
  return [
    [...header, rule(CARD_COLUMNS - width(header))],
    ...dotMatrix(model).map(row => [span(row, { color: VOLT })]),
    [...footer, rule(CARD_COLUMNS - width(footer))],
  ]
}

function microLine({ id, version }: Run): Line {
  const left = [span('+ ', MARK), span('SESSION ', DIM), span(runCode(id), PLAIN), span(' _ BUILD ', DIM), span(version, PLAIN), span(' ')]
  const right = [span(` ${KATAKANA}`, DIM), span(' +', MARK)]
  return [...left, rule(PLATE_COLUMNS - width(left) - width(right)), ...right]
}

const detailSpans = ({ model, branch, version }: Run): Line[] => [
  [span('MODEL', PLAIN), span(' // ', DIM), span(model, { color: VOLT })],
  [span('BRANCH', PLAIN), span(' // ', DIM), branch === undefined ? span(NO_GIT, DIM) : span(branch, { ...PLAIN, bold: true })],
  [span('BUILD', PLAIN), span(' // ', DIM), span(version, DIM)],
]

function bannerLines(columns: number, current: Run | undefined): Line[] {
  const wordmark = WORDMARK.map(wordmarkRow)
  if (current === undefined) return wordmark
  if (columns >= PLATE_COLUMNS) {
    const card = modelCard(current)
    const left = [...wordmark, tagStrip(current.id)]
    return [...left.map((line, i) => [...line, span(COLUMN_GAP), ...(card[i] ?? [])]), microLine(current)]
  }
  if (columns >= WORDMARK_COLUMNS) {
    const details = detailSpans(current).flatMap((line, i) => (i === 0 ? line : [span('   '), ...line]))
    return [...wordmark, tagStrip(current.id), [span('+ ', MARK), ...details]]
  }
  const spacedName = [span(SPACED_SLOP, { color: VOLT, bold: true }), span(SPACED_OTHON, { color: BONE, bold: true })]
  return [spacedName, ...detailSpans(current)]
}

function clipToColumns(line: Line, columns: number): Line {
  let room = columns
  const clipped: Line = []
  for (const piece of line) {
    let text = ''
    for (const char of piece.text) {
      if (cellsOf(char) > room) break
      text += char
      room -= cellsOf(char)
    }
    clipped.push({ ...piece, text })
    if (text.length < piece.text.length) break
  }
  return [...clipped, span(' '.repeat(room))]
}

const drawLine = ({ Text }: TerminalElements, line: Line) =>
  Text({ wrap: 'truncate-end', children: line.map(piece => Text({ ...piece.style, children: [piece.text] })) })

const drawNotice = ({ Box, Text }: TerminalElements, { text, command }: Notice) =>
  Box({
    flexDirection: 'row',
    children: [
      Text({ dimColor: true, children: ['▎ '] }),
      Text({ dimColor: true, children: [command === null ? text : `${text} ${command}`] }),
    ],
  })

function coverOver(elements: TerminalElements, columns: number, rowsToLogo: number, below: RenderNode[]) {
  const blank = (count: number): Line[] => Array.from({ length: count }, () => [])
  const banner = bannerLines(columns, run)
  const cover = [...blank(SLACK_ROWS), ...banner, ...blank(rowsToLogo - banner.length)]
  return elements.Box({
    flexDirection: 'column',
    marginTop: -(SLACK_ROWS + rowsToLogo),
    children: [...cover.map(line => drawLine(elements, clipToColumns(line, columns))), ...below],
  })
}

const noticeRows = (elements: TerminalElements) => [...notices.values()].map(notice => drawNotice(elements, notice))

async function settleBanner($: EngineInterface, cwd: string, start: 'startup' | 'clear' | 'resume', resumedId?: string) {
  const branchRead = currentBranch($, cwd)
  const [messages, settings, version, model, id] = await Promise.all([
    $.session.messages(),
    $.settings.read(),
    $.session.version(),
    $.session.model(),
    resumedId ?? $.session.id(),
    $.command.register({ name: COMMAND, description: 'Draw the SLOPOTHON banner' }),
  ])
  const bootIndex = messages.findIndex(isBootRecord)
  const isBooting = start !== 'resume' && bootIndex === -1 && settings.tui === 'fullscreen' && (start === 'clear' || messages.length === 0)
  const recordsAbove = bootIndex === -1 ? messages.length : bootIndex
  const hasBanner = (isBooting || bootIndex !== -1) && messages.slice(0, recordsAbove).every(isCommandRecord)
  const showRun = (branch: string | undefined) => {
    run = { version: version.version, model: modelLabel(model), branch, id }
    $.ui.invalidate('ui.render')
  }
  const isResumed = start === 'resume' || (messages.length > 0 && resumedAnchor !== undefined)
  anchor = isResumed ? resumedAnchor : hasBanner ? { row: 'boot', recordsAbove } : undefined
  showRun(undefined)
  await Promise.all([isBooting ? $.command.run({ command: COMMAND }) : undefined, branchRead.then(showRun)])
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await settleBanner($, e.cwd, 'startup')
    return next(e)
  })

  on('classic.SessionStart', async ($, e, next) => {
    const started = await next(e)
    if (e.source === 'clear') {
      resumedAnchor = undefined
      await settleBanner($, e.cwd, 'clear')
    }
    if (e.source === 'resume') {
      resumedAnchor = await resumedAnchorOf($, e.transcript_path)
      await settleBanner($, e.cwd, 'resume', e.session_id)
    }
    return started
  })

  on('command.run', { command: COMMAND }, async ($, e) => {
    if (e.origin.kind === 'plugin' && e.origin.name === PLUGIN) return { text: BOOT_TEXT }
    const branch = await currentBranch($, await $.session.cwd())
    if (run !== undefined) run = { ...run, branch }
    return { text: SHOW_TEXT }
  })

  on('ui.render', { component: 'InfoNotice' }, ($, e, next) => {
    if (e.surface !== 'terminal' || e.viewport?.isFullscreen !== true || anchor === undefined) return next(e)
    if (!notices.has(e.requestId)) {
      notices.set(e.requestId, { text: e.props.text, command: e.props.command })
      $.ui.invalidate('ui.render')
    }
    const { Box } = $.ui.resolve(e)
    return Box({})
  })

  on('ui.render', { component: 'CommandOutput', props: { command: COMMAND } }, ($, e, next) => {
    if (e.surface !== 'terminal') return next(e)
    if (e.props.text.endsWith(SHOW_TEXT)) {
      const elements = $.ui.resolve(e)
      const columns = e.viewport?.columns ?? UNMEASURED_COLUMNS
      return elements.Box({
        flexDirection: 'column',
        children: bannerLines(columns, run).map(line => drawLine(elements, clipToColumns(line, columns))),
      })
    }
    if (e.viewport?.isFullscreen !== true || !e.props.text.endsWith(BOOT_TEXT)) return next(e)
    const elements = $.ui.resolve(e)
    const recordsAbove = anchor?.row === 'boot' ? anchor.recordsAbove : 0
    const rowsToLogo = ROWS_FROM_LOGO_TO_BOOT_ROW + ROWS_PER_RECORD_ABOVE_BOOT_ROW * recordsAbove
    const emptyRow = elements.Text({ children: [' '] })
    return coverOver(elements, e.viewport.columns, rowsToLogo, notices.size === 0 ? [emptyRow] : noticeRows(elements))
  })

  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    const isFirstPrompt = anchor?.row === 'first prompt' && anchor.id === e.requestId
    if (e.surface !== 'terminal' || e.viewport?.isFullscreen !== true || e.props.isExpanded || !isFirstPrompt) return next(e)
    const elements = $.ui.resolve(e)
    return coverOver(elements, e.viewport.columns, ROWS_FROM_LOGO_TO_FIRST_PROMPT, [...noticeRows(elements), await next(e)])
  })
}
