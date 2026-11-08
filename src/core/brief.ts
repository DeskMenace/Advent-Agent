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

export interface BriefInput {
  season: Season;
  day: number;
  now: Date;
  config: Config;
  profile: Profile;
  history: HistoryRecord[];
  mode: ConnectionMode;
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
  const modeNotes: string[] = [];
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
    season: season.year,
    day,
    date: zonedDateString(now, season.timeZone),
    locale: config.locale,
    language: profile.language || config.language,
    timeZone: season.timeZone,
    mode,
    recipient: sharedProfile(profile),
    history: history
      .filter((h) => h.day < day)
      .map((h) => ({ day: h.day, title: h.title, kind: h.kind, category: h.category, motifs: h.motifs, thread: h.thread, feedback: h.feedback })),
    budgets: {
      tokenTarget: config.budgets.tokenTarget,
      tokenEnforced: Boolean(input.tokenEnforced),
      usdCapPerGift: config.budgets.usdCapPerGift,
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
      format: 'A folder with gift.json (schema advent-agent/gift@1) plus files, a zip of it, a single HTML file with an embedded manifest, or plain text. Schema: schema/gift.schema.json in the workshop folder.',
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
  lines.push(`# Door ${ctx.day} · ${ctx.date}`);
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
  lines.push(`- Token target: about ${ctx.budgets.tokenTarget.toLocaleString('en-US')} tokens${ctx.budgets.tokenEnforced ? ' (enforced by your runtime)' : ' (advisory: one polished modest gift beats an ambitious broken one)'}.`);
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
  lines.push('## Earlier gifts this season');
  if (ctx.history.length === 0) lines.push('- None yet. This is the first door you prepare.');
  for (const h of ctx.history) lines.push(`- Door ${h.day}: "${h.title}" (${h.kind}${h.category ? ', ' + h.category : ''})${h.motifs.length ? ' motifs: ' + h.motifs.join(', ') : ''}${h.thread ? ' thread: ' + h.thread : ''}${h.feedback ? ' feedback: ' + h.feedback.replace('_', ' ') : ''}`);
  lines.push('');
  lines.push('## Calendar facts');
  lines.push(`- Season ${ctx.season}, timezone ${ctx.timeZone}, language ${ctx.language}, locale ${ctx.locale}.`);
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
