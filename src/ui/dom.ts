/** Tiny DOM helpers. Screens build real elements; text is always set as text, never as HTML. */

type Child = Node | string | number | null | undefined | false
type Props = {
  class?: string
  [key: string]: unknown
}

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props?: Props | null, ...children: (Child | Child[])[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value === undefined || value === null || value === false) continue
      if (key === 'class') el.className = String(value)
      else if (key === 'dataset') Object.assign(el.dataset, value)
      else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value)
      else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value as EventListener)
      else if (key in el && key !== 'list' && key !== 'form' && typeof value !== 'string') (el as unknown as Record<string, unknown>)[key] = value
      else el.setAttribute(key, value === true ? '' : String(value))
    }
  }
  append(el, children)
  return el
}

export function append(parent: Node, children: (Child | Child[])[]): void {
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue
    parent.appendChild(typeof child === 'object' ? child : document.createTextNode(String(child)))
  }
}

export function replace(parent: Element, ...children: (Child | Child[])[]): void {
  parent.replaceChildren()
  append(parent, children)
}

/** German text inside the Persian interface: isolated, left-to-right, with the right font and language. */
export function de(text: string, className = ''): HTMLElement {
  return h('bdi', { class: `de ${className}`.trim(), lang: 'de', dir: 'ltr' }, text)
}

const SVG_NS = 'http://www.w3.org/2000/svg'

/** Builds an SVG element from trusted, hard-coded markup (icons and the mascot only). */
export function svg(markup: string, attrs: Record<string, string> = {}): SVGSVGElement {
  const el = document.createElementNS(SVG_NS, 'svg')
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  el.innerHTML = markup
  return el
}

const ICONS = {
  home: '<path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  book: '<path d="M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h10"/>',
  cards: '<rect x="4" y="7" width="13" height="13" rx="2.5"/><path d="M8 4h9a3 3 0 0 1 3 3v9"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.3l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2.3-1.3L14 3h-4l-.3 2.4a7 7 0 0 0-2.3 1.3l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .9.1 1.3l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2.3 1.3L10 21h4l.3-2.4a7 7 0 0 0 2.3-1.3l2.3.9 2-3.4-2-1.5c.1-.4.1-.9.1-1.3z"/>',
  speaker: '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  star: '<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"/>',
  back: '<path d="M9 5l7 7-7 7"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  trash: '<path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v5h-5"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  flame: '<path d="M12 3c1 3.5 5 5.500 5 10a5 5 0 0 1-10 0c0-2 1-3.500 2-4.500.300 1.500 1 2.500 2 3 .500-3-.500-5.500 1-8.500z"/>',
  offline: '<path d="M3 3l18 18M8.500 16.500a5 5 0 0 1 7 0M5 13a10 10 0 0 1 3.500-2.300M19 13a10 10 0 0 0-5-2.800M2 9.500A15 15 0 0 1 6.500 6.800M22 9.500a15 15 0 0 0-9-3.500"/><circle cx="12" cy="20" r="1"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  sparkle: '<path d="M12 3l1.800 5.200L19 10l-5.200 1.800L12 17l-1.800-5.200L5 10l5.200-1.800z"/><path d="M19 15l.700 2.300L22 18l-2.300.700L19 21l-.700-2.300L16 18l2.300-.700z"/>',
  download: '<path d="M12 4v11M7.500 11l4.500 4.500 4.500-4.500M5 20h14"/>',
  clock: '<circle cx="12" cy="12" r="8.500"/><path d="M12 7.500V12l3 2"/>',
  info: '<circle cx="12" cy="12" r="8.500"/><path d="M12 11v5.500M12 7.700v.100"/>',
} as const

export type IconName = keyof typeof ICONS

export function icon(name: IconName, options: { filled?: boolean; size?: number } = {}): SVGSVGElement {
  const size = String(options.size ?? 22)
  return svg(ICONS[name], {
    viewBox: '0 0 24 24',
    width: size,
    height: size,
    fill: options.filled ? 'currentColor' : 'none',
    stroke: 'currentColor',
    'stroke-width': '1.8',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
    class: 'icon',
  })
}
