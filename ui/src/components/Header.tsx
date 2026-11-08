import { Link } from '../router.js';

export function Header(props: { season?: number; current?: 'calendar' | 'shelf' | 'archive' | 'settings' | 'setup' | 'lab'; demo?: boolean }) {
  return (
    <header class="site-header">
      <Link href="/" class="brand" ariaLabel="Advent Agent, back to the calendar">
        <span class="brand-star" aria-hidden="true">✦</span>
        <span>Advent Agent</span>
      </Link>
      <div class="header-aside">
        <span>{props.demo ? 'Demo preview' : 'Your AI agent is your Secret Santa'}{props.season ? ` · ${props.season}` : ''}</span>
        <nav class="header-nav" aria-label="Pages">
          <Link href="/gifts" aria-current={props.current === 'shelf' ? 'page' : undefined}>Your gifts</Link>
          <Link href="/archive" aria-current={props.current === 'archive' ? 'page' : undefined}>Archive</Link>
          <Link href="/settings" aria-current={props.current === 'settings' ? 'page' : undefined}>Settings</Link>
        </nav>
      </div>
    </header>
  );
}
