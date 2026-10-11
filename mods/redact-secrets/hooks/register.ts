import type { Args, Register, ToolCallResult } from 'claude-code'
import { isKnownToken, mapStrings, redact, restore, stringsIn, tokensIn } from './redactor'

type ContentBlock = Args<'session.append'>['message']['content'][number]

const PLUGIN = 'redact-secrets'
const FS_READ_LIMIT_BYTES = 4 * 1024 * 1024
const FILE_WRITING_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit'])
const SHELL_TOOLS = new Set(['Bash', 'PowerShell'])

const REDACTION_NOTICE =
  'Secrets here are replaced with [REDACTED:<kind>:<id>] placeholders. Write and Edit put the real secret back wherever you pass a placeholder, so keep placeholders as they are when you edit or rewrite a file. Shell commands cannot carry them.'

function redactBlock(block: ContentBlock): ContentBlock {
  if (block.type === 'text' && typeof block.text === 'string') return { ...block, text: redact(block.text) }
  if (block.type !== 'tool_result') return block
  if (typeof block.content === 'string') return { ...block, content: redact(block.content) }
  if (Array.isArray(block.content)) return { ...block, content: block.content.map(redactBlock) }
  return block
}

function withheldBlock(block: ContentBlock): ContentBlock {
  const notice = `${PLUGIN} could not scan this for secrets, so it was withheld.`
  if (block.type === 'text') return { ...block, text: notice }
  if (block.type === 'tool_result') return { ...block, content: notice }
  return block
}

function redactToolResult(ran: ToolCallResult): ToolCallResult {
  if (ran.deny !== undefined) return ran
  if (ran.isError) {
    const error = ran.text ?? String(ran.result ?? '')
    const redacted = redact(error)
    return redacted === error ? ran : { deny: redacted }
  }
  const result = mapStrings(ran.result, redact)
  if (result === ran.result) return ran
  return { result, context: [...(ran.context ?? []), REDACTION_NOTICE] }
}

const unseenSecretNotice = (tokens: string[]) =>
  `${tokens.join(', ')} stands in for a secret this session no longer holds. Read the file it came from again, then retry with the new placeholder.`

const shellNotice = (tokens: string[]) =>
  `${tokens.join(', ')} stands in for a secret you cannot see, so a shell command cannot carry it. Use Write or Edit, which put the real secret back.`

const mentionNotice = (mention: string) =>
  `@${mention} holds secrets, so it was not attached. Read it with the Read tool, which redacts them.`

export const register: Register = on => {
  on('tool.call', async ($, e, next) => {
    const tokens = stringsIn(e).flatMap(tokensIn)
    if (tokens.length > 0 && SHELL_TOOLS.has(e.tool)) return { deny: shellNotice(tokens) }
    if (!FILE_WRITING_TOOLS.has(e.tool)) return redactToolResult(await next(e))
    const unseen = tokens.filter(token => !isKnownToken(token))
    if (unseen.length > 0) return { deny: unseenSecretNotice(unseen) }
    return redactToolResult(await next(mapStrings(e, restore)))
  }).catch(() => ({ deny: `${PLUGIN} could not scan this call for secrets, so it was withheld.` }))

  on('session.append', ($, e, next) =>
    next({ ...e, message: { ...e.message, content: e.message.content.map(redactBlock) } }),
  ).catch(($, e, next) =>
    next.called ? next(e) : next({ ...e, message: { ...e.message, content: e.message.content.map(withheldBlock) } }),
  )

  on('prompt.submit', ($, e, next) => {
    const text = redact(e.text)
    const context = (e.context ?? []).map(redact)
    const isRedacted = text !== e.text || context.some((entry, index) => entry !== e.context?.[index])
    return next({ ...e, text, ...(isRedacted ? { context: [...context, REDACTION_NOTICE] } : {}) })
  }).catch(($, e, next) => (next.called ? next(e) : { drop: `${PLUGIN} could not scan this prompt for secrets.` }))

  on('prompt.mention', async ($, e, next) => {
    const stat = await $.fs.stat(e.path).catch(() => undefined)
    if (stat === undefined || stat.kind !== 'file') return next(e)
    const text = stat.size > FS_READ_LIMIT_BYTES ? undefined : await $.fs.read(e.path)
    if (text !== undefined && redact(text) === text) return next(e)
    return { type: null, context: [mentionNotice(e.mention)] }
  }).catch(($, e, next) => (next.called ? next(e) : { type: null, context: [mentionNotice(e.mention)] }))

  on('telemetry.log', { to: 'collector' }, ($, e, next) =>
    e.to === 'collector' ? next({ ...e, attributes: mapStrings(e.attributes, redact) }) : next(e),
  ).catch(($, e, next) => (next.called ? next(e) : { deny: `${PLUGIN} could not scan this record for secrets.` }))
}
