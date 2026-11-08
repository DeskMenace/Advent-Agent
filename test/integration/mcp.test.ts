import { afterEach, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { CompanionClient } from '../../src/cli/client.js';
import { buildMcpServer } from '../../src/mcp/server.js';
import { testCompanion, type TestCompanion } from '../helpers/companion.js';

let t: TestCompanion;
afterEach(async () => { await t?.close(); });

async function mcpClient(tc: TestCompanion) {
  process.env.ADVENT_AGENT_URL = tc.appUrl;
  process.env.ADVENT_AGENT_TOKEN = tc.token;
  const server = buildMcpServer(new CompanionClient({ homeRoot: tc.home }));
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  const client = new Client({ name: 'test', version: '0.0.0' });
  await client.connect(b);
  return client;
}

function textOf(r: unknown): string {
  const c = (r as { content?: Array<{ type: string; text?: string }> }).content ?? [];
  return c.map((x) => x.text ?? '').join('\n');
}

describe('MCP server', () => {
  it('I2.1 every tool is listed and callable; no purchase tools exist', async () => {
    t = await testCompanion({ config: { connection: { mode: 'connected', permissive: false } } });
    const client = await mcpClient(t);
    const tools = (await client.listTools()).tools.map((x) => x.name).sort();
    expect(tools).toEqual(['check_gift', 'generate_image', 'get_calendar_context', 'list_ideas', 'list_workshop', 'read_idea', 'read_workshop_guide', 'report_progress', 'start_gift', 'submit_gift']);
    expect(tools.join(' ')).not.toMatch(/purchase|buy|book|pay/);
    const ws = await client.callTool({ name: 'list_workshop', arguments: {} });
    expect(JSON.parse(textOf(ws))).toHaveProperty('skills');
    const ideas = await client.callTool({ name: 'list_ideas', arguments: {} });
    expect(JSON.parse(textOf(ideas))).toHaveProperty('ideas');
    const resources = (await client.listResources()).resources.map((r) => r.uri);
    expect(resources).toContain('advent-agent://guide');
    expect(resources).toContain('advent-agent://ideas');
    await client.close();
  });

  it('I2.3 no pending door → a clear message; I2.1 start_gift + report_progress + check_gift + submit_gift(path)', async () => {
    t = await testCompanion({ config: { connection: { mode: 'connected', permissive: false } } });
    const client = await mcpClient(t);
    const none = await client.callTool({ name: 'get_calendar_context', arguments: {} });
    expect(none.isError).toBe(true);
    expect(textOf(none)).toMatch(/No door is waiting/);

    await t.api('POST', '/api/doors/8/open');
    expect((await t.api<{ jobState: string }>('GET', '/api/doors/8')).data.jobState).toBe('waiting_for_agent');
    const ctx = JSON.parse(textOf(await client.callTool({ name: 'get_calendar_context', arguments: {} })));
    expect(ctx.day).toBe(8);
    expect(ctx.mode).toBe('connected');
    expect(JSON.stringify(ctx)).not.toMatch(/voucher|gary/i);

    const started = JSON.parse(textOf(await client.callTool({ name: 'start_gift', arguments: { day: 8 } })));
    expect(started.workspace).toMatch(/doors[\\/]08[\\/]workspace/);
    expect((await t.api<{ jobState: string; phase: string }>('GET', '/api/doors/8')).data.jobState).toBe('preparing');

    await client.callTool({ name: 'report_progress', arguments: { day: 8, phase: 'making' } });
    expect((await t.api<{ phase: string }>('GET', '/api/doors/8')).data.phase).toBe('making');

    const { mkdirSync, writeFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const gift = join(started.workspace, 'gift');
    mkdirSync(gift, { recursive: true });
    writeFileSync(join(gift, 'gift.json'), JSON.stringify({ schema: 'advent-agent/gift@1', day: 8, title: 'MCP gift', note: 'Made through MCP.', primary: 'index.html', artifacts: [{ path: 'index.html', kind: 'interactive-html' }, { path: 'nope.png', kind: 'image' }] }));
    writeFileSync(join(gift, 'index.html'), '<!doctype html><html><body><button>Hi</button></body></html>');
    const check = JSON.parse(textOf(await client.callTool({ name: 'check_gift', arguments: { day: 8, path: gift } })));
    expect(check.ok).toBe(false);
    expect(check.problems.some((p: { code: string }) => p.code === 'file_missing')).toBe(true);
    writeFileSync(join(gift, 'gift.json'), JSON.stringify({ schema: 'advent-agent/gift@1', day: 8, title: 'MCP gift', note: 'Made through MCP.', primary: 'index.html', artifacts: [{ path: 'index.html', kind: 'interactive-html' }] }));
    const submitted = JSON.parse(textOf(await client.callTool({ name: 'submit_gift', arguments: { day: 8, path: gift } })));
    expect(submitted.ok).toBe(true);
    expect(submitted.next).toMatch(/Your gift is wrapped\. Open door 8/);
    expect((await t.api<{ jobState: string }>('GET', '/api/doors/8')).data.jobState).toBe('ready');
    await client.close();
  });

  it('I2.2 inline files submission seals a gift; I2.4 an ineligible day is rejected', async () => {
    t = await testCompanion({ config: { connection: { mode: 'connected', permissive: false } } });
    const client = await mcpClient(t);
    await t.api('POST', '/api/doors/7/open');
    const html = '<!doctype html><html><head><title>Inline</title></head><body><p>hi</p></body></html>';
    const ok = JSON.parse(textOf(await client.callTool({ name: 'submit_gift', arguments: { day: 7, files: [
      { name: 'gift.json', text: JSON.stringify({ schema: 'advent-agent/gift@1', day: 7, title: 'Inline gift', note: 'No disk needed.', primary: 'index.html', artifacts: [{ path: 'index.html', kind: 'interactive-html' }] }) },
      { name: 'index.html', base64: Buffer.from(html).toString('base64') },
    ] } })));
    expect(ok.ok).toBe(true);
    expect((await t.api<{ jobState: string }>('GET', '/api/doors/7')).data.jobState).toBe('ready');
    const future = await client.callTool({ name: 'submit_gift', arguments: { day: 9, files: [{ name: 'gift.md', text: '# Too early' }] } });
    expect(future.isError).toBe(true);
    expect(textOf(future)).toMatch(/Door 9 opens on December 9/);
    const futureStart = await client.callTool({ name: 'start_gift', arguments: { day: 20 } });
    expect(futureStart.isError).toBe(true);
    await client.close();
  });
});
