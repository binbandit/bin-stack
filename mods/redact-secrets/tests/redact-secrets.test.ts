import { expect, mock, test } from 'claude-code/testing'
import { redact } from '../hooks/redactor'

const GITHUB_TOKEN = 'ghp' + '_' + 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8'
const DB_PASSWORD = 'hunter2' + 'hunter2'
const ENV_FILE = `APP_NAME=demo\nGITHUB_TOKEN=${GITHUB_TOKEN}\nDB_PASSWORD=${DB_PASSWORD}\n`
const TOKEN = /\[REDACTED:[a-z0-9-]+:[0-9a-f]{8}\]/g
const ENV_PATH = '/repo/.env'

const readResult = (content: string) => ({
  type: 'text',
  file: { filePath: ENV_PATH, content, numLines: content.split('\n').length, startLine: 1, totalLines: 4 },
})

const contentOf = (ran: unknown) => (ran as { result: { file: { content: string } } }).result.file.content

test('redacts each kind of secret and leaves the rest of the text alone', () => {
  const pemBody = ['MIIEowIBAAKCAQEA0Z3VS5JJcds3xfn', 'pBs4cq8AxE2Yk']
  const secrets = [
    'AKIA' + 'Z7XQ3MNB4K2PL5VD',
    'sk-ant-' + 'api03-' + 'Qm9vZ2xlIGlzIG5vdCBhIHNlY3JldA-abcdefgh',
    'xoxb-' + '1234567890-abcdefghij',
    'eyJhbGciOiJIUzI1NiJ9' + '.eyJzdWIiOiIxMjM0NTY3ODkwIn0' + '.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
  ]
  const text = [
    ...secrets.map(secret => `value: ${secret}`),
    `postgres://admin:${DB_PASSWORD}@db.internal:5432/app`,
    `curl -H "Authorization: Bearer ${GITHUB_TOKEN.slice(4)}"`,
    `const config = { password: "${DB_PASSWORD}" }`,
    '-----BEGIN RSA PRIVATE KEY-----',
    ...pemBody,
    '-----END RSA PRIVATE KEY-----',
  ].join('\n')
  const redacted = redact(text)
  for (const secret of [...secrets, ...pemBody, DB_PASSWORD, GITHUB_TOKEN.slice(4)]) {
    expect(redacted.includes(secret)).toBe(false)
  }
  expect(redacted.split('\n').length).toBe(text.split('\n').length)
  expect(redacted).toContain('-----BEGIN RSA PRIVATE KEY-----')
  expect(redacted).toContain('postgres://admin:[REDACTED:url-password:')
})

test('keeps code, placeholders and counts that only look like secrets', () => {
  const lookalikes = [
    'const token = await getToken()',
    'password: process.env.DB_PASSWORD,',
    'interface Session { token: TokenType }',
    'TOKEN_URL=https://example.com/oauth/token',
    'max_tokens: 100000',
    'API_KEY=${API_KEY}',
    'PASSWORD_MIN_LENGTH=123456',
    'secret_name: "my-tls-secret"',
    'credentials: "include"',
    'const header = "-----BEGIN PRIVATE KEY-----\\n"',
    '"tiktoken": "^1.0.15",',
    'pub api_key: Option<String>,',
    'api_key: os.environ/OPENAI_API_KEY',
    'req.session.csrfToken = undefined;',
    'url: socks5://username:password@example.com:1080',
    'OPENAI_API_KEY="sk-..."',
  ].join('\n')
  expect(redact(lookalikes)).toBe(lookalikes)
})

test('gives one secret the same placeholder everywhere and catches it later out of context', () => {
  const first = redact(`DB_PASSWORD=${DB_PASSWORD}`)
  const [placeholder] = first.match(TOKEN) ?? []
  expect(redact(`echo ${DB_PASSWORD}`)).toBe(`echo ${placeholder}`)
  expect(redact(first)).toBe(first)
})

test('never spreads a plain word it redacted once to the rest of the text', () => {
  const plainWord = 'correcthorsebattery'
  expect(redact(`api_key = "${plainWord}"`)).not.toContain(plainWord)
  expect(redact(`the ${plainWord} story`)).toBe(`the ${plainWord} story`)
})

test('redacts a Read result before the model or the transcript gets it', async ($, on) => {
  on('tool.call', { tool: 'Read' }, () => ({ result: readResult(ENV_FILE) }))
  const ran = await $.tool.call({ tool: 'Read', file_path: ENV_PATH })
  const content = contentOf(ran)
  expect(content).toContain('APP_NAME=demo')
  expect(content.includes(GITHUB_TOKEN)).toBe(false)
  expect(content.includes(DB_PASSWORD)).toBe(false)
  expect(content.match(TOKEN)?.length).toBe(2)
  expect(ran.context?.at(-1)).toContain('Write and Edit put the real secret back')
})

test('passes a result with no secrets through untouched', async ($, on) => {
  const clean = { result: readResult('APP_NAME=demo\n'), text: '1\tAPP_NAME=demo', ref: 7 }
  on('tool.call', { tool: 'Read' }, () => clean)
  expect(await $.tool.call({ tool: 'Read', file_path: ENV_PATH })).toEqual(clean)
})

test('redacts what a failed shell command printed', async ($, on) => {
  const printed = `Exit code 3\n${ENV_FILE}`
  on('tool.call', { tool: 'Bash' }, () => ({ isError: true, result: `Error: ${printed}`, text: printed }))
  const ran = await $.tool.call({ tool: 'Bash', command: 'cat .env; exit 3' })
  const text = ran.deny ?? ran.text ?? ''
  expect(text).toContain('Exit code 3')
  expect(text.includes(GITHUB_TOKEN)).toBe(false)
})

test('puts the real secret back when Claude writes a placeholder to a file', async ($, on) => {
  let written = ''
  on('tool.call', { tool: 'Read' }, () => ({ result: readResult(ENV_FILE) }))
  on('tool.call', { tool: 'Write' }, ($, e) => {
    written = String(e.content)
    return { result: { type: 'update', filePath: ENV_PATH, content: written } }
  })
  const redactedFile = contentOf(await $.tool.call({ tool: 'Read', file_path: ENV_PATH }))
  const ran = await $.tool.call({ tool: 'Write', file_path: ENV_PATH, content: `${redactedFile}LOG_LEVEL=debug\n` })
  expect(written).toBe(`${ENV_FILE}LOG_LEVEL=debug\n`)
  expect(JSON.stringify(ran).includes(GITHUB_TOKEN)).toBe(false)
})

test('refuses placeholders it cannot put back, and shell commands that carry one', async ($, on) => {
  let hasRun = false
  on('tool.call', () => {
    hasRun = true
    return { result: '' }
  })
  const stale = '[REDACTED:github-token:0badf00d]'
  const write = await $.tool.call({ tool: 'Write', file_path: ENV_PATH, content: `GITHUB_TOKEN=${stale}\n` })
  expect(write.isError ? write.text : write.deny).toContain('no longer holds')
  const shell = await $.tool.call({ tool: 'Bash', command: `echo "${stale}" >> .env` })
  expect(shell.isError ? shell.text : shell.deny).toContain('cannot carry it')
  expect(hasRun).toBe(false)
})

test('redacts every row before the session stores it', async ($, on) => {
  const session = mock.session(on)
  await $.session.append({
    message: { type: 'user', role: 'user', content: [{ type: 'text', text: `my token is ${GITHUB_TOKEN}` }] },
    door: 'prompt',
    origin: { kind: 'composer' },
    uuid: crypto.randomUUID(),
  })
  const [row] = session.appended()
  const stored = JSON.stringify(row?.message.content)
  expect(stored.includes(GITHUB_TOKEN)).toBe(false)
  expect(stored).toContain('my token is [REDACTED:github-token:')
})

test('redacts a pasted secret before the prompt is queued', async ($, on) => {
  let submitted = ''
  on('prompt.submit', ($, e) => {
    submitted = e.text
    return { text: e.text }
  })
  await $.prompt.submit({ text: `use ${GITHUB_TOKEN} for the API`, wait: false, origin: { kind: 'composer' } })
  expect(submitted).toMatch(/^use \[REDACTED:github-token:[0-9a-f]{8}\] for the API$/)
})

test('sends a mentioned file that holds secrets through Read instead of attaching it', async ($, on) => {
  let isAttached = false
  on('fs.stat', () => ({ value: { kind: 'file', size: ENV_FILE.length, mtimeMs: 0, isLink: false } }))
  on('fs.read', () => ({ value: ENV_FILE }))
  on('prompt.mention', () => {
    isAttached = true
    return { type: 'file' }
  })
  const answer = await $.prompt.mention({ mention: '.env', path: ENV_PATH })
  expect(isAttached).toBe(false)
  expect(answer.type).toBe(null)
  expect(answer.context?.[0]).toContain('Read it with the Read tool')
})
