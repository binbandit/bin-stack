import { SECRET_RULES } from './rules'

type Span = { start: number; end: number; kind: string }

const TOKEN = /\[REDACTED:[a-z0-9-]+:[0-9a-f]{8}\]/g
const TOKEN_OR_PLAIN = /(\[REDACTED:[a-z0-9-]+:[0-9a-f]{8}\])/
const LINE_BREAK = /(\r?\n)/
const MIN_KNOWN_SECRET_LENGTH = 8
const CHARACTER_CLASSES = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/]

const tokenBySecret = new Map<string, string>()
const secretByToken = new Map<string, string>()

function tokenFor(secret: string, kind: string): string {
  const known = tokenBySecret.get(secret)
  if (known !== undefined) return known
  const token = `[REDACTED:${kind}:${crypto.randomUUID().slice(0, 8)}]`
  tokenBySecret.set(secret, token)
  secretByToken.set(token, secret)
  return token
}

function ruleSpans(text: string): Span[] {
  return SECRET_RULES.flatMap(rule =>
    [...text.matchAll(rule.pattern)].flatMap(match => {
      const [start, end] = match.indices?.groups?.secret ?? [match.index, match.index + match[0].length]
      const candidate = text.slice(start, end)
      if (candidate.trim() === '' || rule.isSecret?.(candidate) === false) return []
      return [{ start, end, kind: rule.kind }]
    }),
  )
}

const isDistinctive = (secret: string) =>
  secret.length >= MIN_KNOWN_SECRET_LENGTH && CHARACTER_CLASSES.filter(characters => characters.test(secret)).length >= 2

function knownSecretSpans(text: string): Span[] {
  return [...tokenBySecret].flatMap(([secret, token]) => {
    if (!isDistinctive(secret)) return []
    const kind = token.split(':')[1] ?? 'secret'
    const spans: Span[] = []
    for (let start = text.indexOf(secret); start !== -1; start = text.indexOf(secret, start + secret.length)) {
      spans.push({ start, end: start + secret.length, kind })
    }
    return spans
  })
}

function withoutOverlaps(spans: Span[]): Span[] {
  const byStartThenLongest = spans.toSorted((a, b) => a.start - b.start || b.end - a.end)
  const kept: Span[] = []
  for (const span of byStartThenLongest) {
    const last = kept.at(-1)
    if (last === undefined || span.start >= last.end) kept.push(span)
  }
  return kept
}

const tokenizeLines = (secret: string, kind: string) =>
  secret
    .split(LINE_BREAK)
    .map(part => (part === '' || LINE_BREAK.test(part) ? part : tokenFor(part, kind)))
    .join('')

function redactPlain(text: string): string {
  const spans = withoutOverlaps([...ruleSpans(text), ...knownSecretSpans(text)])
  if (spans.length === 0) return text
  let redacted = ''
  let cursor = 0
  for (const span of spans) {
    redacted += text.slice(cursor, span.start) + tokenizeLines(text.slice(span.start, span.end), span.kind)
    cursor = span.end
  }
  return redacted + text.slice(cursor)
}

export const redact = (text: string) =>
  text
    .split(TOKEN_OR_PLAIN)
    .map((part, index) => (index % 2 === 1 ? part : redactPlain(part)))
    .join('')

export const restore = (text: string) => text.replace(TOKEN, token => secretByToken.get(token) ?? token)

export const tokensIn = (text: string) => text.match(TOKEN) ?? []

export const isKnownToken = (token: string) => secretByToken.has(token)

export function mapStrings<T>(value: T, map: (text: string) => string): T {
  if (typeof value === 'string') return map(value) as T
  if (Array.isArray(value)) {
    const mapped = value.map(item => mapStrings(item, map))
    return mapped.some((item, index) => item !== value[index]) ? (mapped as T) : value
  }
  if (typeof value !== 'object' || value === null) return value
  const entries = Object.entries(value)
  const mapped = entries.map(([key, item]) => [key, mapStrings(item, map)] as const)
  return mapped.some(([, item], index) => item !== entries[index]?.[1]) ? (Object.fromEntries(mapped) as T) : value
}

export function stringsIn(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (typeof value !== 'object' || value === null) return []
  return Object.values(value).flatMap(stringsIn)
}
