# Launch checklist

Status on 2026-11-19: release candidate `1.0.0-rc.1` is on npm (tags `next` = rc.1, `latest` = rc.0, checked today). The repository is **private**. The launch date is not fixed; Door 1 opens on 1 December.

Hard rules until launch day: the repository stays private, no GitHub release or tag on the remote, no private names, home paths or personal emails in tracked files, every commit signed off (`git commit -s`).

## Done

- [x] Code of Conduct contact set to `contact@deskmenace.com`.
- [x] `publish.yml` checks for npm 11.5.1 or later; `repository.url` in `package.json` is `git+https://github.com/DeskMenace/Advent-Agent.git` (matches exactly).
- [x] GitHub environment `npm` exists; deployment is limited to release tags `v*`.
- [x] `npm audit`: 0 vulnerabilities (puppeteer-core 25).
- [x] Node 22+ and CI on 3 operating systems; Dependabot configured.
- [x] Gary as ambassador: done on deskmenace.com (the Advent Agent page), outside this repository.
- [x] Voucher: dropped (D34). The promo config, API field and tests are removed.
- [x] Hero GIF: not doing one, and no sample gifts anywhere (D34). The README has a clip of Door 1 opening that stops before the gift (`docs/media/door-1-opening.gif`, recorded by `scripts/record-door-gif.ts`).
- [x] README reworked: step-by-step install, plain-language sections, cost detail moved to `docs/COSTS.md`.
- [x] Kit blocks: the 10 priority blocks are all built (32 built in `workshop/kit/INDEX.json`; the 16 marked `planned` are ones the agent builds from scratch).
- [x] deskmenace.com answers over TLS (HTTP 200 on 19 November). Still worth one look in your own browser.
- [x] Clean install of the published rc on this Mac: `npx advent-agent@next doctor` from an empty folder with an empty npm cache runs and finds Claude Code, Codex and Gemini CLI. This is not the fresh-machine test below.

## Now

- [ ] Move `latest` off the rc that has the old dependency: `npm dist-tag add advent-agent@1.0.0-rc.1 latest`.
- [ ] npm package settings: "Require two-factor authentication and disallow tokens" (Publishing access).
- [ ] GitHub account settings, Emails: "Keep my email addresses private" and "Block command line pushes that expose my email".
- [ ] Decide on the org: create the npm org `deskmenace`; if the package should live there, check whether it must become `@deskmenace/advent-agent` (an unscoped package cannot be moved; changing the name means a new package and updating `package.json`, README and docs). Team access command, once the org exists: `npm access grant read-write deskmenace:developers <package>`. Your personal account stays an owner.

## Trusted publisher (expires 13 November, set it up again at launch)

The npm trusted publisher was added on 11 November and will not be validated before it expires on 13 November, because publishing runs only from a release. Nothing breaks. At launch, on npmjs.com, package settings, Trusted Publisher, GitHub Actions:

- Organization `DeskMenace`, Repository `Advent-Agent`, Workflow `publish.yml`, Environment `npm` (case must match exactly).
- Tick "Allow npm publish"; leave "Allow npm dist-tag" unchecked; click "Set up connection".

## Next week (16–22 November)

- [ ] **deskmenace.com page:** install steps and a fuller FAQ are written and committed in the website repository (branch `purchase-flow-v2`, not pushed). Review, then push to deploy. The page's GitHub link gives a 404 until the repository is public.
- [ ] **Fresh-machine test** with `npx advent-agent@next` on Mac and Windows, with Claude Code and Codex: install, onboarding, list, Day 1.
- [ ] **Real-agent test (R1)** for Codex and Gemini CLI, still blocked on 19 November: Codex's config names `gpt-5.4`, which the ChatGPT login cannot use (set another model in `~/.codex/config.toml`); Gemini CLI has no auth method set (run `gemini` once and log in). Then `ADVENT_REAL_AGENTS=1 npm run test:agents`.
- [ ] **Gift lab:** your first batch (L3) and the scoring of the Day 1 and finale ideas (Q15).
- [ ] **Social preview image:** upload `docs/assets/social-preview.png` in the repository Settings.
- [ ] **gary.js:** the public gary.js repo is under the personal account (named DeskMenace). Rename it to gary.js and transfer it to the org. Its GitHub Pages address changes with it, and the website footer links to the old one (`SITE.github.garyJs`): update both together.
- [ ] **Publish a new rc** (`1.0.0-rc.2`, tag `next`) if you want the fresh-machine test to run the current code; rc.1 predates the voucher removal and the new README.

## Launch prep (22–24 November)

- [ ] Pick the launch date.
- [ ] Posts: first drafts exist outside the repository (`Advent-Agent-launch-posts.md`, next to this folder). Edit them in your voice and choose the Show HN angle.
- [ ] Version decision: `1.0.0` for the first automated publish (`publish.yml` has no `--tag`, and npm refuses a prerelease without one).
- [ ] `CHANGELOG.md`: the 1.0.0 entry is written and marked "unreleased"; put the date on it.

## Launch day (in this order)

1. [ ] Make the repository public. (First check that the history is as intended: the root commit predates the rewrite.)
2. [ ] Wait for CI; confirm the DCO workflow, dependency review and CodeQL run (they have never run on GitHub because the repository was private).
3. [ ] Switch off GitHub's default CodeQL setup (it conflicts with our workflow).
4. [ ] Apply the ruleset: `gh api repos/DeskMenace/Advent-Agent/rulesets --method POST --input .github/rulesets/main.json` (see `docs/RULESET.md`; decide first whether to keep "1 approving review" with one maintainer).
5. [ ] Turn on private vulnerability reporting (`SECURITY.md` depends on it).
6. [ ] Run `scripts/labels.sh`.
7. [ ] Set up the npm trusted publisher again (see above).
8. [ ] Add yourself as a required reviewer on the `npm` environment (Settings, Environments, npm, Deployment protection rules; not available on the Free plan while the repository is private).
9. [ ] Create the `v1.0.0` release: `publish.yml` publishes with provenance (needs the public repository, npm 11.5.1 or later).
10. [ ] Check: `npm view advent-agent dist-tags`, then `npx advent-agent doctor` from another folder.
11. [ ] Pin the repos and update the profile README.
12. [ ] Post, and stay online.

## Later

- [ ] On or after 2027-01-15: remove the Dependabot major-version ignore in `.github/dependabot.yml`.
- [ ] On other machines: `npm run hooks:install`.
