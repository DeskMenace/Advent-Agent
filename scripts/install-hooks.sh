#!/usr/bin/env bash
# Installs the private-denylist git hooks (pre-commit, commit-msg) into the current repository.
# Safe to run again. Never overwrites a hook it did not install without asking (non-interactive runs refuse unless --force).
set -u

force=0
[ "${1:-}" = "--force" ] && force=1

src="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/hooks"
hooks_dir="$(git rev-parse --git-path hooks 2>/dev/null)" || { echo "Not inside a git repository." >&2; exit 1; }
mkdir -p "$hooks_dir"
MARK="advent-agent denylist hook"
status=0

for name in pre-commit commit-msg; do
  from="$src/$name"
  to="$hooks_dir/$name"
  if [ ! -f "$from" ]; then echo "Missing $from" >&2; status=1; continue; fi
  if [ -e "$to" ]; then
    if cmp -s "$from" "$to"; then echo "$name: already installed"; chmod +x "$to"; continue; fi
    if ! grep -q "$MARK" "$to" 2>/dev/null; then
      ok=0
      if [ "$force" -eq 1 ]; then ok=1
      elif [ -t 0 ]; then
        printf '%s: another hook already exists at %s. Overwrite it? [y/N] ' "$name" "$to"
        read -r answer
        case "$answer" in y|Y|yes|YES) ok=1 ;; esac
      fi
      if [ "$ok" -ne 1 ]; then echo "$name: left your existing hook untouched (use --force to overwrite)"; status=1; continue; fi
    fi
  fi
  cp "$from" "$to" && chmod +x "$to" && echo "$name: installed"
done

echo "Denylist file (create it yourself, outside the repo): ~/.config/advent-agent/denylist.txt"
exit $status
