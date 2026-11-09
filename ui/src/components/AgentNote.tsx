/**
 * The agent's note, shown as a tiny terminal so it is obvious the agent wrote it (D26). Text comes only from
 * gift.json `note`; the signature line appears only when the agent signed. Typed out once; instant with reduced motion.
 */
import { useEffect, useState } from 'preact/hooks';
import { prefersReducedMotion } from '../lib/ui.js';

export function AgentNote(props: { note?: string; signature?: string }) {
  const note = props.note?.trim() ?? '';
  const full = note.length > 0;
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? note.length : 0));
  useEffect(() => {
    if (!full || shown >= note.length) return;
    const step = Math.max(1, Math.round(note.length / 120));
    const t = window.setTimeout(() => setShown((n) => Math.min(note.length, n + step)), 18);
    return () => window.clearTimeout(t);
  }, [shown, note]);
  if (!full) return null;
  const done = shown >= note.length;
  return (
    <figure class="agent-note" aria-label="A note from your agent">
      <div class="term-bar" aria-hidden="true"><span /><span /><span /></div>
      <div class="term-body">
        <div class="term-prompt" aria-hidden="true">$ cat note.txt</div>
        <p class="sr-only">{note}</p>
        <p class="term-text" aria-hidden="true">{note.slice(0, shown)}{!done && <span class="term-caret">▍</span>}</p>
        {done && props.signature && <p class="term-sign">— {props.signature}</p>}
      </div>
    </figure>
  );
}
