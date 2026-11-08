/** Launched-mode adapter contract (AGENT_CONNECTIONS §2). */
import type { LaunchedAdapterId } from '../shared/config.js';

export interface Detection {
  installed: boolean;
  version?: string;
  path?: string;
  /** Human note, e.g. "no headless mode: connected/portable only". */
  note?: string;
}

export interface AdapterCapabilities {
  headless: boolean;
  /** The CLI enforces a spend/token budget itself. */
  budgetEnforced: boolean;
  /** Flags were verified against --help (see docs/AGENT_COMPAT.md). */
  verified: boolean;
  /** Can the agent run shell commands (so `advent-agent progress/submit` work)? */
  canRunCommands: boolean;
  loadsOwnMemory: boolean;
  notes: string[];
}

export interface LaunchSpec {
  command: string;
  args: string[];
  /** Prompt passed on stdin instead of argv. */
  stdinPrompt?: string;
  env?: Record<string, string>;
}

export interface LaunchContext {
  workspace: string;
  workshop: string;
  promptFile: string;
  prompt: string;
  day: number;
  webResearch: boolean;
  inspirationFolders: string[];
  usdCap?: number;
  permissive: boolean;
  customCommand?: string;
}

export interface Adapter {
  id: LaunchedAdapterId;
  label: string;
  binary: string;
  detect(): Promise<Detection>;
  capabilities(): AdapterCapabilities;
  launch(ctx: LaunchContext): LaunchSpec;
  /** Parse structured output lines for token/cost usage. Returns the best known figures. */
  parseUsage(output: string): { tokens?: number; usd?: number } | undefined;
}
