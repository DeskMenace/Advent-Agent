/**
 * The day brief (AGENT_CONNECTIONS §4): the same JSON for every mode, plus a Markdown rendering for launched agents.
 * It never contains unrevealed future gifts, the voucher, Gary, or anything about purchasing on the user's behalf.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AgentContext, GateProblem } from '../shared/api.js';
import type { Config, Profile, Season } from '../shared/config.js';
import { GIFT_KINDS } from '../shared/gift.js';
import type { ConnectionMode } from '../shared/door.js';
import type { HistoryRecord } from '../shared/config.js';
import { WORKSHOP_DIR, LIBRARY_DIR } from './package-paths.js';
import { zonedDateString } from './time.js';
import { anchorFor, tierFor, type Generosity } from './tiers.js';

/** One earlier door, as the agent sees it (D15 rotation). `opened` is false for gifts made but not yet opened. */
export type BriefHistory = HistoryRecord & { opened?: boolean };

function anchorIdeas(anchor: 'day1' | 'finale'): Array<{ id: string; title: string; tier: string; capability: string }> {
  const file = join(LIBRARY_DIR, 'INDEX.json');
  if (!existsSync(file)) return [];
  try {
    const index = JSON.parse(readFileSync(file, 'utf8')) as { ideas: Array<{ id: string; title: string; tier: string; capability: string; anchor: string }> };
    return index.ideas.filter((i) => i.anchor === anchor).map(({ id, title, tier, capability }) => ({ id, title, tier, capability }));
  } catch {
    return [];
  }
}

export interface BriefInput {
  season: Season;
  day: number;
  now: Date;
  config: Config;
  profile: Profile;
  history: BriefHistory[];
  mode: ConnectionMode;
  /** D18: the door is made after its own day. */
  isCatchUp?: boolean;
  /** Number of doors being made in the same catch-up pile. */
  pile?: number;
  adapter?: string;
  workspace?: string;
  attempt: number;
  previousProblems?: GateProblem[];
  /** Whether the launched CLI enforces a budget (Claude Code: --max-budget-usd). */
  tokenEnforced?: boolean;
}

export function skillIndex(): Array<{ name: string; description: string }> {
  const dir = join(WORKSHOP_DIR, 'skills');
  if (!existsSync(dir)) return [];
  const out: Array<{ name: string; description: string }> = [];
  for (const name of readdirSync(dir).sort()) {
    const file = join(dir, name, 'SKILL.md');
    if (!existsSync(file)) continue;
    const fm = readFileSync(file, 'utf8').match(/^---\n([\s\S]*?)\n---/);
    const desc = fm?.[1]?.match(/^description:\s*(.*)$/m)?.[1]?.trim() ?? '';
    out.push({ name, description: desc.replace(/^["']|["']$/g, '') });
  }
  // gift-director always first
  out.sort((a, b) => (a.name === 'gift-director' ? -1 : b.name === 'gift-director' ? 1 : a.name.localeCompare(b.name)));
  return out;
}

export function libraryCount(): number {
  const file = join(LIBRARY_DIR, 'INDEX.json');
  if (!existsSync(file)) return 0;
  try {
    return (JSON.parse(readFileSync(file, 'utf8')) as { ideas: unknown[] }).ideas.length;
  } catch {
    return 0;
  }
}

/** Profile fields the user allows, non-empty only. */
export function sharedProfile(profile: Profile): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {};
  for (const field of profile.share) {
    const v = profile[field];
    if (Array.isArray(v) ? v.length > 0 : typeof v === 'string' && v.trim().length > 0) out[field] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

export function buildAgentContext(input: BriefInput): AgentContext {
  const { season, day, now, config, profile, history, mode } = input;
  const ceiling = config.budgets.priceCeilingPerGift;
  const anchor = anchorFor(day);
  const tier = tierFor(day, config.budgets.generosity as Generosity, mode);
  const earlier = history.filter((h) => h.day < day || (anchor === 'finale' && h.day !== day));
  const sets = new Map<string, { set: string; size: number; days: number[] }>();
  for (const h of earlier) {
    if (!h.collection) continue;
    const c = sets.get(h.collection.set) ?? { set: h.collection.set, size: h.collection.size, days: [] };
    c.days.push(h.day);
    sets.set(h.collection.set, c);
  }
  const modeNotes: string[] = [];
  if (anchor === 'day1') modeNotes.push('This is Day 1, prepared while the recipient sets up the calendar. Choose only among the anchorIdeas (anchor: day1). It must show within 30 seconds that you know them, and it carries a short signed note introducing you as their Secret Santa for the season.');
  if (anchor === 'finale') modeNotes.push('This is December 24, the finale. Choose an anchor: finale idea or invent something of that size, and call back to the season (the history below: gifts, collections, reactions).');
  if (input.isCatchUp) modeNotes.push(`This door is being caught up${input.pile && input.pile > 1 ? ` with ${input.pile - 1} other door(s)` : ''}. Don't mention the delay. Make it a little lighter and different from its neighbours.`);
  if (mode === 'launched') {
    modeNotes.push('Nobody will see your output except the final gift. Your log stays private. Work in the current folder (your private workspace).');
    modeNotes.push('Write the finished gift into ./gift (gift.json + files). Report progress with `advent-agent progress <thinking|making|testing|wrapping>` if you can run commands; otherwise write the phase name into ./.progress.');
    modeNotes.push('When you are done, run `advent-agent submit ./gift --day ' + day + '`. If you cannot run commands, just finish: the calendar submits ./gift when you exit.');
  } else if (mode === 'connected') {
    modeNotes.push('The recipient may glimpse your tool calls in the chat. Do not describe, summarise or quote the gift in chat while you work. When finished say only: "Your gift is wrapped. Open door ' + day + ' in your calendar."');
    modeNotes.push('Use start_gift to get a workspace folder if you can write files, or submit_gift with inline files if you cannot.');
  } else if (mode === 'portable') {
    modeNotes.push('You have no access to this computer. Produce a single self-contained HTML file (inline all CSS/JS/images as data URIs, no network), or a text/markdown letter, or a real-world proposal written as text. Do not show a preview; hand the file or text over directly.');
  } else {
    modeNotes.push('Submit the finished package with `advent-agent submit <path> --day ' + day + '` or POST it to the local API.');
  }
  if (!config.budgets.realWorldSuggestions) modeNotes.push('The recipient turned real-world suggestions off: make something digital.');
  const workshopPath = mode === 'launched' || mode === 'connected' ? WORKSHOP_DIR : undefined;
  return {
    season: { year: season.year, anchor, isCatchUp: Boolean(input.isCatchUp), pile: input.pile },
    day,
    date: zonedDateString(now, season.timeZone),
    locale: config.locale,
    language: profile.language || config.language,
    timeZone: season.timeZone,
    mode,
    recipient: sharedProfile(profile),
    history: earlier
      .sort((a, b) => a.day - b.day)
      .map((h) => ({ day: h.day, title: h.title, kind: h.kind, category: h.category, ideaId: h.ideaId, family: h.family, emotion: h.emotion, interaction: h.interaction, collection: h.collection, motifs: h.motifs, thread: h.thread, feedback: h.feedback, opened: h.opened })),
    collections: [...sets.values()].map((c) => ({ ...c, days: c.days.sort((a, b) => a - b), complete: c.days.length >= c.size })),
    anchorIdeas: anchor ? anchorIdeas(anchor) : undefined,
    budget: { tier: tier.tier, tokens: tier.tokens, note: tier.note },
    budgets: {
      tokenTarget: tier.tokens,
      tokenEnforced: Boolean(input.tokenEnforced),
      usdCapPerGift: config.budgets.usdCapPerGift ? config.budgets.usdCapPerGift * tier.capMultiplier : undefined,
      realWorldSuggestions: config.budgets.realWorldSuggestions,
      priceCeilingPerGift: ceiling,
      priceCeilingSeason: config.budgets.priceCeilingSeason,
      rule: ceiling
        ? `You never purchase or book anything. Real-world suggestions must stay under ${ceiling.amount} ${ceiling.currency} per gift. Hand over a purchase-ready proposal: exact item, vendor, URL, price with currency and the date you checked it, constraints, and what is left for the recipient to do.`
        : 'You never purchase or book anything. Keep real-world suggestions modest. Hand over a purchase-ready proposal: exact item, vendor, URL, price with currency and the date you checked it, constraints, and what is left for the recipient to do.',
    },
    permissions: {
      webResearch: config.permissions.webResearch,
      inspirationFolders: config.permissions.inspirationFolders,
      giftNetwork: config.permissions.giftNetwork,
    },
    capabilities: {
      renderers: [...GIFT_KINDS],
      workshopPath,
      skills: skillIndex(),
      providers: config.providers.filter((p) => p.enabled && p.hasKey).map((p) => ({ id: p.id, kind: p.kind, paidUse: p.paidUse })),
    },
    modeNotes,
    library: {
      howTo: mode === 'launched' ? `Read ${join(LIBRARY_DIR, 'INDEX.md')} for the idea index, then any idea file you like. Ideas are inspiration, never a quota.` : 'Call list_ideas and read_idea if you want inspiration. Ideas are inspiration, never a quota.',
      count: libraryCount(),
    },
    packaging: {
      format: 'A folder with gift.json (schema advent-agent/gift@2: emotion, interaction and a share frame are required; see gift-director references/share-and-export.md) plus files, a zip of it, or a single HTML file with an embedded manifest. Schema: schema/gift.schema.json next to the workshop folder.',
      check: mode === 'launched' ? `advent-agent check ./gift --day ${day}` : 'check_gift(day, path)',
      submit: mode === 'launched' ? `advent-agent submit ./gift --day ${day}` : 'submit_gift(day, path or files)',
      progress: mode === 'launched' ? 'advent-agent progress <thinking|making|testing|wrapping>' : 'report_progress(day, phase)',
    },
    workspace: input.workspace,
    attempt: input.attempt,
    previousProblems: input.previousProblems,
  };
}

/** BRIEF.md written into a launched agent's workspace. */
export function renderBriefMarkdown(ctx: AgentContext): string {
  const lines: string[] = [];
  lines.push(`# Door ${ctx.day} · ${ctx.date}${ctx.season.anchor === 'day1' ? ' · Day 1' : ctx.season.anchor === 'finale' ? ' · the finale' : ''}`);
  lines.push('');
  lines.push('You are the Secret Santa behind this door. Read the **gift-director** skill first, then make one complete gift and submit it.');
  lines.push('');
  lines.push(`- Workshop skills: \`${ctx.capabilities.workshopPath ?? 'n/a'}/skills/<name>/SKILL.md\` (start with gift-director)`);
  lines.push(`- Building blocks: \`${ctx.capabilities.workshopPath ?? 'n/a'}/kit/\``);
  lines.push(`- Idea library: ${ctx.library.howTo} (${ctx.library.count} ideas)`);
  lines.push(`- Package schema: \`${ctx.capabilities.workshopPath ? join(ctx.capabilities.workshopPath, '..', 'schema', 'gift.schema.json') : 'schema/gift.schema.json'}\``);
  lines.push('');
  lines.push('## How to work here');
  for (const n of ctx.modeNotes) lines.push(`- ${n}`);
  lines.push(`- Check before submitting: \`${ctx.packaging.check}\``);
  lines.push(`- Submit: \`${ctx.packaging.submit}\``);
  lines.push(`- Progress phases (spoiler-free): \`${ctx.packaging.progress}\``);
  lines.push('');
  lines.push('## Budget and rules');
  lines.push(`- Budget tier: **${ctx.budget.tier}**, about ${ctx.budget.tokens.toLocaleString('en-US')} tokens${ctx.budgets.tokenEnforced ? ' (a spend cap is enforced by your runtime)' : ' (advisory)'}. See gift-director references/budget-tiers.md.${ctx.budget.note ? ' ' + ctx.budget.note : ''}`);
  if (ctx.budgets.usdCapPerGift) lines.push(`- Spend cap: ${ctx.budgets.usdCapPerGift} USD for this gift.`);
  lines.push(`- ${ctx.budgets.rule}`);
  lines.push(`- Web research: ${ctx.permissions.webResearch ? 'allowed' : 'not allowed'}.`);
  lines.push(`- Folders you may look at for inspiration (read-only): ${ctx.permissions.inspirationFolders.length ? ctx.permissions.inspirationFolders.map((f) => `\`${f}\``).join(', ') : 'none. Do not browse the recipient\'s other folders.'}`);
  lines.push(`- Gifts may load from the network: ${ctx.permissions.giftNetwork ? 'only origins you declare in gift.json "network" (the recipient consents)' : 'no. Inline everything.'}`);
  lines.push('- Never invent personal facts. A universal delight beats a forced reference.');
  lines.push('');
  if (ctx.recipient) {
    lines.push('## About the recipient (shared by them)');
    for (const [k, v] of Object.entries(ctx.recipient)) lines.push(`- ${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`);
    lines.push('');
  }
  if (ctx.anchorIdeas?.length) {
    lines.push(`## ${ctx.season.anchor === 'day1' ? 'Day 1: choose among these ideas' : 'Finale ideas (or something of that size)'}`);
    for (const i of ctx.anchorIdeas) lines.push(`- \`${i.id}\`: ${i.title} (tier ${i.tier}, ${i.capability})`);
    lines.push('');
  }
  lines.push('## Earlier gifts this season (apply the rotation rules)');
  if (ctx.history.length === 0) lines.push('- None yet. This is the first door you prepare.');
  for (const h of ctx.history) {
    const bits = [h.kind, h.family, h.emotion, h.interaction?.join('/'), h.collection ? `set ${h.collection.set} ${h.collection.index}/${h.collection.size}` : undefined].filter(Boolean).join(', ');
    lines.push(`- Door ${h.day}: "${h.title}" (${bits})${h.feedback ? ' feedback: ' + h.feedback.replace('_', ' ') : ''}${h.opened === false ? ' (not opened yet)' : ''}`);
  }
  if (ctx.collections.length) {
    lines.push('');
    lines.push('## Collections this season (max 3 items per set, max 2 sets, items 4+ days apart)');
    for (const c of ctx.collections) lines.push(`- ${c.set}: doors ${c.days.join(', ')} of ${c.size}${c.complete ? ' (complete)' : ''}`);
  }
  lines.push('');
  lines.push('## Calendar facts');
  lines.push(`- Season ${ctx.season.year}, timezone ${ctx.timeZone}, language ${ctx.language}, locale ${ctx.locale}.`);
  lines.push(`- The calendar can render: ${ctx.capabilities.renderers.join(', ')}. Unknown kinds become a download.`);
  if (ctx.capabilities.providers.length) lines.push(`- Optional providers the recipient configured: ${ctx.capabilities.providers.map((p) => `${p.id} (${p.kind}${p.paidUse ? ', paid use enabled' : ', paid use off'})`).join('; ')}. Use them only through \`advent-agent generate image --prompt "..."\` (or the generate_image MCP tool); never ask for keys. Refusals (paid use off, cap reached) are final: make the asset yourself instead.`);
  lines.push(`- Attempt ${ctx.attempt}.`);
  if (ctx.previousProblems?.length) {
    lines.push('');
    lines.push('## The quality gate rejected your last submission. Fix these and resubmit:');
    for (const p of ctx.previousProblems) lines.push(`- [${p.severity}] ${p.code}${p.path ? ` (${p.path})` : ''}: ${p.message}`);
  }
  lines.push('');
  lines.push('The machine-readable version of this brief is in `brief.json`.');
  return lines.join('\n') + '\n';
}
