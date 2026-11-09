/** Small-tool gifts (`form: "tool"`, D27): the tool's own files live in a `tool/` folder of the package. */

export const TOOL_DIR = 'tool/';

export const isToolGift = (m: { form?: string }): boolean => m.form === 'tool';

/** The tool's files (script, README, install, uninstall), in package order. Empty for other gifts. */
export function toolFiles(m: { form?: string }, paths: string[]): string[] {
  if (!isToolGift(m)) return [];
  return paths.filter((p) => p.startsWith(TOOL_DIR) && !p.startsWith('.advent/'));
}
