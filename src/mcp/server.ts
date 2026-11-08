/**
 * `advent-agent mcp`: stdio MCP server (AGENT_CONNECTIONS §3). Talks to the companion over the local API
 * and starts it if needed. There are no purchase tools.
 */
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { packageVersion } from '../core/package-paths.js';
import { CompanionClient } from '../cli/client.js';
import { InlineFileSchema, PROGRESS_PHASES } from '../shared/gift.js';

const SECRECY = 'Do not describe, quote or summarise the gift in chat while you work; the recipient may be reading. When done, say only: "Your gift is wrapped. Open door N in your calendar."';

function text(data: unknown) {
  return { content: [{ type: 'text' as const, text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }] };
}
function error(e: unknown) {
  const err = e as Error & { data?: unknown };
  return { content: [{ type: 'text' as const, text: typeof err.data === 'object' && err.data ? JSON.stringify(err.data, null, 2) : err.message }], isError: true };
}

export function buildMcpServer(client: CompanionClient): McpServer {
  const server = new McpServer({ name: 'advent-agent', version: packageVersion() });

  server.registerTool('get_calendar_context', {
    title: 'Get the day brief',
    description: `The brief for a door: date, recipient profile (user-approved fields), earlier gifts, budgets, permissions, what the calendar can render, how to package and submit. Without "day": the earliest unlocked door that is waiting for an agent. ${SECRECY}`,
    inputSchema: { day: z.number().int().min(1).max(24).optional() },
  }, async ({ day }) => {
    try { await client.ensureRunning(); return text(await client.json('GET', `/api/agent/context?mode=connected${day ? `&day=${day}` : ''}`)); } catch (e) { return error(e); }
  });

  server.registerTool('list_workshop', {
    title: 'List workshop skills',
    description: 'Index of the bundled Gift Workshop skills (name + description). Read gift-director first with read_workshop_guide.',
    inputSchema: {},
  }, async () => {
    try { await client.ensureRunning(); return text(await client.json('GET', '/api/workshop')); } catch (e) { return error(e); }
  });

  server.registerTool('read_workshop_guide', {
    title: 'Read a workshop skill',
    description: 'Full text of a skill (SKILL.md) or one of its files (examples/great-vs-lazy.md, references/...).',
    inputSchema: { skill: z.string(), file: z.string().optional() },
  }, async ({ skill, file }) => {
    try { await client.ensureRunning(); return text(await client.text(`/api/workshop/${encodeURIComponent(skill)}${file ? `?file=${encodeURIComponent(file)}` : ''}`)); } catch (e) { return error(e); }
  });

  server.registerTool('list_ideas', {
    title: 'List gift ideas',
    description: 'Idea library index (id, title, summary, suitable_if). Ideas are inspiration, never a quota; you may ignore them entirely. Optional text filter.',
    inputSchema: { filter: z.string().optional() },
  }, async ({ filter }) => {
    try { await client.ensureRunning(); return text(await client.json('GET', `/api/ideas${filter ? `?q=${encodeURIComponent(filter)}` : ''}`)); } catch (e) { return error(e); }
  });

  server.registerTool('read_idea', {
    title: 'Read a gift idea',
    description: 'The full idea entry (frontmatter + creative notes).',
    inputSchema: { id: z.string() },
  }, async ({ id }) => {
    try { await client.ensureRunning(); return text(await client.text(`/api/ideas/${encodeURIComponent(id)}`)); } catch (e) { return error(e); }
  });

  server.registerTool('start_gift', {
    title: 'Start a gift',
    description: `Creates a private workspace for the door and returns its absolute path plus the brief (BRIEF.md is inside). Marks the door as being prepared. Write your gift into <workspace>/gift. ${SECRECY}`,
    inputSchema: { day: z.number().int().min(1).max(24) },
  }, async ({ day }) => {
    try { await client.ensureRunning(); return text(await client.json('POST', '/api/agent/start', { day })); } catch (e) { return error(e); }
  });

  server.registerTool('report_progress', {
    title: 'Report progress',
    description: `Spoiler-free phase shown to the recipient: ${PROGRESS_PHASES.join(', ')}. Nothing else is shown.`,
    inputSchema: { day: z.number().int().min(1).max(24), phase: z.enum(PROGRESS_PHASES) },
  }, async ({ day, phase }) => {
    try { await client.ensureRunning(); await client.json('POST', '/api/agent/progress', { day, phase }); return text({ ok: true }); } catch (e) { return error(e); }
  });

  server.registerTool('check_gift', {
    title: 'Check a gift',
    description: 'Runs the quality gate without sealing: manifest, files, media, secret scan, headless render when a browser is available. Returns structured problems to fix. Pass a path (folder, zip or single file) or inline files.',
    inputSchema: { day: z.number().int().min(1).max(24), path: z.string().optional(), files: z.array(InlineFileSchema).optional() },
  }, async ({ day, path, files }) => {
    try { await client.ensureRunning(); return text(await client.json('POST', `/api/agent/check?day=${day}`, path ? { path } : { files })); } catch (e) { return error(e); }
  });

  server.registerTool('submit_gift', {
    title: 'Submit a gift',
    description: `Seals the gift for the door after the quality gate passes. Pass the folder/zip/file path, or inline files [{name, text|base64}] when you cannot write to disk. On problems, fix and resubmit. ${SECRECY}`,
    inputSchema: { day: z.number().int().min(1).max(24), path: z.string().optional(), files: z.array(InlineFileSchema).optional() },
  }, async ({ day, path, files }) => {
    try {
      await client.ensureRunning();
      const report = await client.json<{ ok: boolean }>('POST', `/api/agent/submit?day=${day}&mode=connected`, path ? { path, day } : { files, day });
      return text(report.ok ? { ...report, next: `Say only: "Your gift is wrapped. Open door ${day} in your calendar."` } : report);
    } catch (e) { return error(e); }
  });

  // Resources: the same guides for hosts that prefer resources.
  server.registerResource('agent-guide', 'advent-agent://guide', { title: 'Advent Agent guide', description: 'Compact guide for agents', mimeType: 'text/markdown' }, async (uri) => {
    await client.ensureRunning();
    const r = await fetch(`${client.baseUrl}/agent-guide.md`);
    return { contents: [{ uri: uri.href, text: await r.text() }] };
  });
  server.registerResource('workshop-skill', new ResourceTemplate('advent-agent://workshop/{skill}', { list: async () => {
    await client.ensureRunning();
    const { skills } = await client.json<{ skills: Array<{ name: string; description: string }> }>('GET', '/api/workshop');
    return { resources: skills.map((s) => ({ uri: `advent-agent://workshop/${s.name}`, name: s.name, description: s.description, mimeType: 'text/markdown' })) };
  } }), { title: 'Workshop skill', description: 'SKILL.md of a bundled skill' }, async (uri, { skill }) => {
    await client.ensureRunning();
    return { contents: [{ uri: uri.href, text: await client.text(`/api/workshop/${encodeURIComponent(String(skill))}`) }] };
  });
  server.registerResource('idea-index', 'advent-agent://ideas', { title: 'Idea index', mimeType: 'application/json' }, async (uri) => {
    await client.ensureRunning();
    return { contents: [{ uri: uri.href, text: JSON.stringify(await client.json('GET', '/api/ideas'), null, 2) }] };
  });

  return server;
}

export async function runMcpServer(): Promise<void> {
  const client = new CompanionClient();
  const server = buildMcpServer(client);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  await new Promise(() => undefined);
}
