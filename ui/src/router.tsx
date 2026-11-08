/** Tiny history router. Routes: / /setup /settings /door/:day /gift/:season/:day /gifts /archive /archive/:season /lab/review */
import { useEffect, useState } from 'preact/hooks';

export interface Route {
  name: 'calendar' | 'setup' | 'settings' | 'door' | 'gift' | 'shelf' | 'archive' | 'archiveSeason' | 'lab' | 'notFound';
  params: Record<string, string>;
  path: string;
  search: URLSearchParams;
}

export function parseRoute(path = location.pathname, search = location.search): Route {
  const sp = new URLSearchParams(search);
  const segs = path.replace(/\/+$/, '').split('/').filter(Boolean);
  const mk = (name: Route['name'], params: Record<string, string> = {}): Route => ({ name, params, path, search: sp });
  if (segs.length === 0 || segs[0] === 'calendar') return mk('calendar');
  if (segs[0] === 'setup') return mk('setup');
  if (segs[0] === 'settings') return mk('settings');
  if (segs[0] === 'door' && segs[1]) return mk('door', { day: segs[1] });
  if (segs[0] === 'gift' && segs[1] && segs[2]) return mk('gift', { season: segs[1], day: segs[2] });
  if (segs[0] === 'gifts') return mk('shelf');
  if (segs[0] === 'archive' && segs[1]) return mk('archiveSeason', { season: segs[1] });
  if (segs[0] === 'archive') return mk('archive');
  if (segs[0] === 'lab' && segs[1] === 'review') return mk('lab');
  return mk('notFound');
}

const listeners = new Set<() => void>();

export function navigate(to: string, opts: { replace?: boolean } = {}): void {
  if (opts.replace) history.replaceState(null, '', to);
  else history.pushState(null, '', to);
  for (const l of listeners) l();
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute());
  useEffect(() => {
    const update = () => setRoute(parseRoute());
    listeners.add(update);
    window.addEventListener('popstate', update);
    return () => { listeners.delete(update); window.removeEventListener('popstate', update); };
  }, []);
  return route;
}

/** Link that uses the router (and still works with modifier keys). */
export function Link(props: { href: string; class?: string; className?: string; children: preact.ComponentChildren; ariaLabel?: string; title?: string; onClick?: () => void }) {
  return (
    <a
      href={props.href}
      class={props.class ?? props.className}
      aria-label={props.ariaLabel}
      title={props.title}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        props.onClick?.();
        navigate(props.href);
      }}
    >
      {props.children}
    </a>
  );
}
