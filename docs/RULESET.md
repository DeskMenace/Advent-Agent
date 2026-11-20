# Branch ruleset for `main`

`.github/rulesets/main.json` describes the protection we want on `main`:

- pull request required, with 0 approving reviews for now (one maintainer; raise it to 1 and turn code-owner review back on when there is a second reviewer), conversations resolved
- required status checks: the `test` matrix (3 operating systems x Node 22, 24) and `e2e` from `.github/workflows/ci.yml`, plus `dco` from `.github/workflows/dco.yml`; branches must be up to date
- no force-push (`non_fast_forward`) and no deletion of `main`
- no bypass actors

Status check names must match the job names exactly. If you change the matrix in `ci.yml`, update the file.

## Apply it (at launch)

```bash
gh api repos/DeskMenace/Advent-Agent/rulesets --method POST --input .github/rulesets/main.json
```

To update it later, use `--method PUT` on `repos/DeskMenace/Advent-Agent/rulesets/<id>` (list ids with `gh api repos/DeskMenace/Advent-Agent/rulesets`).

## Do NOT apply it before launch

The repository is private until launch, and the GitHub Free plan does not enforce rulesets on private repositories. Applying it now would do nothing, and it would block the maintainer's own pushes once the repository is public and the checks do not exist yet. Apply it once the repository is public and CI has run at least once, so the check names are known to GitHub.

Decided on 20 November 2026: 0 approving reviews while there is a single maintainer, who could not approve her own pull request. Changes still go through a pull request and must pass the required checks.
