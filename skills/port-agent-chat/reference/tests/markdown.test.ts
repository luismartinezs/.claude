import { describe, expect, it } from 'vitest';
import { parseInline, parseMarkdown, type Inline } from '../app/lib/markdown.ts';

// THE SECURITY TESTS OF THE CHAT. Every string below is something a model could echo after reading a
// third-party page. The renderer must turn each into data, never into markup.
//
// These pass against a parser that returns a TREE. They cannot be made to pass by escaping harder in
// a string-returning renderer, which is the point: the type of the return value is the invariant.

const flatten = (nodes: Inline[]): Inline[] =>
  nodes.flatMap(node => node.kind === 'strong' ? flatten(node.children) : [node]);

const links = (source: string): Array<{ text: string; href: string }> =>
  flatten(parseInline(source)).flatMap(node => node.kind === 'link' ? [{ text: node.text, href: node.href }] : []);

const allText = (source: string): string =>
  flatten(parseInline(source)).map(node => 'text' in node ? node.text : '').join('');

describe('the parser never produces markup', () => {
  it.each([
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '<iframe src="https://evil.example"></iframe>',
    '<svg><script>alert(1)</script></svg>',
    '<style>body{display:none}</style>',
    '<a href="javascript:alert(1)">click</a>',
    '<div onclick="alert(1)">x</div>',
  ])('keeps %s as literal text', source => {
    const nodes = parseInline(source);
    // No node type in the tree can become an element: text, code, link and strong are the whole
    // vocabulary, and a Vue component renders each of them with interpolation.
    for (const node of flatten(nodes)) {
      expect(['text', 'code', 'link']).toContain(node.kind);
    }
    // The dangerous characters survive as characters, which is what makes them visible rather than
    // executable.
    expect(allText(source)).toContain('<');
  });
});

describe('links', () => {
  it('cannot express a javascript: URL at all', () => {
    // Pins the invariant. This is not a filter applied after parsing that someone could forget to
    // keep: the pattern only matches https?://, so the scheme is unreachable by construction.
    for (const source of [
      '[click](javascript:alert(1))',
      '[click](JaVaScRiPt:alert(1))',
      '[click](data:text/html,<script>alert(1)</script>)',
      '[click](vbscript:msgbox)',
      '[click](file:///etc/passwd)',
    ]) {
      expect(links(source)).toEqual([]);
    }
  });

  it('accepts http and https', () => {
    expect(links('[docs](https://example.com/a?b=c)')).toEqual([{ text: 'docs', href: 'https://example.com/a?b=c' }]);
    expect(links('see http://example.com now')).toEqual([{ text: 'http://example.com', href: 'http://example.com' }]);
  });

  it('never lets link text smuggle markup', () => {
    const parsed = links('[<img src=x onerror=alert(1)>](https://example.com)');
    expect(parsed).toHaveLength(1);
    // The text is text. It is rendered by interpolation, so it appears on screen as written.
    expect(parsed[0]!.text).toBe('<img src=x onerror=alert(1)>');
  });
});

describe('code spans and fences', () => {
  it('wins over emphasis, so `**not bold**` stays literal', () => {
    const nodes = parseInline('`**not bold**`');
    expect(nodes).toEqual([{ kind: 'code', text: '**not bold**' }]);
  });

  it('keeps an unterminated fence rather than giving up on the block', () => {
    // A message can be cut short by a budget, and half a diff is still worth reading as a diff.
    const blocks = parseMarkdown('```ts\nconst a = 1\nconst b = 2');
    expect(blocks).toEqual([{ kind: 'code', lang: 'ts', text: 'const a = 1\nconst b = 2' }]);
  });

  it('holds a backtick inside a code span', () => {
    expect(parseInline('``a ` b``')).toEqual([{ kind: 'code', text: 'a ` b' }]);
  });
});

describe('lists', () => {
  it('reads a loose list as one list', () => {
    // Splitting on the blank line put a second "1." on screen under the first, because each half
    // became its own <ol> counting from its own first item.
    const blocks = parseMarkdown('1. one\n\n2. two');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ kind: 'list', ordered: true, start: 1 });
    if (blocks[0]!.kind === 'list') expect(blocks[0]!.items).toHaveLength(2);
  });

  it('keeps the numbering the agent wrote', () => {
    const blocks = parseMarkdown('3. three\n4. four');
    expect(blocks[0]).toMatchObject({ kind: 'list', start: 3 });
  });

  it('does not read a rule or bold text as a bullet', () => {
    expect(parseMarkdown('---')[0]!.kind).toBe('paragraph');
    expect(parseMarkdown('**bold** at the start')[0]!.kind).toBe('paragraph');
  });
});

describe('paragraphs', () => {
  it('keeps the newlines the agent wrote', () => {
    // The agent's paragraphs arrive as one long line each, so a newline it did write is one it meant.
    // `white-space: pre-line` on the rendered element is the other half of this decision.
    const blocks = parseMarkdown('first line\nsecond line');
    expect(blocks).toHaveLength(1);
    expect(allText('first line\nsecond line')).toContain('\n');
  });
});
