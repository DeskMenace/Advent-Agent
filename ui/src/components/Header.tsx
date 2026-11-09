import { Link } from '../router.js';
import { REPO_URL } from '../lib/site.js';
import { GitHub, Star } from './Icons.js';

export function Header(props: { current?: 'calendar' | 'shelf' | 'settings' | 'setup' | 'lab' }) {
  return (
    <header class="site-header">
      <Link href="/" class="brand" ariaLabel="Advent Agent, back to the calendar">
        <Star class="brand-star" />
        <span>Advent Agent</span>
      </Link>
      <nav class="header-nav" aria-label="Pages">
        <Link href="/gifts" aria-current={props.current === 'shelf' ? 'page' : undefined}>Your Gifts</Link>
        <Link href="/settings" aria-current={props.current === 'settings' ? 'page' : undefined}>Settings</Link>
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer class="site-footer">
      <a class="gh-mark" href={REPO_URL} target="_blank" rel="noopener noreferrer" aria-label="Advent Agent on GitHub"><GitHub /></a>
    </footer>
  );
}
