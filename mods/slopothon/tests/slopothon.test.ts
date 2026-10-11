import type { On, RenderElement, RenderPropsOf, SessionMessage } from 'claude-code'
import type { Engine, Plugin } from 'claude-code/testing'
import { expect, test } from 'claude-code/testing'

const ENGINE_DRAWING: RenderElement = { type: 'Text', props: {}, children: ['engine'] }
const BOOT_ROW: RenderPropsOf['CommandOutput'] = { command: 'slopothon', args: '', text: 'slopothon: SLOPOTHON', isErrored: false }
const COVER_ROWS = 9
const CLEAR_RECORD: SessionMessage = { role: 'user', text: '<command-name>/clear</command-name>\n<command-args></command-args>', toolUses: [] }
const BOOT_RECORD: SessionMessage = { role: 'user', text: '<command-name>/slopothon</command-name>\n<command-args></command-args>', toolUses: [] }
const PROMPT: SessionMessage = { role: 'user', text: 'hi', toolUses: [] }

type Git = { head: string | null }
type Run = { id: string }
type Session = { messages?: SessionMessage[]; tui?: string; git?: Git; run?: Run; model?: string; transcript?: object[] }

const RUN_ID = '80000000-0000-4000-8000-0123456789ab'

const gitRun = (exitCode: number, stdout: string) => ({ exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false })

function answerSession(
  on: On,
  { messages = [], tui = 'fullscreen', git = { head: 'main' }, run = { id: RUN_ID }, model = 'claude-opus-5-5[1m]', transcript = [] }: Session = {},
) {
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('classic.SessionStart', () => ({}))
  on('session.messages', () => ({ value: messages }))
  on('settings.read', () => ({ value: { tui } }))
  on('session.version', () => ({ value: { version: '2.1.295' } }))
  on('session.model', () => ({ value: model }))
  on('session.id', () => ({ value: run.id }))
  on('session.cwd', () => ({ value: '/home/runner/code/app' }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('process.run', ($, e) => {
    const [command, subcommand] = e.argv
    if (command === 'head') return { value: gitRun(0, transcript.map(entry => JSON.stringify(entry)).join('\n')) }
    if (git.head === null) return { value: gitRun(128, '') }
    if (subcommand === 'symbolic-ref') return { value: git.head === 'HEAD' ? gitRun(1, '') : gitRun(0, `${git.head}\n`) }
    return { value: gitRun(0, 'abc1234\n') }
  })
}

const startSession = ($: Engine) => $.session.start({ cwd: '/home/runner/code/app', surface: 'terminal', isInteractive: true })

const startAfterClear = ($: Engine) => $.classic.SessionStart({ source: 'clear', cwd: '/home/runner/code/app' })

const resume = async ($: Engine) => {
  await $.classic.SessionStart({ source: 'resume', cwd: '/home/runner/code/app', transcript_path: '/home/runner/.claude/projects/app/s.jsonl' })
  await startSession($)
}

function flattenedText(node: unknown): string {
  if (typeof node === 'string') return node
  if (typeof node !== 'object' || node === null) return ''
  const children = (node as { children?: unknown[] }).children ?? []
  return children.map(flattenedText).join('')
}

const colorsOf = (node: unknown) =>
  ((node as { children?: unknown[] }).children ?? []).map(span => [(span as { props?: { color?: string } }).props?.color, flattenedText(span)])

const mountOnTerminal = <C extends 'CommandOutput' | 'InfoNotice'>($: Engine, component: C, props: RenderPropsOf[C], isFullscreen = true, columns = 120) =>
  $.ui.mount({ plugin: 'slopothon', surface: 'terminal', component, props, viewport: { columns, rows: 40, isFullscreen } })

async function drawnBootRow($: Engine, columns: number) {
  const root = await (await mountOnTerminal($, 'CommandOutput', BOOT_ROW, true, columns)).drawn()
  if (root?.type !== 'Box') throw new Error(`the boot row drew ${root?.type ?? 'nothing'}, not a Box`)
  return { root, rows: (root.children ?? []).map(flattenedText) }
}

const cellsOf = (row: string) => [...row].reduce((cells, char) => cells + (/[　-ヿ]/.test(char) ? 2 : 1), 0)

const cardOf = (row: string | undefined) => row?.slice(66).trimEnd()

test('locks up the wordmark, a dot-matrix model card, the livery strip and a microline where the logo was', async ($, on) => {
  answerSession(on)
  await startSession($)
  const { root, rows } = await drawnBootRow($, 120)
  expect(root.props?.marginTop).toBe(-COVER_ROWS)
  expect(rows[3]).toMatch(/^▄▄▄▄▄▄ ▄▄ .*▄▄   01 \/\/ MODEL _{18} *$/)
  expect(rows[6]).toMatch(/^ SLOP IS A MARATHON, NOT A SPRINT  ╱+ [▌║│█]{14}   BRANCH \/\/ main _{15} *$/)
  expect(rows[7]?.trimEnd()).toMatch(/^\+ SESSION 8000-0000 _ BUILD 2\.1\.295 _+ スロップ・マラソン \+$/)
  expect(cellsOf(rows[7]?.trimEnd() ?? '')).toBe(96)
})

test('spells the model in a 5x7 dot matrix', async ($, on) => {
  answerSession(on)
  await startSession($)
  const { rows } = await drawnBootRow($, 120)
  expect([cardOf(rows[4]), cardOf(rows[5])]).toEqual(['⡔⠒⡄⡖⠒⡄⡆ ⡆⡔⠒⠂   ⣖⣒⠂   ⣖⣒⠂', '⢇⣀⠇⡏⠉ ⢇⣀⠇⣈⣉⠆   ⢄⣀⠇⢠⡄ ⢄⣀⠇'])
})

test('paints SLOP in volt and OTHON in bone so the pun reads', async ($, on) => {
  answerSession(on)
  await startSession($)
  const { root } = await drawnBootRow($, 120)
  expect(colorsOf(root.children?.[4]).slice(0, 2)).toEqual([
    ['#C8FF00', '██▄▄▄▄ ██     ██  ██ ██▄▄██ '],
    ['#E4E4DC', '██  ██   ██   ██▄▄██ ██  ██ ██▀▄ ██'],
  ])
})

test('picks each run its own tagline and barcode, as wide as the wordmark', async ($, on) => {
  const run: Run = { id: RUN_ID }
  answerSession(on, { run })
  const strips = new Set<string>()
  for (const first of ['0', '1', '2', '3', '4', '5', '6', '7']) {
    run.id = `${first}${RUN_ID.slice(1, -1)}${first}`
    await startSession($)
    const strip = (await drawnBootRow($, 120)).rows[6]?.slice(0, 63) ?? ''
    expect(strip.trimEnd().length).toBe(63)
    strips.add(strip)
  }
  expect(strips.size).toBe(8)
})

const MODEL_CASES: [id: string, label: string][] = [
  ['claude-opus-5-5[1m]', 'OPUS 5.5'],
  ['claude-opus-5', 'OPUS 5'],
  ['claude-fable-5-1', 'FABLE 5.1'],
  ['claude-haiku-4-5-20251001', 'HAIKU 4.5'],
  ['claude-opus-4-20250514', 'OPUS 4'],
  ['claude-sonnet-4-5@20250929', 'SONNET 4.5'],
  ['anthropic.claude-opus-5-5', 'OPUS 5.5'],
  ['us.anthropic.claude-sonnet-4-5-20250929-v1:0', 'SONNET 4.5'],
  ['global.anthropic.claude-opus-4-1-20250805-v1:0', 'OPUS 4.1'],
  ['arn:aws:bedrock:us-east-1:123456789012:inference-profile/us.anthropic.claude-haiku-4-5-20251001-v1:0', 'HAIKU 4.5'],
  ['arn:aws:bedrock:us-east-1:123456789012:application-inference-profile/a1b2c3d4e5f6', 'BEDROCK'],
  ['opus-5-5', 'OPUS 5.5'],
  ['opus', 'OPUS'],
  ['sonnet[1m]', 'SONNET'],
  ['claude-3-5-sonnet-20241022', 'SONNET 3.5'],
  ['anthropic.claude-3-opus-20240229-v1:0', 'OPUS 3'],
  ['anthropic/claude-sonnet-4.5', 'SONNET 4.5'],
  ['Claude Opus 5.5', 'OPUS 5.5'],
  ['@anthropic/claude-sonnet-4-5-20250929', 'SONNET 4.5'],
  ['@anthropic-main/claude-opus-5-5', 'OPUS 5.5'],
  ['@bedrock-us/claude-3-sonnet-v1', 'SONNET 3'],
  ['@bedrock-us/us.anthropic.claude-haiku-4-5-20251001-v1:0', 'HAIKU 4.5'],
  ['@vertex-global/claude-opus-4-5@20251101', 'OPUS 4.5'],
  ['@opus-team/claude-sonnet-4-5', 'SONNET 4.5'],
  ['@openai-prod/gpt-5.4-mini', 'GPT-5.4-MINI'],
  ['gpt-5', 'GPT-5'],
  ['meta.llama3-70b-instruct-v1:0', 'LLAMA3-70B-INSTRUCT'],
]

for (const [id, label] of MODEL_CASES) {
  test(`names ${id} as ${label}`, async ($, on) => {
    answerSession(on, { model: id })
    await startSession($)
    expect((await drawnBootRow($, 90)).rows[7]?.trimEnd()).toBe(`+ MODEL // ${label}   BRANCH // main   BUILD // 2.1.295`)
  })
}

const BRANCH_CASES: [name: string, head: string | null, branch: string][] = [
  ['a detached HEAD by its commit', 'HEAD', 'BRANCH // HEAD@abc1234 _______'],
  ['a long branch, cut to the card', 'feat/dot-matrix-model-card', 'BRANCH // feat/dot-matrix-m… _'],
  ['a folder outside git', null, 'BRANCH // NO GIT _____________'],
]

for (const [name, head, branch] of BRANCH_CASES) {
  test(`names the branch for ${name}`, async ($, on) => {
    answerSession(on, { git: { head } })
    await startSession($)
    expect(cardOf((await drawnBootRow($, 120)).rows[6])).toBe(branch)
  })
}

const COVER_CASES: [name: string, session: Session, start: (engine: Engine) => Promise<unknown>, coverRows: number][] = [
  ['a fresh session', {}, startSession, COVER_ROWS],
  ['a session /clear just emptied, past its /clear row', { messages: [CLEAR_RECORD] }, startAfterClear, COVER_ROWS + 2],
  ['a resumed session that began with /clear', { messages: [CLEAR_RECORD, BOOT_RECORD, PROMPT] }, startSession, COVER_ROWS + 2],
]

for (const [name, session, start, coverRows] of COVER_CASES) {
  test(`reaches up to the logo in ${name}`, async ($, on) => {
    answerSession(on, session)
    await start($)
    const { root, rows } = await drawnBootRow($, 120)
    expect(root.props?.marginTop).toBe(-coverRows)
    expect(rows[3]).toMatch(/^▄▄▄▄▄▄ ▄▄ /)
  })
}

test('fills every covering row to the full width so no logo cell shows through', async ($, on) => {
  answerSession(on)
  await startSession($)
  for (const columns of [120, 70, 40]) {
    const { rows } = await drawnBootRow($, columns)
    expect(rows.slice(0, COVER_ROWS).map(cellsOf)).toEqual(Array(COVER_ROWS).fill(columns))
  }
})

test('folds the model card into one detail line, then stacks it under the spelled name, as the terminal narrows', async ($, on) => {
  answerSession(on)
  await startSession($)
  const medium = await drawnBootRow($, 90)
  expect(medium.rows[3]).toMatch(/^▄▄▄▄▄▄ ▄▄ .*▄▄ *$/)
  expect(medium.rows[7]).toMatch(/^\+ MODEL \/\/ OPUS 5\.5   BRANCH \/\/ main   BUILD \/\/ 2\.1\.295 *$/)
  const narrow = await drawnBootRow($, 40)
  expect(narrow.rows.slice(3, 7).map(row => row.trimEnd())).toEqual(['S L O P O T H O N', 'MODEL // OPUS 5.5', 'BRANCH // main', 'BUILD // 2.1.295'])
})

test('moves a startup notice from under the logo to under the banner', async ($, on) => {
  answerSession(on)
  on('ui.render', () => ENGINE_DRAWING)
  await startSession($)
  const notice = await mountOnTerminal($, 'InfoNotice', { text: 'Debug mode enabled', command: null })
  expect(flattenedText(await notice.drawn())).toBe('')
  const { rows } = await drawnBootRow($, 120)
  expect(rows.at(-1)).toBe('▎ Debug mode enabled')
})

test('leaves startup notices in place in a session that has no banner', async ($, on) => {
  answerSession(on, { messages: [PROMPT] })
  on('ui.render', () => ENGINE_DRAWING)
  await startSession($)
  const notice = await mountOnTerminal($, 'InfoNotice', { text: 'Debug mode enabled', command: null })
  expect(flattenedText(await notice.drawn())).toBe('engine')
})

test('leaves the boot row to the engine on the main screen', async ($, on) => {
  answerSession(on)
  on('ui.render', () => ENGINE_DRAWING)
  await startSession($)
  const mainScreen = await mountOnTerminal($, 'CommandOutput', BOOT_ROW, false)
  expect(flattenedText(await mainScreen.drawn())).toBe('engine')
})

test('draws the banner inline with a fresh branch when /slopothon is typed', async ($, on) => {
  const git: Git = { head: 'main' }
  answerSession(on, { git })
  await startSession($)
  git.head = 'feat/lockup'
  const typed = await $.command.run({
    command: 'slopothon',
    args: '',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 120 },
  })
  expect(typed.text).toBe('SLOPOTHON banner')
  for (const isFullscreen of [true, false]) {
    const row = await mountOnTerminal($, 'CommandOutput', { ...BOOT_ROW, text: 'slopothon: SLOPOTHON banner' }, isFullscreen)
    const drawn = await row.drawn()
    expect(drawn?.type === 'Box' ? drawn.props?.marginTop : 'not a Box').toBeUndefined()
    expect(flattenedText(drawn)).toMatch(/BRANCH \/\/ feat\/lockup/)
  }
})

const FIRST_PROMPT = { type: 'user', uuid: 'prompt-1', parentUuid: null, message: { role: 'user', content: 'fix the flaky test' } }
const REPLY = { type: 'assistant', uuid: 'reply-1', parentUuid: 'prompt-1', message: { role: 'assistant', content: [{ type: 'text', text: 'on it' }] } }
const LATER_PROMPT = { type: 'user', uuid: 'prompt-2', parentUuid: 'reply-1', message: { role: 'user', content: 'thanks' } }
const COMMAND_FIRST = { type: 'user', uuid: 'command-1', parentUuid: null, message: { role: 'user', content: '<command-name>/model</command-name>' } }
const CAVEAT = { type: 'user', uuid: 'caveat-1', parentUuid: null, isMeta: true, message: { role: 'user', content: '<local-command-caveat>...</local-command-caveat>' } }

const mountPrompt = ($: Engine, requestId: string, isExpanded = false) =>
  $.ui.mount({
    plugin: 'slopothon',
    surface: 'terminal',
    component: 'UserMessage',
    requestId,
    props: { text: 'fix the flaky test', origin: { kind: 'composer' }, isExpanded },
    viewport: { columns: 120, rows: 40, isFullscreen: true },
  })

test('covers the logo above the first prompt of a session resumed from before the banner', async ($, on) => {
  answerSession(on, { messages: [PROMPT], transcript: [{ type: 'permission-mode' }, REPLY, FIRST_PROMPT, LATER_PROMPT] })
  on('ui.render', () => ENGINE_DRAWING)
  await resume($)
  const drawn = await (await mountPrompt($, 'prompt-1')).drawn()
  if (drawn?.type !== 'Box') throw new Error(`the first prompt drew ${drawn?.type ?? 'nothing'}, not a Box`)
  const rows = (drawn.children ?? []).map(flattenedText)
  expect(drawn.props?.marginTop).toBe(-7)
  expect(rows[3]).toMatch(/^▄▄▄▄▄▄ ▄▄ .*01 \/\/ MODEL/)
  expect(rows[7]).toMatch(/^\+ SESSION 8000-0000 /)
  expect(rows.at(-1)).toBe('engine')
})

const UNANCHORED_CASES: [name: string, transcript: object[], requestId: string, isExpanded: boolean][] = [
  ['a later prompt', [FIRST_PROMPT, REPLY, LATER_PROMPT], 'prompt-2', false],
  ['the first prompt in the ctrl+o transcript', [FIRST_PROMPT, REPLY], 'prompt-1', true],
  ['a prompt after a command opened the session', [COMMAND_FIRST, { ...LATER_PROMPT, parentUuid: 'command-1' }], 'prompt-2', false],
]

for (const [name, transcript, requestId, isExpanded] of UNANCHORED_CASES) {
  test(`leaves ${name} to the engine`, async ($, on) => {
    answerSession(on, { messages: [PROMPT], transcript })
    on('ui.render', () => ENGINE_DRAWING)
    await resume($)
    expect(flattenedText(await (await mountPrompt($, requestId, isExpanded)).drawn())).toBe('engine')
  })
}

test('trusts the resumed transcript over the messages a /resume inside a session still reports', async ($, on) => {
  answerSession(on, { messages: [BOOT_RECORD], transcript: [FIRST_PROMPT, REPLY] })
  on('ui.render', () => ENGINE_DRAWING)
  await $.classic.SessionStart({ source: 'resume', cwd: '/home/runner/code/app', transcript_path: '/home/runner/.claude/projects/app/s.jsonl' })
  const drawn = await (await mountPrompt($, 'prompt-1')).drawn()
  expect(drawn?.type === 'Box' ? drawn.props?.marginTop : 'not a Box').toBe(-7)
})

test('keeps covering from the boot row of a session that already has its banner', async ($, on) => {
  const bootEntry = { type: 'user', uuid: 'boot-1', parentUuid: 'caveat-1', message: { role: 'user', content: '<command-name>/slopothon</command-name>' } }
  answerSession(on, { messages: [BOOT_RECORD, PROMPT], transcript: [CAVEAT, bootEntry, { ...FIRST_PROMPT, parentUuid: 'boot-1' }] })
  await resume($)
  const { root } = await drawnBootRow($, 120)
  expect(root.props?.marginTop).toBe(-COVER_ROWS)
})

test('reads past the hidden caveat at the root to the first prompt', async ($, on) => {
  answerSession(on, { messages: [PROMPT], transcript: [CAVEAT, { ...FIRST_PROMPT, parentUuid: 'caveat-1' }] })
  on('ui.render', () => ENGINE_DRAWING)
  await resume($)
  const drawn = await (await mountPrompt($, 'prompt-1')).drawn()
  expect(drawn?.type === 'Box' ? drawn.props?.marginTop : 'not a Box').toBe(-7)
})

const RUN_WATCHER: Plugin = {
  name: 'run-watcher',
  tier: 'prepend',
  register: on => {
    on('command.run', { command: 'slopothon' }, async ($, e, next) => {
      await $.store.set('run', e.origin.kind)
      return next(e)
    })
  },
}

const BOOT_CASES: [name: string, session: Session, start: (engine: Engine) => Promise<unknown>, runs: string[]][] = [
  ['an empty fullscreen session', {}, startSession, ['plugin']],
  ['a fullscreen session /clear just emptied', { messages: [CLEAR_RECORD] }, startAfterClear, ['plugin']],
  ['a resumed session', { messages: [PROMPT] }, startSession, []],
  ['a resumed session that already has its banner', { messages: [BOOT_RECORD, PROMPT] }, startSession, []],
  ['a main-screen session', { tui: 'default' }, startSession, []],
]

for (const [name, session, start, runs] of BOOT_CASES) {
  test(`runs the boot command in ${name}: ${runs.length > 0 ? 'yes' : 'no'}`, { plugins: [RUN_WATCHER] }, async ($, on) => {
    const seen: unknown[] = []
    on('store.set', ($, e) => {
      seen.push(e.value)
      return { value: undefined }
    })
    answerSession(on, session)
    await start($)
    expect(seen).toEqual(runs)
  })
}
