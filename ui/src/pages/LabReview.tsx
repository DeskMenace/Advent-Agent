/** Gift lab review sheet (TEST_PLAN §6). Saves to docs/lab-reviews/<date>.md in the repo working tree. */
import { useEffect, useState } from 'preact/hooks';
import { api } from '../api.js';
import { Header } from '../components/Header.js';
import { toast } from '../lib/ui.js';
import { Link } from '../router.js';

type Sheet = Awaited<ReturnType<typeof api.labSheet>>;

export function LabReviewPage() {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  useEffect(() => { api.labSheet().then(setSheet).catch((e) => toast((e as Error).message)); }, []);
  if (!sheet) return <div class="shell"><Header current="lab" /><p class="empty">Opening the lab notebook…</p></div>;
  return (
    <div class="shell">
      <Header current="lab" />
      <main style="padding-top:40px;max-width:900px;margin:0 auto">
        <div class="eyebrow">Gift lab</div>
        <h1 class="page-title">Review sheet.</h1>
        <p class="page-sub">Each lab gift, with the review form. Reviews are appended to <code class="inline">{sheet.reviewsFile}</code>. Approving an idea sets <code class="inline">status: approved</code> in its library file.</p>
        {sheet.items.length === 0 && <p class="empty">No lab doors yet. Run <code class="inline">advent-agent lab --idea &lt;id&gt;</code>.</p>}
        {sheet.items.map((it) => <ReviewForm key={it.day} item={it} season={sheet.season!} />)}
      </main>
    </div>
  );
}

function ReviewForm(props: { item: Sheet['items'][number]; season: number }) {
  const { item } = props;
  const [form, setForm] = useState({ works: 'yes', delight: 3, feltPersonal: 'n/a', noteQuality: 3, problems: '', approveIdea: false });
  const [saved, setSaved] = useState<string | null>(null);
  const set = (p: Partial<typeof form>) => setForm({ ...form, ...p });
  return (
    <div class="paper" style="margin:16px 0">
      <div class="eyebrow">Door {item.day} · {item.idea ?? 'wildcard'} · {item.agent ?? 'agent?'}</div>
      <h2 class="section" style="margin:10px 0">{item.title ?? (item.revealed ? '' : `Not opened yet (${item.state})`)}</h2>
      {!item.revealed && <p class="page-sub">Open this door in the <Link href="/">lab calendar</Link> first so the envelope ritual is tested too.</p>}
      <div class="card-grid">
        <div class="field"><label>Works</label><select value={form.works} onChange={(e) => set({ works: (e.target as HTMLSelectElement).value })}><option>yes</option><option>no</option><option>partly</option></select></div>
        <div class="field"><label>Delight (1–5)</label><input type="number" min={1} max={5} value={form.delight} onChange={(e) => set({ delight: Number((e.target as HTMLInputElement).value) })} /></div>
        <div class="field"><label>Felt personal</label><select value={form.feltPersonal} onChange={(e) => set({ feltPersonal: (e.target as HTMLSelectElement).value })}><option>yes</option><option>no</option><option>n/a</option></select></div>
        <div class="field"><label>Note quality (1–5)</label><input type="number" min={1} max={5} value={form.noteQuality} onChange={(e) => set({ noteQuality: Number((e.target as HTMLInputElement).value) })} /></div>
      </div>
      <div class="field"><label>Problems</label><textarea value={form.problems} onInput={(e) => set({ problems: (e.target as HTMLTextAreaElement).value })} /></div>
      {item.idea && <label class="check"><input type="checkbox" checked={form.approveIdea} onChange={(e) => set({ approveIdea: (e.target as HTMLInputElement).checked })} /><span class="check-text">Approve this idea<small>Sets status: approved in gift-library/ideas/{item.idea}.md</small></span></label>}
      <div class="button-row">
        <button class="primary-button" onClick={async () => { try { const r = await api.labSave({ day: item.day, idea: item.idea, agent: item.agent, ...form }); setSaved(r.saved + (r.approved ? ` · approved ${r.approved}` : '')); toast('Review saved.'); } catch (e) { toast((e as Error).message); } }}>Save review</button>
        {saved && <span style="font-size:12px;color:var(--muted-strong)">{saved}</span>}
      </div>
    </div>
  );
}
