# SDD ledger — plan: docs/superpowers/plans/2026-10-30-fantaspec.md

Spec: docs/superpowers/specs/2026-10-30-fantaspec-design.md (read).
User instruction: all subagents on model "opus".

## Pre-flight scan

| Tasks | Shared file / interface | Producer vs consumer | Finding |
|---|---|---|---|
| 2→3,4,5,7 | models.py, config URL helpers, clubs.by_key() | 2 produces, later tasks extend/consume | consistent |
| 3→5 | VoteRow, RosterPlayer, CalendarFixture | fields match Task 5 needs (matchday, goals, pens_scored, conceded) | consistent |
| 4→5 | LineupEntry, Unavailable, match_player | player_stats consumes tuple(entries, covered clubs) | consistent |
| 5→6 | Fixture | schedule uses kickoff dates per matchday | consistent |
| 5,6→7 | join_fixtures, club_stats, player_stats, slots, due | 7 orchestrates | consistent |
| 7 internal | run() errors vs write_if_changed vs test_layout_change | write_if_changed "sets updatedAt when anything differs" vs contract "updatedAt changes only when site data changed"; test_layout_change expects wrote False while test_failed_source expects meta.lastRun.ok False written | CONFLICT → Ruling R2 |
| 7 internal | fake_fetcher "served from tests/fixtures" | only napoli schedule + calendar md 10 + votes md 8 saved | fake fetcher must synthesize/reuse pages; implementer's call |
| 8→9,10 | sampleData.ts | Task 8 "4 clubs, ~10 players" vs Task 9/10 tests needing Meret 572, Bernardeschi 184, Bastoni/Dimarco (inter D), Di Lorenzo (napoli D), Panchinaro, Partito, Senzapartita (club next null), Kean injured, N'Dicka | needs ≥5 clubs → Ruling R3 |
| 8→9,10 | App.tsx routes, squads.ts | placeholders filled later | consistent |
| 7→9 | web/public/data from backfill | 9 step 5 visual check uses it | consistent |
| 11 | gh repo create / push / Pages | publish, plan says ask user | Ruling R4 |

| Task | Self-consistency |
|---|---|
| 1 | done in planning session; step 5 commits done here |
| 2 | tests vs interfaces consistent; clubs.json keys match espn_teams.json (checked 20 ids) |
| 3 | consistent |
| 4 | consistent |
| 5 | "4 clubs, 6 fixtures" vs tests naming napoli, juventus, lazio, roma, torino → Ruling R5 |
| 6 | verified by hand: 18 slots in 29 Oct–7 Nov window; DST cases consistent |
| 7 | see R2 |
| 8 | React 18 in tech stack vs `npm create vite@latest` (React 19) → Ruling R6 |
| 9 | headings test requires no other headings on screen; consistent if implemented so |
| 10 | consistent |
| 11 | steps 3–6 need user approval → R4 |

## Rulings

- Ruling R1: work directly on `main`, no worktree — repo was empty (no commits), plan and CLAUDE.md mandate a commit per task on main, nothing is pushed until Task 11 asks the user — cost if wrong: history would need moving to a branch before the first push (cheap, nothing published).
- Ruling R2: (Task 7) `RunResult.wrote` = site data changed (clubs.json, players.json, or meta fields other than updatedAt/lastRun), which is also when `updatedAt` is bumped. When only `lastRun.ok`/`lastRun.errors` differ from disk, meta.json is rewritten keeping the stored `updatedAt`, and this does not count as `wrote`. A parse that yields no rows for a source that should never be empty (roster, standings, calendar, schedules) is that source's error (raw untouched). Validation failure writes nothing. — the plan's write_if_changed text contradicts the data contract ("updatedAt changes only when site data changed") and the two run tests; this satisfies the spec ("records the error in the metadata file", "never overwrite good data") and every test — cost if wrong: a status-only meta change produces a small data commit.
- Ruling R3: (Task 8) sampleData.ts must already contain every player/club that the Task 9 and 10 tests name, so it can have 5+ clubs — "4 clubs" was a size hint — cost if wrong: none, test data only.
- Ruling R4: (Task 11) steps 1–2 and a local commit run unattended; `gh repo create`, push, Pages enablement and live checks (steps 3–6) wait for the user's yes — public repo creation is a publish — cost if wrong: one extra question.
- Ruling R5: (Task 5) "4 clubs, 6 fixtures" is a size hint; the hand-built season may use as many clubs/fixtures as the named assertions need — cost if wrong: none.
- Ruling R6: (Task 8) pin react/react-dom 18 (and matching @types) to follow the plan's Tech Stack — cost if wrong: a later upgrade.
- Ruling R7: each implementer ticks its own task's `- [ ]` boxes in the plan file and includes that in its task commit — CLAUDE.md says ticked boxes are the resume map for "prosegui" — cost if wrong: noise in the plan diff.
- Ruling R8: Task 9 step 5 and Task 10 step 5 (browser checks at 360px) are done by the controller after the task review, in the browser pane — subagents may lack the pane — cost if wrong: none.

## Progress

Task 1: complete (commit f2cbcb7 in fantaspec, 51861ff8 in claude-sync; commits made by controller, nothing to review beyond plan text)
Task 2: dispatched (BASE f2cbcb7, implementer agent a64e4ae1aef849f94)
Task 2: minor (deferred): http.py retries 4xx (wasteful on certain-404 pages)
Task 2: minor (deferred): http.fetch_text uses response.text; header without charset → ISO-8859-1 garbles accents
Task 2: minor (deferred): espn.py parses naive dates in host local tz instead of UTC (latent, fixtures all end in Z)
Task 2: minor (deferred): no test for goals None on uncompleted match, none for http retry
Task 2: minor (deferred): tests import `from conftest import load_fixture` (works in prepend mode only)
Task 2: complete (commits f2cbcb7..8e01ef7, review clean)
Task 3: dispatched (BASE 8e01ef7)
Ruling R9: (Task 3) votes test count 305 → 316 accepted — controller independently counted 316 distinct a.player-name ids in fc_votes_8; the plan's 305 came from a regex that missed 11 entity-encoded accented slugs — cost if wrong: none (fixture-verified).
Ruling R10: (Task 3→5,7) s.v. is encoded as vote value 55 on the page; parser maps it to None; downstream treats `vote is None` as no vote (not counted in pres) — cost if wrong: s.v. players counted as present.
Task 3: minor (deferred): fc_votes._grade catches TypeError/KeyError too — missing cells silently become s.v.
Task 3: minor (deferred): fc_calendar drops unsplittable home-away pairs silently
Task 3: minor (deferred): player href regex anchored with $ — URL format change → [] silently (R2 sanity check in Task 7 covers roster)
Task 3: minor (deferred): fc_votes imports parse_player_link from fc_roster (cross-source dependency)
Task 3: minor (deferred): calendar matchday filter untested
Task 3: minor (deferred): spec line 64 and plan Task 3 test block still say 305 (actual 316, R9)
Task 3: complete (commits 8e01ef7..425e4f8, review clean)
Task 4: dispatched (BASE 425e4f8)
Task 4: minor (deferred): names surname fallback ignores conflicting initials (Konate A. → Konate M.)
Task 4: minor (deferred): fc_unavailable missing .team-name raises AttributeError not ValueError
Task 4: minor (deferred): fc_lineups adds club to covered set even if its card has no entries → startPct 0 instead of null
Task 4: minor (deferred): test_fc_unavailable uses real club "Pisa" as the unknown club
Task 4: complete (commits 425e4f8..aa17e0b, review clean)
Task 5: dispatched (BASE aa17e0b)
Ruling R11: (Task 5, plan-mandated finding) startPct/doubtful go stale after a club has played because parse_lineups returns club keys only. Spec/contract binds ("when the club's next match is on the probable-lineups page"): change parse_lineups' second return value to the set of (home, away) match pairs, update test_lineups_structure to count clubs from the pairs (≥18), and in player_stats set startPct and the doubtful status only when the club's next fixture's (home, away) is in that set — cost if wrong: small interface churn in Task 4's parser.
Task 5: minor (deferred): fixtures.join dedupes ESPN records last-wins; stale raw copy could revert a completed match (prefer completed) — relevant to Task 7
Task 5: minor (deferred): club with remaining fixtures lacking ESPN kickoff gets next null; live match skipped from next; bare KeyError on missing standings row; test gaps (rescheduled postponed, +02:00 kickoff, h2h comment)
Task 5: fix round 1/5 dispatched (FIX_BASE 8855065, finding: stale startPct/doubtful, ruling R11)
Task 5: fix round 1/5 (1 addressed, 0 open; commits 8855065..81ca41f)
Task 5: minor (deferred): stats filters lineup entries by roster club, not e.club (transfer edge)
Task 5: minor (deferred): test_stats.py:73 comment "# club not covered" slightly stale (brief verbatim)
Task 5: complete (commits aa17e0b..81ca41f, review clean after 1 fix round)
Controller: plan/spec text amended for R9 (316) and R11 (lineup pairs) in a docs commit
Task 6: dispatched (BASE cc24700)
Ruling R12: (Task 6 review, plan-mandated) the 90-min grace + hourly :07 cron makes every :00 slot due at two consecutive triggers (+7, +67 min), doubling scraping against the spec's "2 runs a day" and "don't hammer" anti-goal. Keep schedule.due as tested (90-min grace guards GitHub delays); dedupe in the workflow: the gate CLI also outputs `slot=<ISO of the due slot>` (Task 7), and update.yml (Task 11) uses actions/cache restore (lookup-only) with key `slot-<ISO>` to skip an already-run slot, saving that key after a successful run — cost if wrong: if the cache misbehaves the slot runs twice, i.e. today's behaviour.
Ruling R13: (Task 7) a full run fetches both ESPN pages per club — `espn_schedule_url(id, ESPN_SEASON)` (results) and `espn_fixtures_url(id)` (upcoming) — because the spec lists both and upcoming kickoffs drive `next` and the gate — cost if wrong: 20 extra ESPN requests per full run.
Task 6: minor (deferred): no test for the 28 Mar 2027 spring DST change (reviewer verified by hand); no test documenting the +7/+67 double trigger
Task 6: complete (commits cc24700..5c79a32, review clean)
Task 7: dispatched (BASE 5c79a32)
Task 7: implementer DONE_WITH_CONCERNS (commits a72d281 code, 8c866df backfill data; 53 tests; real backfill ok: 616 players, nextMatchday 10 31 Oct–2 Nov, Meret pres 6)
Ruling R14: (Task 7 implementer concern) an empty votes page counts as an error only when every completed fixture of that matchday finished more than 24 h ago; otherwise (votes not out yet, e.g. the 23:30 run after a round's first matches) it is skipped silently and that matchday's previous raw votes are kept — avoids a false "Ultimo aggiornamento non riuscito" banner every match day while still catching a votes-page layout change within a day — cost if wrong: a votes layout break is reported up to a day late.
User update (after restart): Sonnet allowed for easy subagent work, controller decides. Plan: sonnet for scoped re-reviews, Task 8 and Task 11 implementers, small-task reviews; opus for Tasks 9–10, complex reviews, final review.
Ruling R15: (Task 7 review ⚠️) spec says first run of the season backfills; a full run with no raw calendar behaves as --backfill — cost if wrong: one heavier run on an empty raw/.
Task 7: minor (deferred): votes for a matchday whose page failed for the whole 4-day window are never refetched without manual backfill
Task 7: minor (deferred): partial calendar page (<10 fixtures) accepted and never refetched
Task 7: minor (deferred): broad except handlers drop traceback (run.py:91, :198)
Task 7: minor (deferred): SEEDED_LINEUPS defined twice in tests/league.py
Task 7: minor (deferred): stat assembly in run._publish rather than build.py (nit)
Task 7: fix round 1/5 dispatched (FIX_BASE 8c866df; findings: empty ESPN upcoming wipes fixtures + gate stall; R14 votes tolerance; R15 auto-backfill)
User approved creating the GitHub repo (in chat). Controller ran Task 11 step 3: public repo https://github.com/GabrieleGhisleni/fantaspec created, main pushed at 8c866df, Pages enabled with build_type=workflow (URL https://gabrieleghisleni.github.io/fantaspec/). Default workflow permissions "read" → workflows must declare their permissions. Pushes use SSH (gh token lacks `workflow` scope; SSH push of .github/workflows is fine). Ruling R4 superseded: pushing main after each task and the live checks of Task 11 steps 4–6 now proceed without asking.
Ruling R16: (Task 7 fix concern) gate fallback (uncompleted fixtures, none with future kickoff / empty raw) uses slot = today 00:00 Europe/Rome so the workflow's slot cache limits it to one full run per day — cost if wrong: a stuck season-end fixture is retried daily instead of hourly.
Task 7: fix round 1/5 implemented (commits 8c866df..056880f: a3d7b98 guard ESPN/votes/auto-backfill, 056880f daily fallback slot); scoped re-review dispatched (sonnet)
Ruling R17: Task 8 (web/ only) dispatched while Task 7's scoped re-review runs — files are disjoint; if Task 7 needs another fix round it waits until Task 8's implementer is done (never two implementers at once) — cost if wrong: a rebase-free sequential wait.
Task 8: dispatched (BASE 056880f, sonnet)
Task 7: fix round 1/5 (4 addressed, 0 open; commits 8c866df..056880f)
Task 7: minor (deferred): gate fallback returns before due(), so in the season-end window the 23:30 slot id is replaced by the midnight id (could use fallback only when due() is None)
Task 7: note for Task 11: slot cache key saved only after a successful run → a failing fallback retries hourly; run exits non-zero only on validation failure
Task 7: complete (commits 5c79a32..056880f, review clean after 1 fix round)
Task 8: implementer DONE (commit 2c1d70d; 34 vitest tests; build ok; Node 20 verified; vitest 4 / jsdom 27 / jest-dom 6 pinned for Node 20; commit trailer says Sonnet 5.5 — accurate, left as is); review dispatched (sonnet)
User instruction (chat): use Node 26, avoid EOL technologies.
Ruling R18: target Node 26 everywhere (CI/deploy workflows `node-version: 26`, package.json `engines.node >=26`), upgrade web deps to current majors (vitest/jsdom/jest-dom latest; React 19 replaces the plan's React 18, superseding R6), and run Python CI on 3.14 (current; 3.12 is security-only) — the user asked to avoid EOL tech and Node 20 reached EOL in Apr 2026 — cost if wrong: dependency churn in one fix round.
Task 8: review Approved (sonnet), spec ✅
Task 8: minor (deferred → Task 10): App wiring (changeSquads/select/importSquad) untested; "unknown selected squad" test vacuous; importSquad should use location.replace; decodeShare accepts empty names / duplicate ids
Task 8: minor (deferred → Task 9): no error boundary at app root (render exception blanks the page)
Task 8: minor (deferred): stale tabs overwrite storage (no storage-event listener); data load blocks #/rose; selectedId typed string but undefined when empty; perGame 0 for 0 played; dateRange throws on malformed date; no favicon/theme-color, nav aria-label, role=status
Task 8: fix round 1/5 dispatched (FIX_BASE 2c1d70d; R18 Node 26 + React 19 + current majors)
Task 8: fix round 1/5 (1 addressed, 0 open; commits 2c1d70d..607b724)
Task 8: complete (commits 056880f..607b724, review clean after 1 fix round)
Controller: docs commit a765174 (plan tech stack → Python 3.14, Node 26, React 19); pipeline/.venv rebuilt on Python 3.14.6, 59/59 pipeline tests pass with -W error
Ruling R19: (Task 8 deferred minor → Task 9) add a small React error boundary so a render exception in one player row cannot blank the page (Review Focus 1–2) — cost if wrong: one tiny component.
Task 9: dispatched (BASE a765174, opus)
Ruling R20: Task 11 steps 1–2 (+ local commit) dispatched in parallel with Task 9 — files are disjoint (.github/ vs web/); the Task 11 implementer must not edit the plan file and must commit only .github/ paths; controller ticks Task 11 boxes and runs the live checks (steps 4–6) after Tasks 9–10 — cost if wrong: an index.lock retry.
Task 11: workflows dispatched (BASE a765174, sonnet)
Task 11: implementer DONE_WITH_CONCERNS (commit d02e1fb, actionlint clean; actions checkout/setup-node/setup-python v7, cache v6, upload-pages-artifact v5, deploy-pages v5); review dispatched (opus)
Task 11: note: GitHub disables scheduled workflows after 60 days without repo activity (off-season) — tell the user
User request (chat): add their current team as a default squad (22 players pasted, no goalkeepers). Ids resolved by controller against web/public/data/players.json → .superpowers/sdd/2026-10-30-fantaspec/default-squad.json (Adams A. = 7484 venezia, Pessina = 2741 monza C).
Ruling R21: the default squad "La mia rosa" is seeded into localStorage only when the squads key is absent (first visit in a browser); a stored empty list (user deleted everything) or corrupted storage keeps today's behaviour (editor / no squads). Goes into Task 10 (editor+import) — cost if wrong: a friend opening the site sees the user's squad first (they can delete it).
User request (chat): delegate the UI review at 360 px to a subagent using the built-in-browser skill (instead of the controller doing Task 9 step 5).
User added goalkeepers + defenders: default squad now 29 players (P Mascardi 7457, Meret 572, Milinkovic-Savic V. 2170, Montipò 4957; D + Bisseck 6217, Bracaglia 7469, Bremer 2788).
Task 11: review Approved (opus), spec ✅, trigger paths walked
Task 11: minor (deferred): fallback slot + persistent hard failure → hourly full runs (no marker on failure)
Task 11: minor (deferred): raw-only change triggers a redeploy (changed should look at web/public/data only)
Task 11: minor (deferred): failed deploy not retried (marker saved before deploy)
Task 11: minor (deferred): concurrency comment inaccurate (pending runs get replaced, not queued)
Task 11: steps 1–2 complete (commits a765174..d02e1fb, review clean); steps 4–6 (live checks) pending until Tasks 9–10 land
Task 9: code review Approved (opus), spec ✅ (commit 4693ce1; 64 web tests)
Task 9: minor (deferred): boundary doesn't cover sort (season null → FV mediana throws in squadView.ts:86) or MatchCards; no top-level boundary in App
Task 9: minor (deferred): failed boundary never resets; components import from screens/squadView.ts (mirror belongs in format/results); MatchCards stale open state; missing club key shows "non più in Serie A"; venue row label wraps + totals vs per-game; test gaps (nextMatchday null header, next null detail, 3 of 4 status tags)
Task 9: waiting for the browser UI review (subagent) before closing
Task 10: dispatched (BASE 4693ce1, opus); Task 9 fix round (UI review findings) queued until Task 10's implementer is done
Task 9: browser UI review (opus, built-in browser, real data + user's squad): 0 Critical, 2 Important, 12 Minor; no horizontal scroll at 360/375/desktop; no console errors. Report: task-9-ui-review.md
Task 9: fix round 1 queued (after Task 10 implementer): I1 match-card "In rosa" names split mid-word (16px + overflow-wrap:anywhere); I2 compare table labels wrap 2–3 lines at 360 and home/away "2–9 in 4" reads like a score, open row 574–673 px tall
Task 9: minor (deferred, UI review M1–M12 in task-9-ui-review.md): e.g. FV/matchup columns don't align across rows; 3/22 rows push matchup to a third line at 360
Task 10: implementer DONE_WITH_CONCERNS (commit 4f7f6f6; 107 web tests; build ok)
Ruling R22: (Task 10 concern 1) don't seed the default squad when the first visit arrives on #/importa — that's a friend's device opening a share link; their phone shouldn't get the user's squad — cost if wrong: the user importing on a new device of their own doesn't get "La mia rosa" (they're importing it anyway). Goes into Task 10's fix round.
Task 9: fix round 1/5 dispatched (FIX_BASE 4f7f6f6, resume Task 9 implementer; I1 + I2 from UI review)
Task 10: review dispatched (opus)
Task 10: review Approved (opus), spec ✅; defaultSquad.ts verified against default-squad.json (29 ids)
Task 10: minor (deferred): share cap mismatch (editor unlimited vs decode >100 rejected; name 100 + " (2)" vs rename cap 50)
Task 10: minor (deferred): phone Back from edit view leaves #/rose; topbar "Rose" no-op while editing
Task 10: minor (deferred): DRY — SquadForm re-sorts like buildRows/byRoleThenName; ROLE_ORDER duplicates ROLE_GROUPS; CHIPS/Chip duplicated with SquadScreen
Task 10: minor (deferred): initialSquads writes storage inside useState initializer; no test deleting the selected squad
Task 10: minor (deferred): copy deviations (singular "1 giocatore", Salva, Eliminare «…»?, Rosa N, Altri {n}…, In rosa (n)); search shows departed players; results toggle
Task 10: fix round 1/5 dispatched (FIX_BASE 4f7f6f6 + concurrent Task 9 fix; R22 no seeding on #/importa) — touches App.tsx/App.test.tsx only, disjoint from Task 9 fix files
Task 10: fix round 1 implemented (commit c952355; 110 web tests); pushed with first deploy
Task 10: fix round 1/5 (1 addressed, 0 open; commits 4f7f6f6..c952355)
Task 10: complete (commits 4693ce1..c952355, review clean after 1 fix round); step 5 browser check pending (controller/UI agent)
