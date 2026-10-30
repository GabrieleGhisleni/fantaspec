"""The site data around clubs.json and players.json: meta.json, validation, and writing only on change."""
import json
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path

from fantaspec.config import SEASON, TZ
from fantaspec.models import Fixture

CLUB_COUNT = 20
MIN_PLAYERS = 400
ROLES = ("P", "D", "C", "A")
NEXT_MIN_FIXTURES = 5  # a matchday with fewer still to play (a lone postponed match) isn't the next one
_EXAMPLES = 5  # offending players named in a validation message


def validate(clubs: dict, players: dict) -> list[str]:
    """What makes the computed site data unfit to publish (empty when it's fine)."""
    problems = []
    if len(clubs) != CLUB_COUNT:
        problems.append(f"clubs: {len(clubs)} instead of {CLUB_COUNT}")
    if len(players) < MIN_PLAYERS:
        problems.append(f"players: {len(players)}, fewer than {MIN_PLAYERS}")
    checks = {
        "unknown club": ("club", lambda v: v is not None and v not in clubs),
        "role outside P/D/C/A": ("role", lambda v: v not in ROLES),
        "startPct outside 0-100": ("startPct", lambda v: v is not None and not 0 <= v <= 100),
    }
    for problem, (field, bad) in checks.items():
        found = [f"{pid} ({p[field]})" for pid, p in players.items() if bad(p[field])]
        if found:
            more = f" and {len(found) - _EXAMPLES} more" if len(found) > _EXAMPLES else ""
            problems.append(f"players: {problem}: {', '.join(found[:_EXAMPLES])}{more}")
    return problems


def next_matchday(fixtures: list[Fixture], now: datetime) -> dict | None:
    """The lowest matchday with at least NEXT_MIN_FIXTURES fixtures still to play (not completed, kickoff
    after `now`), with the local dates of the first and last of them; None when there is none."""
    ahead: dict[int, list[date]] = defaultdict(list)
    for f in fixtures:
        if not f.completed and f.kickoff is not None and f.kickoff > now:
            ahead[f.matchday].append(f.kickoff.astimezone(TZ).date())
    for number in sorted(ahead):
        days = ahead[number]
        if len(days) >= NEXT_MIN_FIXTURES:
            return {"number": number, "from": min(days).isoformat(), "to": max(days).isoformat()}
    return None


def meta(kind: str, errors: list[str], fixtures: list[Fixture], now: datetime) -> dict:
    """meta.json for a run of `kind` at `now` (aware); write_if_changed keeps or bumps updatedAt."""
    stamp = now.astimezone(TZ).isoformat(timespec="seconds")
    return {
        "season": SEASON,
        "updatedAt": stamp,
        "lastRun": {"at": stamp, "kind": kind, "ok": not errors, "errors": list(errors)},
        "nextMatchday": next_matchday(fixtures, now),
    }


def write_if_changed(out_dir: Path, files: dict[str, dict]) -> bool:
    """Write the site files ({name: data}, saved as <name>.json, one of them "meta") where they changed.

    Site data changed when a file other than meta differs from disk, or a meta field other than
    updatedAt and lastRun does: then every file is written, meta with its new updatedAt, and the
    result is True. Otherwise, when lastRun's outcome (ok, errors) differs, only meta is rewritten,
    keeping the stored updatedAt. Timestamps and lastRun.kind alone never cause a write.
    Returns whether site data was written.
    """
    old = {name: _read(out_dir / f"{name}.json") for name in files}
    new_meta, old_meta = files["meta"], old["meta"] or {}
    if any(files[name] != old[name] for name in files if name != "meta") or _site(new_meta) != _site(old_meta):
        for name, data in files.items():
            _write(out_dir / f"{name}.json", data)
        return True
    if _outcome(new_meta) != _outcome(old_meta):
        _write(out_dir / "meta.json", {**new_meta, "updatedAt": old_meta.get("updatedAt")})
    return False


def _site(meta_: dict) -> dict:
    return {k: v for k, v in meta_.items() if k not in ("updatedAt", "lastRun")}


def _outcome(meta_: dict) -> tuple:
    last = meta_.get("lastRun") or {}
    return last.get("ok"), last.get("errors")


def _read(path: Path) -> dict | None:
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None


def _write(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
