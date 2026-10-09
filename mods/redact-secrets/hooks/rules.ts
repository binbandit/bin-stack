export type SecretRule = {
  kind: string
  pattern: RegExp
  isSecret?: (candidate: string) => boolean
}

const capitalized = (segment: string) => segment.charAt(0).toUpperCase() + segment.slice(1)

function nameSegment(...segments: string[]): string {
  const [head = '', ...tail] = segments
  const lower = `(?<![A-Za-z0-9])${segments.join('[_-]?')}(?![a-z])`
  const upper = `(?<![A-Za-z0-9])${segments.map(segment => segment.toUpperCase()).join('[_-]?')}(?![A-Z])`
  const camel = `${segments.map(capitalized).join('')}(?![a-z])`
  const headless = `(?<![A-Za-z0-9])${head}${tail.map(capitalized).join('')}(?![a-z])`
  return `(?:${[lower, upper, camel, ...(tail.length > 0 ? [headless] : [])].join('|')})`
}

const anyCase = (word: string) => `${word}|${capitalized(word)}|${word.toUpperCase()}`

const SECRET_WORD = [
  nameSegment('password'),
  nameSegment('passwd'),
  nameSegment('passphrase'),
  nameSegment('secret'),
  nameSegment('token'),
  nameSegment('credentials'),
  nameSegment('credential'),
  ...['api', 'access', 'private', 'signing', 'encryption', 'master', 'auth'].map(prefix => nameSegment(prefix, 'key')),
].join('|')

const NOT_A_SECRET_NAME_SUFFIXES = ['url', 'uri', 'path', 'file', 'dir', 'endpoint', 'type', 'name', 'header', 'field']
  .concat(['length', 'size', 'count', 'ttl', 'expiry', 'prefix', 'env', 'id'])
  .map(anyCase)
  .join('|')
const SECRET_NAME = String.raw`[\w.-]{0,40}(?:${SECRET_WORD})[\w.-]{0,40}(?<!${NOT_A_SECRET_NAME_SUFFIXES})`

const PEM_LINE = String.raw`(?:[A-Za-z0-9+/=]{1,128}|[A-Za-z-]{1,32}: [^\r\n\\]{0,128})`
const PEM_BREAK = String.raw`(?:\r?\n|\\n)`
const PEM_END = String.raw`-----END[A-Z0-9 ]{0,40}PRIVATE KEY`

const PLACEHOLDER = /^(?:\$\{.*\}|\$\(.*\)|\$\w+|%\w+%|\{\{.*\}\}|<.*>|[x*•.-]+)$|your|example|placeholder|changeme|dummy|fake|sample|redacted|x{4,}|\.\.\.|…/i
const NOT_A_VALUE = /^(?:[a-z][a-z0-9+.-]*:\/\/|[/~.:=]|[\^~<>=v]*\d+\.\d+)/i
const ENV_VAR_REFERENCE = /(?:^|[/.:])[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/
const CODE_EXPRESSION = /[()[\]{}<>&]|;$|^!|^[A-Za-z_$][\w$]*(?:\??\.[A-Za-z_$][\w$]*)+$/
const BARE_WORD = /^[A-Za-z_$]+$/

const isLiteralSecret = (candidate: string) =>
  !PLACEHOLDER.test(candidate) &&
  !NOT_A_VALUE.test(candidate) &&
  !ENV_VAR_REFERENCE.test(candidate) &&
  !/^\d+$/.test(candidate) &&
  (/[\d\W_]/.test(candidate) || candidate.length >= 12)

const isEnvValueSecret = (candidate: string) => isLiteralSecret(candidate) && !CODE_EXPRESSION.test(candidate)

const isUnquotedSecret = (candidate: string) => isEnvValueSecret(candidate) && !BARE_WORD.test(candidate)

export const SECRET_RULES: readonly SecretRule[] = [
  {
    kind: 'private-key',
    pattern: new RegExp(
      String.raw`-----BEGIN[A-Z0-9 ]{0,40}PRIVATE KEY(?: BLOCK)?-----${PEM_BREAK}(?<secret>(?:${PEM_LINE})?(?:${PEM_BREAK}(?:${PEM_LINE})?)*?)(?=${PEM_BREAK}${PEM_END}|${PEM_BREAK}?$)`,
      'dg',
    ),
  },
  {
    kind: 'private-key',
    pattern: new RegExp(String.raw`^(?<secret>(?:[A-Za-z0-9+/=]{1,128}${PEM_BREAK})+)${PEM_END}`, 'dg'),
  },
  { kind: 'aws-access-key', pattern: /\b(?:AKIA|ASIA|ABIA|ACCA)[A-Z0-9]{16}\b/g },
  { kind: 'github-token', pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_\w{22,255})\b/g },
  { kind: 'gitlab-token', pattern: /\bglpat-[\w-]{20,}/g },
  { kind: 'anthropic-key', pattern: /\bsk-ant-[\w-]{20,}/g },
  { kind: 'openai-key', pattern: /\bsk-(?:(?:proj|svcacct|admin)-[\w-]{20,}|[A-Za-z0-9]{32,}\b)/g },
  { kind: 'stripe-key', pattern: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g },
  { kind: 'slack-token', pattern: /\bxox[abposr]-[A-Za-z0-9-]{10,}/g },
  { kind: 'slack-webhook', pattern: /\bhttps:\/\/hooks\.slack\.com\/(?:services|workflows|triggers)\/[\w/+-]{20,}/g },
  { kind: 'google-api-key', pattern: /\bAIza[\w-]{35}(?![\w-])/g },
  { kind: 'npm-token', pattern: /\bnpm_[A-Za-z0-9]{36}\b/g },
  { kind: 'huggingface-token', pattern: /\bhf_[A-Za-z0-9]{34,}\b/g },
  { kind: 'sendgrid-key', pattern: /\bSG\.[\w-]{22}\.[\w-]{43}\b/g },
  { kind: 'jwt', pattern: /\beyJ[\w-]{8,}\.eyJ[\w-]{8,}\.[\w-]{8,}/g },
  {
    kind: 'url-password',
    pattern: /\b[a-z][a-z0-9+.-]{0,20}:\/\/[^\s:/@]{1,256}:(?<secret>[^\s:/@]{1,256})@/dgi,
    isSecret: isLiteralSecret,
  },
  {
    kind: 'auth-header',
    pattern: /\b(?:[Bb]earer|Basic)\s+(?<secret>[\w.~+/-]{16,}=*)/dg,
    isSecret: candidate => !PLACEHOLDER.test(candidate),
  },
  {
    kind: 'credential',
    pattern: new RegExp(String.raw`^[ \t]*(?:export[ \t]+)?${SECRET_NAME}=(?<secret>[^\s"'\x60#]{6,})`, 'dgm'),
    isSecret: isEnvValueSecret,
  },
  {
    kind: 'credential',
    pattern: new RegExp(
      String.raw`(?<![\w.-])["']?${SECRET_NAME}["']?\s*(?::=|=>|=|:)\s*(?<quote>["'\x60])(?<secret>[^\s"'\x60\\]{6,})\k<quote>`,
      'dg',
    ),
    isSecret: isLiteralSecret,
  },
  {
    kind: 'credential',
    pattern: new RegExp(String.raw`(?<![\w.-])${SECRET_NAME}[ \t]*[=:][ \t]*(?<secret>[^\s"'\x60,;)}\]]{6,})`, 'dg'),
    isSecret: isUnquotedSecret,
  },
]
