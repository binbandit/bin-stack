import { highlight } from './highlight'
import type { Align, Block, Inline, ListItem } from './markdown'
import type { ChromaToken, StyleBlock, StyleColor, StyleConfig, StylePrimitive } from './style'

export type Paint = {
  color?: string
  backgroundColor?: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strikethrough?: boolean
  inverse?: boolean
  dimColor?: boolean
}

export type Span = { text: string; paint: Paint; href?: string }

export type Line = Span[]

const XTERM_256_INDEX = /^\d{1,3}$/
const TEMPLATE_TEXT_FIELD = /\{\{\s*\.text\s*\}\}/g
const NO_BREAK_SPACE = ' '
const MIN_COLUMN_WIDTH = 3

function colorOf(color: StyleColor): string {
  return XTERM_256_INDEX.test(color) ? `ansi256(${color})` : color
}

export function cascade(parent: Paint, style: StylePrimitive): Paint {
  const paint = { ...parent }
  if (style.color !== undefined) paint.color = colorOf(style.color)
  if (style.background_color !== undefined) paint.backgroundColor = colorOf(style.background_color)
  if (style.bold !== undefined) paint.bold = style.bold
  if (style.italic !== undefined) paint.italic = style.italic
  if (style.underline !== undefined) paint.underline = style.underline
  if (style.crossed_out !== undefined) paint.strikethrough = style.crossed_out
  if (style.inverse !== undefined) paint.inverse = style.inverse
  if (style.faint !== undefined) paint.dimColor = style.faint
  return paint
}

function decorate(style: StylePrimitive, token: string): string {
  const formatted = style.format?.replace(TEMPLATE_TEXT_FIELD, token) ?? token
  return [style.block_prefix, style.prefix, formatted, style.suffix, style.block_suffix].join('')
}

type CodePointRange = [low: number, high: number]

const ZERO_WIDTH: CodePointRange[] = [[0x300, 0x36f], [0x200b, 0x200f], [0xfe00, 0xfe0f]]

const DOUBLE_WIDTH: CodePointRange[] = [
  [0x1100, 0x115f], [0x2e80, 0x303e], [0x3041, 0x33ff], [0x3400, 0x4dbf], [0x4e00, 0x9fff], [0xa000, 0xa4cf],
  [0xac00, 0xd7a3], [0xf900, 0xfaff], [0xfe30, 0xfe4f], [0xff00, 0xff60], [0xffe0, 0xffe6], [0x1f300, 0x1f64f],
  [0x1f680, 0x1f6ff], [0x1f900, 0x1f9ff], [0x20000, 0x3fffd],
]

const isWithin = (code: number, ranges: CodePointRange[]) => ranges.some(([low, high]) => code >= low && code <= high)

function charCells(ch: string): number {
  const code = ch.codePointAt(0) ?? 0
  if (isWithin(code, ZERO_WIDTH)) return 0
  return isWithin(code, DOUBLE_WIDTH) ? 2 : 1
}

function cellsOf(text: string): number {
  let cells = 0
  for (const ch of text) cells += charCells(ch)
  return cells
}

function spansCells(spans: Span[]): number {
  return spans.reduce((cells, span) => cells + cellsOf(span.text), 0)
}

type Word = { parts: Span[]; cells: number }
type Piece = { kind: 'word'; word: Word } | { kind: 'space'; span: Span } | { kind: 'newline' }

function piecesOf(spans: Span[]): Piece[] {
  const pieces: Piece[] = []
  for (const span of spans) {
    for (const text of span.text.split(/(\n| +)/)) {
      if (text === '') continue
      const part = { ...span, text }
      const previous = pieces[pieces.length - 1]
      if (text === '\n') pieces.push({ kind: 'newline' })
      else if (text.startsWith(' ')) pieces.push({ kind: 'space', span: part })
      else if (previous?.kind === 'word') {
        previous.word.parts.push(part)
        previous.word.cells += cellsOf(text)
      } else pieces.push({ kind: 'word', word: { parts: [part], cells: cellsOf(text) } })
    }
  }
  return pieces
}

function samePaint(a: Paint, b: Paint): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)] as (keyof Paint)[])
  return [...keys].every(key => a[key] === b[key])
}

const looksTheSame = (a: Span, b: Span) => a.href === b.href && samePaint(a.paint, b.paint)

function append(line: Line, from: Span, text: string): void {
  const last = line[line.length - 1]
  if (last !== undefined && looksTheSame(last, from)) last.text += text
  else line.push({ ...from, text })
}

function wrap(spans: Span[], width: number): Line[] {
  const lines: Line[] = [[]]
  let used = 0
  let pendingGap: Span | undefined
  let keepsLeadingSpaces = true
  const startLine = ({ keepLeadingSpaces }: { keepLeadingSpaces: boolean }) => {
    lines.push([])
    used = 0
    pendingGap = undefined
    keepsLeadingSpaces = keepLeadingSpaces
  }
  const put = (part: Span, text = part.text) => {
    append(lines[lines.length - 1] as Line, part, text)
    used += cellsOf(text)
  }
  for (const piece of piecesOf(spans)) {
    if (piece.kind === 'newline') {
      startLine({ keepLeadingSpaces: true })
      continue
    }
    if (piece.kind === 'space') {
      if (used > 0) pendingGap = pendingGap === undefined ? piece.span : { ...pendingGap, text: pendingGap.text + piece.span.text }
      else if (keepsLeadingSpaces) put(piece.span)
      continue
    }
    const { word } = piece
    const gapCells = pendingGap === undefined ? 0 : cellsOf(pendingGap.text)
    if (used > 0 && used + gapCells + word.cells > width) startLine({ keepLeadingSpaces: false })
    else if (pendingGap !== undefined) put(pendingGap)
    pendingGap = undefined
    if (word.cells <= width - used) {
      for (const part of word.parts) put(part)
      continue
    }
    for (const part of word.parts) {
      for (const ch of part.text) {
        if (used > 0 && used + charCells(ch) > width) startLine({ keepLeadingSpaces: false })
        put(part, ch)
      }
    }
  }
  return lines
}

function cutAtEdge(line: Line, width: number): Line[] {
  const lines: Line[] = [[]]
  let used = 0
  for (const span of line) {
    for (const ch of span.text) {
      const cells = charCells(ch)
      if (used > 0 && used + cells > width) {
        lines.push([])
        used = 0
      }
      append(lines[lines.length - 1] as Line, span, ch)
      used += cells
    }
  }
  return lines
}

type InlineDrawer<K extends Inline['kind']> = (node: Extract<Inline, { kind: K }>, paint: Paint, style: StyleConfig) => Span[]

function inlineSpans(nodes: Inline[], paint: Paint, style: StyleConfig): Span[] {
  return nodes.flatMap(node => (INLINE_DRAWERS[node.kind] as InlineDrawer<typeof node.kind>)(node as never, paint, style))
}

const withNoBreakSpaces = (text = '') => text.replaceAll(' ', NO_BREAK_SPACE)

const INLINE_DRAWERS: { [K in Inline['kind']]: InlineDrawer<K> } = {
  text: (node, paint, style) => [{ text: node.text, paint: cascade(paint, style.text) }],
  emph: (node, paint, style) => inlineSpans(node.children, cascade(paint, style.emph), style),
  strong: (node, paint, style) => inlineSpans(node.children, cascade(paint, style.strong), style),
  strike: (node, paint, style) => inlineSpans(node.children, cascade(paint, style.strikethrough), style),
  code: (node, paint, style) => [
    {
      text: withNoBreakSpaces(style.code.prefix) + node.text + withNoBreakSpaces(style.code.suffix),
      paint: cascade(paint, style.code),
    },
  ],
  link: (node, paint, style) => [
    ...inlineSpans(node.children, cascade(paint, style.link_text), style).map(span => ({ ...span, href: node.href })),
    { text: ' ', paint },
    { text: node.href, paint: cascade(paint, style.link), href: node.href },
  ],
  autolink: (node, paint, style) => [{ text: node.href, paint: cascade(paint, style.link), href: node.href }],
  image: (node, paint, style) => [
    ...(node.alt === '' ? [] : [{ text: decorate(style.image_text, node.alt), paint: cascade(paint, style.image_text) }, { text: ' ', paint }]),
    { text: node.href, paint: cascade(paint, style.image), href: node.href },
  ],
  break: (_, paint) => [{ text: '\n', paint }],
}

type Context = { style: StyleConfig; width: number; paint: Paint; depth: number }

type BlockDrawer<K extends Block['kind']> = (block: Extract<Block, { kind: K }>, context: Context) => Line[]

function drawBlock(block: Block, context: Context): Line[] {
  return (BLOCK_DRAWERS[block.kind] as BlockDrawer<typeof block.kind>)(block as never, context)
}

function drawBlocks(blocks: Block[], context: Context, gap: number): Line[] {
  return blocks.flatMap((block, i) => [
    ...Array.from({ length: i > 0 ? gap : 0 }, (): Line => []),
    ...drawBlock(block, context),
  ])
}

function framed(rules: StyleBlock, context: Context, draw: (inner: Context) => Line[]): Line[] {
  const margin = rules.margin ?? 0
  const indent = (rules.indent_token ?? ' ').repeat(rules.indent ?? 0)
  const lead = ' '.repeat(margin) + indent
  const width = Math.max(context.width - margin * 2 - cellsOf(indent), 1)
  const lines = draw({ ...context, width, paint: cascade(context.paint, rules) })
  return lead === '' ? lines : lines.map(line => [{ text: lead, paint: context.paint }, ...line])
}

const CHROMA_PARENT: Partial<Record<ChromaToken, ChromaToken>> = {
  keyword_reserved: 'keyword',
  keyword_namespace: 'keyword',
  keyword_type: 'keyword',
  comment_preproc: 'comment',
  name_builtin: 'name',
  name_tag: 'name',
  name_attribute: 'name',
  name_class: 'name',
  name_constant: 'name',
  name_decorator: 'name',
  name_exception: 'name',
  name_function: 'name',
  name_other: 'name',
  literal_number: 'literal',
  literal_date: 'literal',
  literal_string: 'literal',
  literal_string_escape: 'literal_string',
}

function lineageOf(kind: ChromaToken): ChromaToken[] {
  const parent = CHROMA_PARENT[kind]
  return parent === undefined ? [kind] : [...lineageOf(parent), kind]
}

function markerOf(list: Extract<Block, { kind: 'list' }>, item: ListItem, index: number, context: Context): Span {
  const { style, paint } = context
  if (item.checked !== undefined) {
    return { text: decorate(style.task, (item.checked ? style.task.ticked : style.task.unticked) ?? ''), paint: cascade(paint, style.task) }
  }
  if (list.ordered) return { text: `${list.start + index}` + decorate(style.enumeration, ''), paint: cascade(paint, style.enumeration) }
  return { text: decorate(style.item, ''), paint: cascade(paint, style.item) }
}

function itemLines(item: ListItem, marker: Span, context: Context): Line[] {
  const markerCells = cellsOf(marker.text)
  const hangingIndent = { text: ' '.repeat(markerCells), paint: context.paint }
  const textContext = { ...context, width: Math.max(context.width - markerCells, 1) }
  const lines: Line[] = []
  for (const block of item.blocks) {
    const isNestedList = block.kind === 'list' && lines.length > 0
    if (isNestedList) {
      lines.push(...drawBlock(block, context))
      continue
    }
    for (const line of drawBlock(block, textContext)) lines.push([lines.length === 0 ? marker : hangingIndent, ...line])
  }
  return lines.length === 0 ? [[marker]] : lines
}

function aligned(line: Line, width: number, align: Align, paint: Paint): Line {
  const room = Math.max(width - spansCells(line), 0)
  const before = align === 'right' ? room : align === 'center' ? Math.floor(room / 2) : 0
  const pad = (cells: number): Line => (cells > 0 ? [{ text: ' '.repeat(cells), paint }] : [])
  return [...pad(before), ...line, ...pad(room - before)]
}

function shrinkWidestColumnsToFit(natural: number[], room: number): number[] {
  const widths = [...natural]
  while (widths.reduce((sum, w) => sum + w, 0) > room) {
    const widest = widths.indexOf(Math.max(...widths))
    if ((widths[widest] ?? 0) <= MIN_COLUMN_WIDTH) break
    widths[widest] = (widths[widest] ?? 0) - 1
  }
  return widths
}

const BLOCK_DRAWERS: { [K in Block['kind']]: BlockDrawer<K> } = {
  paragraph: (block, context) => wrap(inlineSpans(block.content, cascade(context.paint, context.style.paragraph), context.style), context.width),

  heading: (block, context) => {
    const { style } = context
    const level = style[`h${block.level}` as 'h1'] ?? {}
    const rules = { ...style.heading, ...level }
    const paint = cascade(cascade(context.paint, style.heading), level)
    const lines = wrap([{ text: rules.prefix ?? '', paint }, ...inlineSpans(block.content, paint, style)], context.width)
    const lastLine = lines[lines.length - 1]
    if (rules.suffix && lastLine !== undefined) append(lastLine, { text: rules.suffix, paint }, rules.suffix)
    return lines
  },

  code: (block, context) =>
    framed(context.style.code_block, context, inner => {
      const { chroma } = context.style.code_block
      const base = chroma === undefined ? inner.paint : [chroma.background, chroma.text].reduce<Paint>((paint, rules) => cascade(paint, rules ?? {}), {})
      const tokens = chroma === undefined ? [{ text: block.text, kind: 'text' as const }] : highlight(block.text, block.language)
      const lines: Line[] = [[]]
      for (const token of tokens) {
        const paint = chroma === undefined ? base : lineageOf(token.kind).reduce((p, kind) => cascade(p, chroma[kind] ?? {}), base)
        token.text.split('\n').forEach((text, i) => {
          if (i > 0) lines.push([])
          if (text !== '') append(lines[lines.length - 1] as Line, { text, paint }, text)
        })
      }
      return lines.flatMap(line => cutAtEdge(line, inner.width))
    }),

  quote: (block, context) => framed(context.style.block_quote, context, inner => drawBlocks(block.blocks, inner, 1)),

  list: (block, context) => {
    const { list } = context.style
    const isNested = context.depth > 0
    const rules = { ...list, indent: isNested ? list.level_indent ?? 0 : list.indent ?? 0 }
    return framed(rules, { ...context, depth: context.depth + 1 }, inner =>
      block.items.flatMap((item, i) => itemLines(item, markerOf(block, item, i, inner), inner)),
    )
  },

  hr: (_, context) => {
    const rule = decorate(context.style.hr, '').replace(/^\n+|\n+$/g, '')
    const paint = cascade(context.paint, context.style.hr)
    return rule.split('\n').map(text => [{ text, paint }])
  },

  table: (block, context) => {
    const { style } = context
    const paint = cascade(context.paint, style.table)
    const head = block.head.map(cell => inlineSpans(cell, paint, style))
    const rows = block.rows.map(row => row.map(cell => inlineSpans(cell, paint, style)))
    const natural = block.align.map((_, c) => Math.max(1, ...[head, ...rows].map(row => spansCells(row[c] ?? []))))
    const columnCount = block.align.length
    const cellPaddingCells = columnCount * 2
    const separatorCells = columnCount - 1
    const widths = shrinkWidestColumnsToFit(natural, context.width - cellPaddingCells - separatorCells)
    const separator = style.table.column_separator ?? '│'
    const rowLines = (cells: Span[][]): Line[] => {
      const wrapped = widths.map((width, c) => wrap(cells[c] ?? [], width))
      const height = Math.max(...wrapped.map(lines => lines.length))
      return Array.from({ length: height }, (_, r) =>
        widths.flatMap((width, c): Line => [
          ...(c > 0 ? [{ text: separator, paint }] : []),
          { text: ' ', paint },
          ...aligned(wrapped[c]?.[r] ?? [], width, block.align[c] ?? 'none', paint),
          { text: ' ', paint },
        ]),
      )
    }
    const rule = widths.map(width => (style.table.row_separator ?? '─').repeat(width + 2)).join(style.table.center_separator ?? '┼')
    return [...rowLines(head), [{ text: rule, paint }], ...rows.flatMap(rowLines)]
  },
}

export function layout(blocks: Block[], style: StyleConfig, columns: number): Line[] {
  return framed(style.document, { style, width: columns, paint: {}, depth: 0 }, inner => drawBlocks(blocks, inner, 1))
}
