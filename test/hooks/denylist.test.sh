#!/usr/bin/env bash
# Proves the private-denylist hooks: they block, they pass, they never echo the term, and a missing denylist passes.
# Runs in a temp git repo with a temp HOME. Usage: bash test/hooks/denylist.test.sh
set -u
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
work="$(mktemp -d "${TMPDIR:-/tmp}/aa-hooktest.XXXXXX")"
trap 'rm -rf "$work"' EXIT
export HOME="$work/home"; mkdir -p "$HOME/.config/advent-agent"
unset ADVENT_AGENT_DENYLIST
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@example.com GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@example.com
repo="$work/repo"; mkdir -p "$repo"; cd "$repo" || exit 1
git init -q . && git checkout -q -b main 2>/dev/null
fails=0
ok()   { echo "ok   - $1"; }
fail() { echo "FAIL - $1"; fails=$((fails + 1)); }
TERM1="zebrafruit"   # an invented term; stands in for a private one
DL="$HOME/.config/advent-agent/denylist.txt"

# --- installer: installs, is idempotent, refuses to clobber a foreign hook non-interactively
bash "$root/scripts/install-hooks.sh" </dev/null >/dev/null 2>&1 && ok "installer installs both hooks" || fail "installer"
[ -x .git/hooks/pre-commit ] && [ -x .git/hooks/commit-msg ] && ok "hooks are executable" || fail "hooks executable"
out="$(bash "$root/scripts/install-hooks.sh" </dev/null 2>&1)"; echo "$out" | grep -q "already installed" && ok "installer is idempotent" || fail "idempotent"
printf '#!/bin/sh\n# my own hook\nexit 0\n' > .git/hooks/pre-commit
bash "$root/scripts/install-hooks.sh" </dev/null >/dev/null 2>&1; [ $? -ne 0 ] && grep -q "my own hook" .git/hooks/pre-commit && ok "foreign hook is not overwritten" || fail "foreign hook overwritten"
bash "$root/scripts/install-hooks.sh" --force </dev/null >/dev/null 2>&1; grep -q "advent-agent denylist hook" .git/hooks/pre-commit && ok "--force replaces it" || fail "--force"

# --- missing denylist: passes, warns once
rm -f "$DL"
echo "hello" > a.txt; git add a.txt
out="$(git commit -m "first" 2>&1)"; rc=$?
[ $rc -eq 0 ] && ok "missing denylist: commit passes" || fail "missing denylist blocks ($out)"
echo "$out" | grep -qi "no private denylist" && ok "missing denylist: warns" || fail "missing denylist: no warning"
echo "more" >> a.txt; git add a.txt; out="$(git commit -m "second" 2>&1)"
echo "$out" | grep -qi "no private denylist" && fail "warned twice" || ok "missing denylist: warns only once"

# --- denylist present
cat > "$DL" <<DENY
# comment line
nothing-here-matches
$TERM1[a-z]*
DENY

echo "a clean line" >> a.txt; git add a.txt
out="$(git commit -m "clean" 2>&1)"; rc=$?
[ $rc -eq 0 ] && ok "clean commit passes" || fail "clean commit blocked ($out)"

printf 'line one\nthe ZebraFruitSalad is here\n' > b.txt; git add b.txt
out="$(git commit -m "added line" 2>&1)"; rc=$?
[ $rc -ne 0 ] && ok "added line matching an entry is blocked (case-insensitive)" || fail "added line not blocked"
echo "$out" | grep -q "blocked: b.txt:2 matches denylist entry #3" && ok "report names path, line and entry number" || fail "report format: $out"
echo "$out" | grep -qi "zebra" && fail "output echoes the term" || ok "output does not echo the term or the line"
git reset -q HEAD b.txt; rm b.txt

echo "text" > "my-${TERM1}-notes.txt"; git add .
out="$(git commit -m "name" 2>&1)"; rc=$?
[ $rc -ne 0 ] && ok "staged file name matching an entry is blocked" || fail "file name not blocked"
echo "$out" | grep -q "entry #3" && ok "file-name report names the entry" || fail "file-name report: $out"
git reset -q; rm -f ./my-*-notes.txt

echo "fine" >> a.txt; git add a.txt
out="$(git commit -m "mentions $TERM1 here" 2>&1)"; rc=$?
[ $rc -ne 0 ] && ok "commit message matching an entry is blocked" || fail "message not blocked"
echo "$out" | grep -q "blocked: commit message:1 matches denylist entry #3" && ok "message report names line and entry" || fail "message report: $out"
echo "$out" | grep -qi "zebra" && fail "message output echoes the term" || ok "message output does not echo the term"
git commit -q -m "ordinary message" && ok "ordinary message passes" || fail "ordinary message blocked"

printf '[unclosed\n' >> "$DL"; echo x >> a.txt; git add a.txt
out="$(git commit -m "bad regex" 2>&1)"; rc=$?
[ $rc -ne 0 ] && echo "$out" | grep -q "entry #4 is not a valid" && ok "invalid regex entry is reported by number" || fail "invalid regex handling: $out"

echo
[ $fails -eq 0 ] && echo "all hook checks passed" || echo "$fails hook check(s) failed"
exit $fails
