// THE SECURITY BOUNDARY OF THE CHAT. Returns a node tree rendered by escaped Vue components; never
// turns untrusted agent text into an HTML string, because a renderer that returned HTML would need
// v-html and every character in these messages came out of a model that had just read a third-party
// website.
//
// NOTHING FAILS WHEN YOU CHANGE THIS. The screen renders correctly until a model echoes markup it
// read on a page it was looking at, and that markup then runs in the operator's browser.
//
// Italics are intentionally unsupported because * and _ commonly occur in globs and identifiers.
// Unknown syntax stays literal.
//
// Ported from upkeepo web/src/lib/markdown.ts. Keep the invariants; the syntax coverage is a choice
// each app may narrow or widen.

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'link'; text: string; href: string }
  | { kind: 'strong'; children: Inline[] }

export type Block =
  | { kind: 'paragraph'; inlines: Inline[] }
  | { kind: 'heading'; level: number; inlines: Inline[] }
  | { kind: 'code'; lang: string; text: string }
  | { kind: 'list'; ordered: boolean; start: number; items: Inline[][] }

/** One pass, one alternation, and THE ORDER OF THE BRANCHES IS THE PRECEDENCE. Code first, so a
 *  span of `**not bold**` stays literally that. The backreference on the opening run of backticks
 *  is what lets ``a ` b`` hold a backtick.
 *
 *  A link's href can only ever match `https?://...`, here in the pattern. That is not a filter
 *  applied afterwards that someone could forget to keep: `javascript:` is not expressible as a
 *  link at all, so the anchor this produces cannot be a script no matter what the text says. */
const INLINE_RE =
  /(?<ticks>`+)(?<code>[^]*?)\k<ticks>|\*\*(?<strong>[^]+?)\*\*|\[(?<linkText>[^\]\n]+)\]\((?<linkHref>https?:\/\/[^\s)]+)\)|(?<url>https?:\/\/[^\s<>"'`)\]]+)/g

/** CommonMark strips one space from each end of a code span, so `` ` `` can be written as
 *  `` ` ` ``. Only when both ends have one, and never when that is all there is. */
const trimCodeSpan = (text: string): string =>
  text.length > 2 && text.startsWith(' ') && text.endsWith(' ') && text.trim() !== ''
    ? text.slice(1, -1)
    : text

export const parseInline = (source: string, allowStrong = true): Inline[] => {
  const out: Inline[] = []
  let last = 0

  const text = (value: string): void => {
    if (value) out.push({ kind: 'text', text: value })
  }

  for (const match of source.matchAll(INLINE_RE)) {
    const groups = match.groups ?? {}
    // Nested bold is not a thing, and recursing on it would be a way to loop. Left alone, the
    // asterisks simply stay in the text where the reader can see them.
    if (groups.strong !== undefined && !allowStrong) continue

    const start = match.index
    text(source.slice(last, start))

    if (groups.code !== undefined) out.push({ kind: 'code', text: trimCodeSpan(groups.code) })
    else if (groups.strong !== undefined) out.push({ kind: 'strong', children: parseInline(groups.strong, false) })
    else if (groups.linkHref !== undefined) {
      out.push({ kind: 'link', text: groups.linkText ?? groups.linkHref, href: groups.linkHref })
    } else if (groups.url !== undefined) out.push({ kind: 'link', text: groups.url, href: groups.url })

    last = start + match[0].length
  }

  text(source.slice(last))
  return out
}

const FENCE = /^ {0,3}```+\s*(\S*)\s*$/
const FENCE_END = /^ {0,3}```+\s*$/
const HEADING = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/
// The space after the marker is what keeps `---` from being a bullet and `**bold**` at the start
// of a line from being one either.
const BULLET = /^([ \t]*)[-*+][ \t]+(?<content>.*)$/
// `num` is kept because a list does not always start at 1: the numbering the agent wrote is the
// numbering the operator reads, and a list resumed after a blank line has to carry on from it.
const ORDERED = /^([ \t]*)(?<num>\d{1,9})[.)][ \t]+(?<content>.*)$/

const startsBlock = (line: string): boolean =>
  FENCE.test(line) || HEADING.test(line) || BULLET.test(line) || ORDERED.test(line)

export const parseMarkdown = (source: string): Block[] => {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i] ?? ''

    if (!line.trim()) {
      i += 1
      continue
    }

    const fence = FENCE.exec(line)
    if (fence) {
      const body: string[] = []
      i += 1
      // An unterminated fence keeps everything to the end rather than giving up on the block. A
      // message can be cut short by a budget, and half a diff is still worth reading as a diff.
      while (i < lines.length && !FENCE_END.test(lines[i] ?? '')) {
        body.push(lines[i] ?? '')
        i += 1
      }
      i += 1
      blocks.push({ kind: 'code', lang: fence[1] ?? '', text: body.join('\n') })
      continue
    }

    const heading = HEADING.exec(line)
    if (heading) {
      blocks.push({
        kind: 'heading',
        level: (heading[1] ?? '#').length,
        inlines: parseInline(heading[2] ?? ''),
      })
      i += 1
      continue
    }

    const ordered = ORDERED.test(line)
    if (ordered || BULLET.test(line)) {
      const items: string[] = []
      const pattern = ordered ? ORDERED : BULLET
      let start = 1
      while (i < lines.length) {
        const current = lines[i] ?? ''
        const item = pattern.exec(current)
        if (item) {
          if (items.length === 0 && ordered) start = Number(item.groups?.num ?? '1')
          items.push(item.groups?.content ?? '')
          i += 1
          continue
        }
        // A blank line between two items is one loose list, not two lists. Splitting there is what
        // put a second `1.` on screen under the first one: each half became its own `<ol>`, and an
        // `<ol>` counts from its own first item. Only a blank line with no further item after it
        // ends the list.
        if (!current.trim()) {
          let ahead = i + 1
          while (ahead < lines.length && !(lines[ahead] ?? '').trim()) ahead += 1
          if (ahead < lines.length && pattern.test(lines[ahead] ?? '')) {
            i = ahead
            continue
          }
          break
        }
        // An indented continuation belongs to the item above it. Anything at the left margin ends
        // the list.
        if (/^[ \t]/.test(current) && items.length > 0) {
          items[items.length - 1] = `${items[items.length - 1]}\n${current.trim()}`
          i += 1
          continue
        }
        break
      }
      blocks.push({ kind: 'list', ordered, start, items: items.map((item) => parseInline(item)) })
      continue
    }

    const paragraph: string[] = []
    while (i < lines.length) {
      const current = lines[i] ?? ''
      if (!current.trim() || startsBlock(current)) break
      paragraph.push(current)
      i += 1
    }
    // The newlines inside a paragraph are kept, not folded into spaces. The agent's paragraphs
    // arrive as one long line each, so a newline it did write is one it meant; `white-space:
    // pre-line` on the rendered element is the other half of this decision.
    blocks.push({ kind: 'paragraph', inlines: parseInline(paragraph.join('\n')) })
  }

  return blocks
}
