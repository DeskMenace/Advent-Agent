import { describe, expect, it } from 'vitest';
import { diagnoseAgentOutput } from '../../src/jobs/runner.js';
import { gemini } from '../../src/adapters/index.js';

describe('agent failure diagnosis', () => {
  it('recognises the account problems seen in the real smoke test (8 Nov 2026)', () => {
    expect(diagnoseAgentOutput('{"error":"rate_limit","api_error_status":429,"api_error":"model_requires_usage_credits"}')?.code).toBe('agent_rate_limited');
    expect(diagnoseAgentOutput(`{"message":"The 'gpt-5.4' model is not supported when using Codex with a ChatGPT account.","code":"model_not_found"}`)?.code).toBe('agent_model_unavailable');
    expect(diagnoseAgentOutput('Please set an Auth method in your ~/.gemini/settings.json or specify GEMINI_API_KEY')?.code).toBe('agent_not_authenticated');
    expect(diagnoseAgentOutput('all good, wrote gift.json')).toBeUndefined();
  });
  it('messages are fixed phrases, never raw agent output', () => {
    const d = diagnoseAgentOutput('rate limit hit while writing "Secret Gift Title"');
    expect(d?.message).not.toContain('Secret Gift Title');
  });
  it('Gemini is launched with --skip-trust so its approval mode is not silently downgraded', () => {
    const spec = gemini.launch({ workspace: '/w', workshop: '/ws', promptFile: '/w/P', prompt: 'p', day: 1, webResearch: false, inspirationFolders: [], permissive: false });
    expect(spec.args).toContain('--skip-trust');
    expect(spec.args.slice(spec.args.indexOf('--approval-mode'), spec.args.indexOf('--approval-mode') + 2)).toEqual(['--approval-mode', 'auto_edit']);
  });
});
