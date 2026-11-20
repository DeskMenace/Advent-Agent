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
- [x] deskmenace.com page: step-by-step install and a fuller FAQ, pushed to `main` of the website repository on 19 November. The page's GitHub link gives a 404 until this repository is public.
- [x] Kit blocks: the 10 priority blocks are all built (32 built in `workshop/kit/INDEX.json`; the 16 marked `planned` are ones the agent builds from scratch).
- [x] deskmenace.com answers over TLS (HTTP 200 on 19 November). Still worth one look in your own browser.
- [x] Clean install of the published rc on this Mac: `npx advent-agent@next doctor` from an empty folder with an empty npm cache runs and finds Claude Code, Codex and Gemini CLI. This is not the fresh-machine test below.

## In order of priority (rebuilt on 20 November)

The rule behind the order: test first, trusted publisher last. A trusted publisher that is not used by a publish expired after two days last time (added 11 November, gone on the 13th), and it is only used by the `v1.0.0` release. So it is set up on launch day, just before the release, once everything else is proven. Publishing a release candidate from your own machine does not need it.

### 1. Package name: decided (D35)
- [x] The package stays `advent-agent`.
- [ ] Create the npm org `deskmenace` to reserve the name (npmjs.com, "Add organization", free plan). Team access, once it exists: `npm access grant read-write deskmenace:developers advent-agent`; your personal account stays an owner.

### 2. Publish `1.0.0-rc.2` (so the tests run on the real package)
- [x] `1.0.0-rc.2` published on 20 November; `latest` and `next` both point to it (checked).
- [ ] `1.0.0-rc.3` (adds Antigravity CLI and the clearer Gemini message): version bumped, built and checked. To publish: `npm publish --tag next`, then `npm dist-tag add advent-agent@1.0.0-rc.3 latest`.
- [ ] npm package settings: "Require two-factor authentication and disallow tokens" (Publishing access).

### 3. Unblock the agents
- [x] Codex: the model in `~/.codex/config.toml` is changed (20 November).
- [x] Gemini CLI: logged in on 20 November.

### 4. Test (anything found here becomes rc.3, then test again)
- [x] **Real-agent test, Claude Code and Codex:** both made and sealed a gift on 20 November. It found two bugs first, both fixed: a list check could not finish under the fixed $0.25 cap on Claude Code's current default model (now the user's own spend limit, D36), and a reached spend cap was reported as a rate limit.
- [x] **Real-agent test, Gemini CLI:** run on 20 November. Gemini CLI 0.70 with a personal Google login stops with "This client is no longer supported for Gemini Code Assist for individuals". The README no longer recommends it for install and says its gift path is untested; the calendar shows a clear message.
- [x] **Real-agent test, Antigravity CLI (D37):** new adapter; `agy` 1.5.13 made and sealed a gift on 20 November (552 s). Google's replacement for Gemini CLI on personal accounts.
- [ ] **Fresh-machine test** with `npx advent-agent@next` on Mac and Windows, with Claude Code and Codex: install, onboarding (the new spend-limit choice), list, Day 1.
- [ ] **Gift lab:** your first batch (L3) and the scoring of the Day 1 and finale ideas (Q15); rework ideas under 3.5.

### 5. Before the repository goes public
- [ ] Pick the launch date. Door 1 opens on 1 December and is wrapped during setup, so people need a few days before then.
- [x] GitHub account settings, Emails: "Keep my email addresses private" and "Block command line pushes that expose my email" (on, 20 November).
- [x] History: the root commit carries a personal email address as its author; accepted as it is (D36). Nothing else was found: no home paths or personal addresses in tracked files, no tags on the remote.
- [ ] **gary.js:** the public gary.js repo is under the personal account (named DeskMenace). Rename it to gary.js and transfer it to the org. Its GitHub Pages address changes with it, and the website footer links to the old one (`SITE.github.garyJs`): update both together, with whoever is working on the website.
- [ ] Posts: first drafts exist outside the repository (`Advent-Agent-launch-posts.md`, next to this folder). Edit them in your voice and choose the Show HN angle.
- [ ] The day before: set the version to `1.0.0` (`publish.yml` has no `--tag`, and npm refuses a prerelease without one) and put the date on the `CHANGELOG.md` entry.

## Launch day (in this order)

1. [x] Make the repository public (done on 20 November, before the release; the launch itself is the `v1.0.0` release and the posts).
2. [ ] Wait for CI; confirm the DCO workflow, dependency review and CodeQL run (they have never run on GitHub because the repository was private).
3. [x] Switch off GitHub's default CodeQL setup (it conflicts with our workflow). Done on 20 November.
4. [ ] Apply the ruleset: `gh api repos/DeskMenace/Advent-Agent/rulesets --method POST --input .github/rulesets/main.json` (see `docs/RULESET.md`; decide first whether to keep "1 approving review" with one maintainer).
5. [x] Turn on private vulnerability reporting (`SECURITY.md` depends on it). On since 20 November.
6. [ ] `scripts/labels.sh` was run on 20 November. Still to do: upload the social preview image (`docs/assets/social-preview.png`, repository Settings).
7. [ ] Set up the npm trusted publisher (it expires if unused, so not earlier). On npmjs.com, package settings, Trusted Publisher, GitHub Actions: Organization `DeskMenace`, Repository `Advent-Agent`, Workflow `publish.yml`, Environment `npm` (case must match exactly). Tick "Allow npm publish"; leave "Allow npm dist-tag" unchecked; click "Set up connection".
8. [ ] Add yourself as a required reviewer on the `npm` environment (Settings, Environments, npm, Deployment protection rules; not available on the Free plan while the repository is private).
9. [ ] Create the `v1.0.0` release: `publish.yml` publishes with provenance (needs the public repository, npm 11.5.1 or later).
10. [ ] Check: `npm view advent-agent dist-tags`, then `npx advent-agent doctor` from another folder.
11. [ ] Pin the repos and update the profile README.
12. [ ] Post, and stay online.

## Later

- [ ] On or after 2027-01-15: remove the Dependabot major-version ignore in `.github/dependabot.yml`.
- [ ] On other machines: `npm run hooks:install`.
