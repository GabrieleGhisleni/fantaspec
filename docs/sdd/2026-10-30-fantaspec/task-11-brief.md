### Task 11: Workflows, GitHub repo and Pages

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `.github/workflows/update.yml`

**Interfaces:**
- Consumes: `python -m fantaspec gate|run`, `npm run build`.

Workflows:
- `ci.yml`: on push and pull_request; job 1 Python 3.14 `pip install -e pipeline[test]` + `python -m pytest pipeline`; job 2 Node 26 `npm ci && npx vitest run && npm run build` in `web/`.
- `deploy.yml`: `on: push (branches: main, paths: web/**)`, `workflow_dispatch` and `workflow_call`. Checks out with `ref: main` (when called from `update.yml`, the event SHA is the commit *before* the data commit), builds `web/` and deploys with `actions/upload-pages-artifact` + `actions/deploy-pages`. Permissions `pages: write`, `id-token: write`, `contents: read`. Concurrency group `pages`.
- `update.yml`: `schedule: cron "7 * * * *"` and `workflow_dispatch` with inputs `kind` (choice light/full, default full) and `backfill` (boolean). Concurrency group `update`, no cancel. Job `gate` (scheduled runs only) outputs `kind`; job `run` (if `kind != skip`) runs `python -m fantaspec run`, then commits `raw/` and `web/public/data/` as `github-actions[bot]` with message `data: <kind> <ISO time>` only if `git diff --cached --quiet` fails, and sets output `changed`. Job `deploy` calls `./.github/workflows/deploy.yml` when `changed == 'true'` (pushes made with `GITHUB_TOKEN` don't trigger other workflows, so the update workflow deploys itself). Permissions `contents: write`, plus those deploy needs.

- [ ] **Step 1: Write the three workflow files.**
- [ ] **Step 2: Lint** with `actionlint` if available (`go run github.com/rhysd/actionlint/cmd/actionlint@latest` otherwise). Expected: no errors.
- [ ] **Step 3: Ask the user** before creating the public repo. On yes: `gh repo create fantaspec --public --source ~/projects/fantaspec --push`, then enable Pages with GitHub Actions as the source (`gh api -X POST repos/{owner}/fantaspec/pages -f build_type=workflow`).
- [ ] **Step 4: Verify CI and deploy.** `gh run watch` on the CI and deploy runs. Expected: both green; `curl -s -o /dev/null -w "%{http_code}" https://<user>.github.io/fantaspec/data/meta.json` prints `200`.
- [ ] **Step 5: Verify the update workflow** with `gh workflow run update.yml -f kind=light`. Expected: green; either a `data:` commit plus a deploy, or no commit when nothing changed.
- [ ] **Step 6: Phone check.** Open the Pages URL in the browser pane at 375×812: create a squad, see rows and details with real data. Send the user the URL.
- [ ] **Step 7: Commit and push** `git commit -m "ci: tests, Pages deploy, scheduled data update" && git push`.
