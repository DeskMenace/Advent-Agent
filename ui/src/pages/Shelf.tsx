/** Your Gifts (handoff §1.5): opened gifts only, ordered by day. Empty state: an empty wooden shelf. */
import { useEffect, useState } from 'preact/hooks';
import type { ShelfItem } from '../../../src/shared/api.js';
import { api } from '../api.js';
import { Footer, Header } from '../components/Header.js';
import { Star } from '../components/Icons.js';
import { Link } from '../router.js';

export function ShelfPage() {
  const [items, setItems] = useState<ShelfItem[] | null>(null);
  useEffect(() => { api.shelf().then((s) => setItems(s.items)).catch(() => setItems([])); }, []);
  return (
    <div class="shell">
      <Header current="shelf" />
      <main>
        <div class="shelf-head">
          <p class="home-eyebrow" style="justify-content:flex-start">Your Gifts</p>
          <h1>Every surprise, kept.</h1>
        </div>
        {items === null ? null : items.length === 0 ? (
          <div class="empty-shelf" role="img" aria-label="An empty shelf"><span class="plank" /><span class="bracket l" /><span class="bracket r" /></div>
        ) : (
          <ul class="gifts-grid">
            {[...items].sort((a, b) => a.day - b.day).map((it) => (
              <li key={it.day}>
                <Link href={`/gifts/${it.day}`} class="gift-card">
                  <div class="thumb" aria-hidden="true">{it.thumbnailUrl ? <img crossOrigin="anonymous" src={it.thumbnailUrl} alt="" loading="lazy" /> : <Star />}</div>
                  <div class="meta"><span class="day">December {it.day}</span><span class="title">{it.title}</span></div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
      <Footer />
    </div>
  );
}
