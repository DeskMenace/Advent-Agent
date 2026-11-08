/**
 * Allow-list markdown → Preact nodes. Agent text never becomes raw HTML in the app origin (ARCHITECTURE §8).
 * Supports: paragraphs, line breaks, # headings, - / 1. lists, > quotes, **bold**, *italic*, `code`, ``` blocks,
 * [text](https://…) links (https only, opened in a new tab), horizontal rules.
 */
import type { ComponentChildren, VNode } from 'preact';

type Block =
  | { type: 'p'; text: string }
  | { type: 'h'; level: number; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'quote'; text: string }
  | { type: 'code'; text: string; lang?: string }
  | { type: 'hr' };

export function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (line.trim() === '') { i++; continue; }
    if (/^```/.test(line)) {
      const lang = line.slice(3).trim() || undefined;
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i]!)) buf.push(lines[i++]!);
      i++;
      blocks.push({ type: 'code', text: buf.join('\n'), lang });
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { blocks.push({ type: 'h', level: h[1]!.length, text: h[2]! }); i++; continue; }
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { blocks.push({ type: 'hr' }); i++; continue; }
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i]!)) items.push(lines[i++]!.replace(/^\s*[-*+]\s+/, ''));
      blocks.push({ type: 'ul', items });
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i]!)) items.push(lines[i++]!.replace(/^\s*\d+[.)]\s+/, ''));
      blocks.push({ type: 'ol', items });
      continue;
    }
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i]!)) buf.push(lines[i++]!.replace(/^>\s?/, ''));
      blocks.push({ type: 'quote', text: buf.join('\n') });
      continue;
    }
    const buf: string[] = [];
    while (i < lines.length && lines[i]!.trim() !== '' && !/^(#{1,6}\s|```|\s*[-*+]\s|\s*\d+[.)]\s|>)/.test(lines[i]!)) buf.push(lines[i++]!);
    blocks.push({ type: 'p', text: buf.join('\n') });
  }
  return blocks;
}

const INLINE_RE = /(\*\*[^*]+\*\*|\*[^*\n]+\*|_[^_\n]+_|`[^`\n]+`|\[[^\]\n]+\]\(https:\/\/[^)\s]+\))/g;

export function renderInline(text: string): ComponentChildren {
  const out: ComponentChildren[] = [];
  const paragraphs = text.split('\n');
  paragraphs.forEach((line, li) => {
    let last = 0;
    for (const m of line.matchAll(INLINE_RE)) {
      const idx = m.index ?? 0;
      if (idx > last) out.push(line.slice(last, idx));
      const tok = m[0];
      if (tok.startsWith('**')) out.push(<strong>{tok.slice(2, -2)}</strong>);
      else if (tok.startsWith('`')) out.push(<code>{tok.slice(1, -1)}</code>);
      else if (tok.startsWith('[')) {
        const mm = tok.match(/^\[([^\]]+)\]\((https:\/\/[^)\s]+)\)$/);
        if (mm) out.push(<a href={mm[2]} target="_blank" rel="noopener noreferrer">{mm[1]}</a>);
        else out.push(tok);
      } else out.push(<em>{tok.slice(1, -1)}</em>);
      last = idx + tok.length;
    }
    if (last < line.length) out.push(line.slice(last));
    if (li < paragraphs.length - 1) out.push(<br />);
  });
  return out;
}

export function Markdown(props: { text: string; class?: string }): VNode {
  const blocks = parseBlocks(props.text);
  return (
    <div class={props.class ?? 'md'}>
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'h': {
            const level = Math.min(6, Math.max(1, b.level)) as 1 | 2 | 3 | 4 | 5 | 6;
            const Tag = `h${Math.min(level + 1, 6)}` as keyof preact.JSX.IntrinsicElements;
            return <Tag key={i} class={`md-h md-h${level}`}>{renderInline(b.text)}</Tag>;
          }
          case 'ul': return <ul key={i}>{b.items.map((it, j) => <li key={j}>{renderInline(it)}</li>)}</ul>;
          case 'ol': return <ol key={i}>{b.items.map((it, j) => <li key={j}>{renderInline(it)}</li>)}</ol>;
          case 'quote': return <blockquote key={i}>{renderInline(b.text)}</blockquote>;
          case 'code': return <pre key={i} class="md-code"><code>{b.text}</code></pre>;
          case 'hr': return <hr key={i} />;
          default: return <p key={i}>{renderInline(b.text)}</p>;
        }
      })}
    </div>
  );
}

/** Plain text with the inline allow-list only (titles, subtitles). */
export function Inline(props: { text: string }): VNode {
  return <>{renderInline(props.text)}</>;
}
