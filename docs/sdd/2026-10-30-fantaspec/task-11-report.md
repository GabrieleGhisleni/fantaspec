# Task 11 (steps 1-2) report: workflows

Status: DONE_WITH_CONCERNS (concerns are operational notes, nothing blocking)
Commit: `d02e1fb ci: tests, Pages deploy, scheduled data update` (only `.github/workflows/{ci,deploy,update}.yml`; not pushed)

## Files and design

### `.github/workflows/ci.yml`
- Triggers: `push`, `pull_request`. `permissions: contents: read`.
- Job `pipeline`: Python 3.14, pip cache keyed on `pipeline/pyproject.toml`, `pip install -e 'pipeline[test]'`, `python -m pytest pipeline` (from the repo root).
- Job `web`: Node 26, npm cache keyed on `web/package-lock.json`, `working-directory: web`: `npm ci`, `npx vitest run`, `npm run build`.
- `persist-credentials: false` on checkout (nothing pushes).

### `.github/workflows/deploy.yml`
- Triggers: `push` (branches `main`, paths `web/**`), `workflow_dispatch`, `workflow_call`. Workflow `permissions: contents: read`; concurrency group `pages`, `cancel-in-progress: false`.
- Job `build` (contents: read): checkout `ref: main`, Node 26, `npm ci`, `npm run build` in `web/`, `actions/upload-pages-artifact` with `path: web/dist`.
- Job `deploy` (`needs: build`; permissions `contents: read`, `pages: write`, `id-token: write`): `environment: github-pages` with `url: ${{ steps.deployment.outputs.page_url }}`, `actions/deploy-pages`.
- Two jobs so the build job has no Pages/OIDC rights. `configure-pages` is not used (Vite `base` is fixed to `/fantaspec/`).

### `.github/workflows/update.yml`
- Triggers: `schedule` cron `"7 * * * *"`, `workflow_dispatch` with `kind` (choice light/full, default full) and `backfill` (boolean, default false). Concurrency group `update`, no cancel. Workflow-level `permissions: contents: read`; each job widens only what it needs.
- Job `gate` (contents: read). Outputs `kind`, `slot`, `slot_key`.
  - Schedule only: checkout `ref: main`, Python 3.14, `pip install -e pipeline`, `python -m fantaspec gate` (the CLI appends `kind=` and `slot=` to `$GITHUB_OUTPUT`).
  - R12 de-dup: if `slot` is non-empty, `key` step builds `slot-<slot with every non-alphanumeric turned into '-'>` (e.g. `slot-2026-10-31T10-00-00-01-00`, so no `:`/`+` in cache keys). Then `actions/cache/restore` with `lookup-only: true` on that key.
  - `decide` step (always runs) writes the final outputs. Schedule: gate's kind, but `skip` on a cache hit. Dispatch: `kind` from the input and no slot/key; `backfill=true` forces `kind=full` (the CLI rejects `--backfill` with light, so this avoids a hard error). A dispatch run never touches checkout, Python or the cache.
  - The gate job is not skipped on dispatch (a skipped `needs` job would force awkward `!cancelled()` conditions in `run`). Its schedule-only steps are skipped, so it costs a few seconds.
- Job `run` (`if: needs.gate.outputs.kind != 'skip'`, contents: write, 60 min). Output `changed`.
  - Checkout `ref: main` (not the trigger SHA: a queued run may start after an earlier run's data commit, and a stale base would make `git pull --rebase` conflict on `raw/*.json`).
  - Python 3.14, `pip install -e pipeline`, then `python -m fantaspec run --kind $KIND [--backfill]` (flag from `inputs.backfill`, empty on schedule). Exit 1 = validation failed, so the job fails and nothing is committed.
  - Commit step: user `github-actions[bot]` / `41898585+github-actions[bot]@users.noreply.github.com`, `git add raw web/public/data`, if `git diff --cached --quiet` succeeds: `changed=false`, exit. Else commit `data: <kind> <TZ=Europe/Rome date -Iseconds>`, then up to 3 attempts of `git pull --rebase origin main && git push origin HEAD:main` (rebase aborted and 5/10/15 s backoff between attempts; error and exit 1 if all fail), then `changed=true`.
  - Marker: only when `slot_key` is non-empty (schedule with a slot), after the commit step succeeded: write `$RUNNER_TEMP/slot-marker` and `actions/cache/save` it under the slot key. Dispatch never writes a marker.
- Job `deploy` (`needs: run`, `if: needs.run.outputs.changed == 'true'`; permissions `contents: read`, `pages: write`, `id-token: write`): `uses: ./.github/workflows/deploy.yml`.

## Action versions (checked with `gh api repos/actions/<name>/releases/latest`; `runs.using` read from each action.yml at the tag)
| action | version | runtime |
|---|---|---|
| actions/checkout | v7 (7.0.1) | node24 |
| actions/setup-node | v7 (7.1.0) | node24 |
| actions/setup-python | v7 (7.1.0) | node24 |
| actions/cache (restore, save) | v6 (6.1.0) | node24 |
| actions/upload-pages-artifact | v5 (5.0.0) | composite |
| actions/deploy-pages | v5 (5.0.1) | node24 |
| actions/configure-pages | v6.0.0 exists, not used | node24 |

No action runs on Node 20. Referenced by major tag, as asked.

## Lint (step 2)
Command (from the repo root): `go run github.com/rhysd/actionlint/cmd/actionlint@latest` (actionlint v1.7.12).
Output: empty, exit 0, "Found 0 errors in 3 files" with `-verbose`. shellcheck (`/home/linuxbrew/.linuxbrew/bin/shellcheck`) is on PATH and active: a deliberately bad scratch workflow (`echo $FOO && ls $(pwd)`) produced SC2046/SC2086, so the clean result covers the shell scripts too. pyflakes is not installed, so actionlint's pyflakes rule is off (no `python` scripts inline anyway).

## Local checks
- `pipeline/.venv/bin/python -m fantaspec gate` from the repo root: prints `kind=skip` / `slot=` (exit 0; today 2026-10-30 is not in a slot). With `GITHUB_OUTPUT=<file>` the same two lines are appended, as the workflow expects.
- `pipeline/.venv/bin/python -m pytest pipeline -q` from the repo root: 59 passed in 26 s (Python 3.14.6). So CI's `python -m pytest pipeline` works with `conftest` imports.
- The scripts were run outside Actions (extracted from the YAML, in the scratchpad):
  - `decide`: schedule+skip -> skip; schedule+due+no hit -> light; schedule+due+hit -> skip (also for the midnight fallback slot); dispatch light -> light; dispatch full -> full; dispatch light+backfill -> full with empty slot/key.
  - Slot key sanitising: `2026-10-31T10:00:00+01:00` -> `slot-2026-10-31T10-00-00-01-00`.
  - Fetch step args (stub python): `''`/`false` -> `run --kind full`; `true` -> `run --kind full --backfill`; light on schedule -> `run --kind light`.
  - Commit step against a local bare remote (shallow clone, bot identity checked in `git log`): (a) no change -> "Nothing changed", `changed=false`, no commit; (b) change while the remote advanced with an unrelated code commit -> rebase + push OK, `changed=true`, commit authored by `github-actions[bot]`; (c) remote changed the same `raw/a.json` -> rebase conflict, retries, then `::error::Could not push the data commit` and failure.
- Not verifiable locally: the Actions-only behaviour (cache lookup/save, reusable-workflow permissions, Pages environment). The controller's live checks (steps 4-5) cover it.

## Trigger-path walkthrough
1. Scheduled hour, gate says skip: `gate` job only; kind=skip; `run` and `deploy` skipped; no fetch, no commit, no marker.
2. Scheduled hour with a due on-the-hour slot, first trigger (:07): gate kind=light|full, slot=S; no cache for `slot-S`; `run` fetches, commits if changed, saves the marker. Second trigger (+1 h, still inside the 90-minute grace): gate returns the same slot S; cache hit -> `decide` outputs skip; `run` skipped. Half-hour slots (23:30) are due at only one trigger (00:07), so no second one anyway. If the first run failed (exit 1 or push error) no marker exists, so the +1 h trigger retries the slot (free retry). Because workflow-level concurrency serialises runs, the second trigger's gate runs only after the first run (and marker save) finished.
3. Manual dispatch light / full / backfill: gate job runs only `decide` (no checkout, no cache); kind from the input (backfill forces full); `run` runs `--kind` [+ `--backfill`]; no marker, so a later scheduled run of the same slot is unaffected.
4. Data unchanged: pipeline exit 0, `git diff --cached --quiet` true, `changed=false`, no commit, `deploy` skipped. The marker is still saved for scheduled runs.
5. Data changed: commit `data: <kind> <ISO>` pushed to main (rebase retry if main moved), `changed=true`, `deploy` job calls `deploy.yml` (checks out main, so it includes the data commit), builds, publishes. Marker saved after the push.
6. Push touching `web/**` on main: `deploy.yml` (push trigger) deploys main; `ci.yml` also runs. A data commit by the bot triggers neither (GITHUB_TOKEN), which is why path 5 exists. A human push of `web/public/data/**` does trigger deploy via `web/**`.
7. Any push or pull request: `ci.yml` runs both jobs.
8. Validation failure (exit 1): `run` fails after the pipeline step; no commit, no marker, no deploy; the next trigger retries if the slot is still within grace.

## Concerns / notes for the controller
- Hard failures vs the fallback slot: the gate's fallback slot (local midnight, used when `raw/` is empty or no pending fixture has a future kickoff) is "due" at every trigger of the day. With R12, a successful run makes it once a day, but a run that keeps failing hard (exit 1: validation, or a push error) saves no marker and so re-runs a full fetch every hour all day. This follows R12's literal wording (marker only after a successful run). The alternative is saving the marker on any outcome (attempt-once-per-slot), at the price of no automatic retry. Also: a soft failure (exit 0, `ok=false`, errors recorded in `meta.json` and committed) counts as success and is not retried.
- First run of the season: empty or incomplete `raw/` makes the gate's fallback return `full` and `run()` auto-backfills; the 60-minute job timeout should be enough for the 1 s politeness pause per fantacalcio.it request, but watch the first backfill.
- GitHub disables scheduled workflows in public repos after 60 days without repository activity. In the off-season, if no data commit happens for 60 days the hourly trigger stops and has to be re-enabled by hand (Actions tab, or `gh workflow enable update.yml`).
- Run and gate check out `main` explicitly; a dispatch started "from" another branch still operates on main's data and pushes to main.
- `gh` token scopes are `repo, gist, read:org, admin:public_key` (no `workflow`), but the remote is SSH (`git@github.com:GabrieleGhisleni/fantaspec.git`), so pushing workflow files is fine. If the controller instead pushes over HTTPS with the gh token, GitHub rejects workflow-file pushes without `workflow` scope (`gh auth refresh -s workflow`).
- The initial push should trigger `deploy.yml` (path filter `web/**` matches on a first push) and `ci.yml`. If deploy does not start, run `gh workflow run deploy.yml`. The `github-pages` environment created by Pages normally allows only the default branch, which is the only ref used here.
- The brief's ISO time in the commit message is Europe/Rome local time with offset (same format as `meta.json`), not UTC.
- Deviations from the brief/rulings, all deliberate: workflow-level `contents: read` with per-job widening (instead of workflow-level `contents: write`); `deploy.yml` split into build + deploy jobs; `ref: main` also on gate/run checkouts; backfill forces full on dispatch; the gate job also runs on dispatch (as a no-op `decide`).
