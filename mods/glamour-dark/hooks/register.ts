import type { Register } from 'claude-code'
import { cascade, layout, type Line, type Paint, type Span } from './layout'
import { parse, type Block } from './markdown'
import { splitSentences } from './sentences'
import { DARK, type StyleConfig } from './style'

const REPLY_STYLE: StyleConfig = DARK
const REWRITES_BEFORE_LAYOUT: ((blocks: Block[]) => Block[])[] = [splitSentences]
const ENGINE_EDGE_COLUMNS = 2
const UNMEASURED_TERMINAL_COLUMNS = 120
const BULLET = '●'
const BLANK_ROW_TEXT = ' '

function withBulletInMargin(lines: Line[], paint: Paint): Line[] {
  const [first, ...rest] = lines
  const leftMargin = first?.[0]
  if (first === undefined || leftMargin === undefined || !leftMargin.text.startsWith('  ')) return lines
  return [[{ text: BULLET, paint }, { ...leftMargin, text: leftMargin.text.slice(1) }, ...first.slice(1)], ...rest]
}

const newlinesIn = (text = '') => text.split('\n').length - 1

export const register: Register = on => {
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (e.surface !== 'terminal' || e.props.isSummary) return next(e)
    const blocks = REWRITES_BEFORE_LAYOUT.reduce((tree, rewrite) => rewrite(tree), parse(e.props.text))
    if (blocks.length === 0) return next(e)

    const { Box, Text, Link } = $.ui.resolve(e)
    const columns = (e.viewport?.columns ?? UNMEASURED_TERMINAL_COLUMNS) - ENGINE_EDGE_COLUMNS
    const laidOut = layout(blocks, REPLY_STYLE, columns)
    const lines = e.props.isFirstOfReply ? withBulletInMargin(laidOut, cascade({}, REPLY_STYLE.document)) : laidOut

    const drawSpan = (span: Span) => {
      const text = Text({ ...span.paint, children: [span.text] })
      return span.href === undefined ? text : Link({ href: span.href, children: [text] })
    }
    return Box({
      flexDirection: 'column',
      marginTop: newlinesIn(REPLY_STYLE.document.block_prefix),
      marginBottom: newlinesIn(REPLY_STYLE.document.block_suffix),
      children: lines.map(line => Text({ children: line.length === 0 ? [BLANK_ROW_TEXT] : line.map(drawSpan) })),
    })
  })
}
