import type { Register } from 'claude-code'

type Hint = { key: string; action: string }

const VOLT = '#C8FF00'
const SEPARATOR = '  //  '

const CARRIED_MODE_LABEL = /^(?:[\w']+ )+on(?: · | (?=\()|$)/
const KEYED_HINT = /^\(?([^\s()]+) (?:to|for) ([^()]+?)\)?$/
const ARROW_HINT = /^([←→↑↓]) (.+)$/

const KEY_GLYPHS: Record<string, string> = {
  shift: '⇧',
  tab: '⇥',
  ctrl: '⌃',
  opt: '⌥',
  alt: '⌥',
  cmd: '⌘',
  enter: '⏎',
  return: '⏎',
}

const glyphsOf = (key: string) =>
  key
    .split('+')
    .map(part => KEY_GLYPHS[part.toLowerCase()] ?? part.toUpperCase())
    .join('')

function hintOf(part: string): Hint | undefined {
  const [, key, action] = KEYED_HINT.exec(part) ?? ARROW_HINT.exec(part) ?? []
  return key === undefined || action === undefined ? undefined : { key, action }
}

const isHint = (hint: Hint | undefined): hint is Hint => hint !== undefined

export const register: Register = on => {
  on('ui.render', { component: 'PromptHint' }, ($, e, next) => {
    if (e.surface !== 'terminal') return next(e)
    const hints = e.props.hint.replace(CARRIED_MODE_LABEL, '').split(' · ').filter(part => part !== '').map(hintOf)
    if (hints.length === 0 || !hints.every(isHint)) return next(e)
    const { Text } = $.ui.resolve(e)
    return Text({
      wrap: 'truncate-end',
      children: hints.flatMap(({ key, action }, index) => [
        ...(index === 0 ? [] : [Text({ dimColor: true, children: [SEPARATOR] })]),
        Text({ color: VOLT, bold: true, children: [glyphsOf(key)] }),
        Text({ dimColor: true, children: [` ${action.toUpperCase()}`] }),
      ]),
    })
  })
}
