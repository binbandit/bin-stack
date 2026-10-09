import type { ClientModule, RenderElement } from 'claude-code'

type WeavewormProps = { columns: number }
type WeavewormState = { frame: number }
type Cell = { glyph: string; color?: string; backgroundColor?: string }
type Rgb = readonly [number, number, number]

const SEKIGUCHI_MINT = '#7BCCAB'
const SEKIGUCHI_MINT_SHADE = '#4F9C80'
const NONA_RED = '#FF3B30'
const FRESH_SILK: Rgb = [244, 241, 232]
const COOLED_SILK: Rgb = [74, 122, 106]
const SPENT_SILK = '#33524A'

const FRAME_MS = 80
const WORM_CELLS = 8
const ARCH_CELLS = 2
const ARCH_POSITIONS = WORM_CELLS - ARCH_CELLS - 1
const GLOW_CELLS = 10
const CORNER_CELLS = 4
const MIN_TAPE_CELLS = 14
const MAX_TAPE_CELLS = 24
const WEAVES = '╳┼╪'

const hexOf = (rgb: Rgb) => `#${rgb.map(channel => Math.round(channel).toString(16).padStart(2, '0')).join('')}`

const lerp = (from: number, to: number, mix: number) => from + (to - from) * mix

const blend = ([r1, g1, b1]: Rgb, [r2, g2, b2]: Rgb, mix: number): Rgb => [
  lerp(r1, r2, mix),
  lerp(g1, g2, mix),
  lerp(b1, b2, mix),
]

const cooled = (cellsBehind: number) => hexOf(blend(FRESH_SILK, COOLED_SILK, Math.min(1, cellsBehind / GLOW_CELLS) ** 0.7))

function wormCell(segment: number, arch: number): Cell {
  if (segment === WORM_CELLS - 1) return { glyph: '▀', color: NONA_RED, backgroundColor: SEKIGUCHI_MINT }
  const color = Math.floor((WORM_CELLS - 2 - segment) / 2) % 2 === 0 ? SEKIGUCHI_MINT : SEKIGUCHI_MINT_SHADE
  if (segment === 0) return { glyph: '▗', color }
  return { glyph: segment >= arch && segment < arch + ARCH_CELLS ? '▀' : '▄', color }
}

const Weaveworm: ClientModule<WeavewormProps, WeavewormState> = (props, surface) => {
  if (surface.state === undefined) {
    let frame = 0
    surface.every(FRAME_MS, () => surface.setState({ frame: ++frame }))
    surface.setState({ frame })
  }
  const { Text } = surface.elements
  const frame = surface.state?.frame ?? 0
  const tapeCells = Math.max(MIN_TAPE_CELLS, Math.min(MAX_TAPE_CELLS, props.columns - CORNER_CELLS))
  const step = Math.floor(frame / ARCH_POSITIONS)
  const travel = tapeCells + WORM_CELLS
  const pass = Math.floor(step / travel)
  const tail = (step % travel) - WORM_CELLS + 1
  const arch = 1 + (frame % ARCH_POSITIONS)

  const cellAt = (x: number): Cell => {
    if (x >= tail + WORM_CELLS) return { glyph: WEAVES.charAt(pass % WEAVES.length), color: SPENT_SILK }
    if (x >= tail) return wormCell(x - tail, arch)
    return { glyph: WEAVES.charAt((pass + 1) % WEAVES.length), color: cooled(tail - x - 1) }
  }

  const cells: RenderElement[] = Array.from({ length: tapeCells }, (_, x) => {
    const { glyph, ...style } = cellAt(x)
    return Text({ ...style, children: [glyph] })
  })

  return Text({
    wrap: 'truncate-end',
    children: [
      Text({ color: SEKIGUCHI_MINT, children: ['◤ '] }),
      ...cells,
      Text({ color: SEKIGUCHI_MINT, children: [' ◢'] }),
    ],
  })
}

export default Weaveworm
