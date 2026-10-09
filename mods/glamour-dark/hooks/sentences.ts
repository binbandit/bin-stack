import { plainText, type Block, type Inline } from './markdown'

const ABBREVIATION = /(?:^|[\s(])(?:e\.g|i\.e|etc|vs|cf|approx|al|Mr|Mrs|Ms|Dr|St|No|Fig)\.$/i
const INITIAL = /(?:^|\s)\p{Lu}\.$/u
const SENTENCE_END = /[.!?]["'”’)\]]*$/
const LOWERCASE = /\p{Ll}/u

function endsSentence(textSoFar: string): boolean {
  return SENTENCE_END.test(textSoFar) && !ABBREVIATION.test(textSoFar) && !INITIAL.test(textSoFar)
}

function startsSentence(ch: string | undefined): boolean {
  return ch !== undefined && !LOWERCASE.test(ch)
}

function opensSentence(node: Inline | undefined): boolean {
  switch (node?.kind) {
    case undefined:
    case 'break':
      return false
    case 'text':
    case 'emph':
    case 'strong':
    case 'strike':
      return startsSentence(plainText([node])[0])
    case 'code':
    case 'link':
    case 'autolink':
    case 'image':
      return true
  }
}

function breakAfterSentences(text: string, precedingText: string, nextNode: Inline | undefined): Inline[] {
  const out: Inline[] = []
  let start = 0
  for (const gap of text.matchAll(/\s+/g)) {
    const gapStart = gap.index ?? 0
    const gapEnd = gapStart + gap[0].length
    const nextOpens = gapEnd < text.length ? startsSentence(text[gapEnd]) : opensSentence(nextNode)
    if (!nextOpens || !endsSentence(precedingText + text.slice(0, gapStart))) continue
    if (gapStart > start) out.push({ kind: 'text', text: text.slice(start, gapStart) })
    out.push({ kind: 'break' })
    start = gapEnd
  }
  if (start < text.length) out.push({ kind: 'text', text: text.slice(start) })
  return out
}

function splitInlines(nodes: Inline[]): Inline[] {
  const out: Inline[] = []
  nodes.forEach((node, i) => {
    switch (node.kind) {
      case 'emph':
      case 'strong':
      case 'strike':
        out.push({ ...node, children: splitInlines(node.children) })
        break
      case 'text':
        out.push(...breakAfterSentences(node.text, plainText(out.slice(-1)), nodes[i + 1]))
        break
      default:
        out.push(node)
    }
  })
  return out
}

export function splitSentences(blocks: Block[]): Block[] {
  return blocks.map((block): Block => {
    switch (block.kind) {
      case 'paragraph':
        return { ...block, content: splitInlines(block.content) }
      case 'quote':
        return { ...block, blocks: splitSentences(block.blocks) }
      case 'list':
        return { ...block, items: block.items.map(item => ({ ...item, blocks: splitSentences(item.blocks) })) }
      default:
        return block
    }
  })
}
