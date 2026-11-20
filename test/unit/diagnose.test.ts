import { describe, expect, it } from 'vitest';
import { diagnoseAgentOutput } from '../../src/jobs/runner.js';
import { gemini } from '../../src/adapters/index.js';

describe('agent failure diagnosis', () => {
  it('recognises the account problems seen in the real smoke test (8 Nov 2026)', () => {
    expect(diagnoseAgentOutput('{"error":"rate_limit","api_error_status":429,"api_error":"model_requires_usage_credits"}')?.code).toBe('agent_rate_limited');
    expect(diagnoseAgentOutput(`{"message":"The 'gpt-5.4' model is not supported when using Codex with a ChatGPT account.","code":"model_not_found"}`)?.code).toBe('agent_model_unavailable');
    expect(diagnoseAgentOutput('Please set an Auth method in your ~/.gemini/settings.json or specify GEMINI_API_KEY')?.code).toBe('agent_not_authenticated');
    // A healthy Claude Code stream: the routine rate-limit event and numbers that happen to contain 429.
    const healthy = '{"type":"rate_limit_event","rate_limit_info":{"status":"allowed","resetsAt":1795185429,"rateLimitType":"five_hour","overageStatus":"rejected"}}\n{"type":"assistant","usage":{"input_tokens":14290}}';
    expect(diagnoseAgentOutput(healthy)).toBeUndefined();
    // The spend cap is its own problem, not a rate limit, even with that routine event in the same output.
    expect(diagnoseAgentOutput(`${healthy}\n{"type":"result","subtype":"error_max_budget_usd","errors":["Reached maximum budget ($0.5)"]}`)?.code).toBe('agent_budget_reached');
    // Gemini CLI with a personal Google login, 20 November 2026.
    expect(diagnoseAgentOutput('An unexpected critical error occurred: This client is no longer supported for Gemini Code Assist for individuals. To continue using Gemini, please migrate to the Antigravity suite of products')?.code).toBe('agent_discontinued');
    // A real limit is still recognised.
    expect(diagnoseAgentOutput('{"type":"rate_limit_event","rate_limit_info":{"status":"rejected","rateLimitType":"five_hour"}}')?.code).toBe('agent_rate_limited');
    expect(diagnoseAgentOutput('all good, wrote gift.json')).toBeUndefined();
  });
  it('messages are fixed phrases, never raw agent output', () => {
    const d = diagnoseAgentOutput('rate limit hit while writing "Secret Gift Title"');
    expect(d?.message).not.toContain('Secret Gift Title');
  });
  it('Gemini is launched with --skip-trust so its approval mode is not silently downgraded', () => {
    const spec = gemini.launch({ task: 'gift', doorDir: '/w/doors/01', workspace: '/w', workshop: '/ws', promptFile: '/w/P', prompt: 'p', day: 1, webResearch: false, inspirationFolders: [], permissive: false });
    expect(spec.args).toContain('--skip-trust');
    expect(spec.args.slice(spec.args.indexOf('--approval-mode'), spec.args.indexOf('--approval-mode') + 2)).toEqual(['--approval-mode', 'auto_edit']);
  });
});
