/**
 * Runs a launched agent for one door: workspace + BRIEF.md, PATH shim for `advent-agent`, private log,
 * timeout, usage parsing, phase file watcher, auto-submit of ./gift on exit.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { chmodSync, createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync, type WriteStream } from 'node:fs';
import { delimiter, join } from 'node:path';
import type { Adapter, LaunchContext } from '../adapters/types.js';
import { resolveCommand } from '../adapters/index.js';
import { binPath, WORKSHOP_DIR } from '../core/package-paths.js';
import { PROGRESS_PHASES, type ProgressPhase } from '../shared/gift.js';

export interface RunInput {
  adapter: Adapter;
  /** 'gift' for a door, 'list' for checking the list (D28). */
  task?: 'gift' | 'list';
  /** The folder the agent is started in: the season workspace. */
  cwd: string;
  /** This door's (or the list task's) folder inside it. */
  workspace: string;
  logFile: string;
  prompt: string;
  day: number;
  year: number;
  timeoutMs: number;
  apiToken: string;
  apiUrl: string;
  webResearch: boolean;
  inspirationFolders: string[];
  usdCap?: number;
  permissive: boolean;
  customCommand?: string;
  onPhase: (phase: ProgressPhase) => void;
}

/**
 * Recognise account and setup problems in a CLI's output, so the user gets an actionable, spoiler-free message
 * instead of "exit code 1". Only fixed phrases are returned; the agent's raw output never reaches the UI.
 */
export function diagnoseAgentOutput(output: string): { code: string; message: string } | undefined {
  const o = output.toLowerCase();
  if (/rate_limit|rate limit|usage limit|requires_usage_credits|overage|quota|429/.test(o)) return { code: 'agent_rate_limited', message: 'has reached a usage or rate limit on its account. Try again later, or check its plan.' };
  if (/not logged in|please log ?in|login required|unauthori[sz]ed|invalid api key|authentication|set an auth method|401/.test(o)) return { code: 'agent_not_authenticated', message: 'is not signed in on this computer. Run it once in a terminal and log in, then try again.' };
  if (/model[^\n]{0,80}not (supported|found|available)|model_not_found|unknown model|invalid model/.test(o)) return { code: 'agent_model_unavailable', message: 'is configured with a model your account cannot use. Change the model in its own settings, then try again.' };
  if (/not trusted|trust this folder|workspace trust/.test(o)) return { code: 'agent_untrusted_folder', message: 'refused to work in the gift folder because it is not trusted.' };
  return undefined;
}

export interface RunOutcome {
  exitCode: number | null;
  timedOut: boolean;
  usage?: { tokens?: number; usd?: number };
  durationMs: number;
  /** The gift folder the agent wrote, if present. */
  giftFolder?: string;
  /** Recognised account/setup problem, if any. */
  diagnosis?: { code: string; message: string };
  error?: string;
}

export const DEFAULT_PROMPT = 'Read BRIEF.md in the current folder and follow the gift-director skill.';
/** The agent starts in the season workspace; each door's brief lives in its own subfolder (D28). */
export const promptForDoor = (day: number) => `Read doors/${String(day).padStart(2, '0')}/BRIEF.md and follow the gift-director skill. Work in that door's folder.`;
export const LIST_PROMPT = 'Read list/TASK.md and do what it says. Write list/list.md and nothing else.';

/** A tiny shim so `advent-agent` resolves for the child even when the package was run with npx. */
export function writeBinShim(dir: string): string {
  mkdirSync(dir, { recursive: true });
  const bin = binPath();
  const node = process.execPath;
  if (process.platform === 'win32') {
    writeFileSync(join(dir, 'advent-agent.cmd'), `@echo off\r\n"${node}" "${bin}" %*\r\n`);
  } else {
    const sh = join(dir, 'advent-agent');
    writeFileSync(sh, `#!/bin/sh\nexec "${node}" "${bin}" "$@"\n`);
    chmodSync(sh, 0o755);
  }
  return dir;
}

export class AgentRun {
  private child?: ChildProcess;
  private killed = false;
  private log?: WriteStream;
  private phaseTimer?: NodeJS.Timeout;
  private lastPhase?: ProgressPhase;

  constructor(private readonly input: RunInput) {}

  cancel(): void {
    this.killed = true;
    this.kill();
  }

  private kill(): void {
    if (!this.child || this.child.exitCode !== null) return;
    try {
      this.child.kill('SIGTERM');
      setTimeout(() => { try { this.child?.kill('SIGKILL'); } catch { /* gone */ } }, 5000).unref();
    } catch { /* already gone */ }
  }

  async run(): Promise<RunOutcome> {
    const { input } = this;
    const started = Date.now();
    mkdirSync(input.workspace, { recursive: true });
    const promptFile = join(input.workspace, 'PROMPT.txt');
    writeFileSync(promptFile, input.prompt);
    const shimDir = writeBinShim(join(input.cwd, '.bin'));
    const ctx: LaunchContext = {
      task: input.task ?? 'gift',
      workspace: input.cwd,
      doorDir: input.workspace,
      workshop: WORKSHOP_DIR,
      promptFile,
      prompt: input.prompt,
      day: input.day,
      webResearch: input.webResearch,
      inspirationFolders: input.inspirationFolders,
      usdCap: input.usdCap,
      permissive: input.permissive,
      customCommand: input.customCommand,
    };
    let spec;
    try {
      spec = input.adapter.launch(ctx);
    } catch (e) {
      return { exitCode: null, timedOut: false, durationMs: 0, error: (e as Error).message };
    }
    const command = resolveCommand(spec);
    this.log = createWriteStream(input.logFile, { flags: 'a' });
    this.log.write(`\n=== ${new Date().toISOString()} door ${input.day} · ${input.adapter.label} ===\n$ ${command} ${spec.args.map((a) => (a.includes(' ') ? JSON.stringify(a) : a)).join(' ')}\n`);
    const env: Record<string, string> = {
      ...(process.env as Record<string, string>),
      ...spec.env,
      PATH: `${shimDir}${delimiter}${process.env.PATH ?? ''}`,
      ADVENT_AGENT_JOB: `${input.year}:${input.day}`,
      ADVENT_AGENT_TOKEN: input.apiToken,
      ADVENT_AGENT_URL: input.apiUrl,
      ADVENT_AGENT_WORKSPACE: input.workspace,
      ADVENT_AGENT_CWD: input.cwd,
      ADVENT_AGENT_WORKSHOP: WORKSHOP_DIR,
      CI: '1',
      NO_COLOR: '1',
      TERM: 'dumb',
    };
    // Keep secrets out of the child's environment that it does not need.
    delete env.ADVENT_AGENT_HOME_SECRET;

    let output = '';
    const outcome = await new Promise<RunOutcome>((resolve) => {
      let timedOut = false;
      let settled = false;
      const finish = (o: Omit<RunOutcome, 'durationMs'>) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (this.phaseTimer) clearInterval(this.phaseTimer);
        this.log?.end();
        resolve({ ...o, durationMs: Date.now() - started });
      };
      let child: ChildProcess;
      try {
        child = spawn(command, spec.args, { cwd: input.cwd, env, shell: false, stdio: [spec.stdinPrompt ? 'pipe' : 'ignore', 'pipe', 'pipe'], windowsHide: true });
      } catch (e) {
        finish({ exitCode: null, timedOut: false, error: `Could not start ${command}: ${(e as Error).message}` });
        return;
      }
      this.child = child;
      if (spec.stdinPrompt && child.stdin) { child.stdin.write(spec.stdinPrompt); child.stdin.end(); }
      const timer = setTimeout(() => { timedOut = true; this.kill(); }, input.timeoutMs);
      const onData = (d: Buffer) => {
        const text = d.toString();
        output += text;
        if (output.length > 8 * 1024 * 1024) output = output.slice(-4 * 1024 * 1024);
        this.log?.write(text);
      };
      child.stdout?.on('data', onData);
      child.stderr?.on('data', onData);
      child.on('error', (e) => finish({ exitCode: null, timedOut, error: `Could not start ${command}: ${e.message}` }));
      child.on('close', (code) => {
        const usage = input.adapter.parseUsage(output);
        const giftFolder = join(input.workspace, 'gift');
        finish({ exitCode: code, timedOut, usage, giftFolder: existsSync(giftFolder) ? giftFolder : undefined, error: this.killed ? 'cancelled' : undefined, diagnosis: code !== 0 ? diagnoseAgentOutput(output.slice(-200_000)) : undefined });
      });
      // Tool-agnostic progress channel: the agent may write a phase name into ./.progress.
      this.phaseTimer = setInterval(() => this.pollPhaseFile(), 2000);
    });
    return outcome;
  }

  private pollPhaseFile(): void {
    const file = join(this.input.workspace, '.progress');
    if (!existsSync(file)) return;
    try {
      const phase = readFileSync(file, 'utf8').trim().toLowerCase() as ProgressPhase;
      if ((PROGRESS_PHASES as readonly string[]).includes(phase) && phase !== this.lastPhase) {
        this.lastPhase = phase;
        this.input.onPhase(phase);
      }
    } catch { /* ignore */ }
  }
}
