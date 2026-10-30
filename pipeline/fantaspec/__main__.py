"""CLI: `python -m fantaspec gate` and `python -m fantaspec run --kind <light|full> [--backfill]`."""
import argparse
import os
import sys
import time
from datetime import datetime

from fantaspec.config import TZ
from fantaspec.http import fetch_text
from fantaspec.run import Fetcher, gate, run
from fantaspec.schedule import FULL, LIGHT

FC_PAUSE = 1.0  # seconds before each fantacalcio.it request


def polite(fetch: Fetcher) -> Fetcher:
    """`fetch`, pausing before each fantacalcio.it request."""
    def fetch_politely(url: str) -> str:
        if "fantacalcio.it" in url:
            time.sleep(FC_PAUSE)
        return fetch(url)
    return fetch_politely


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="fantaspec")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("gate", help="print kind=<light|full|skip> and slot=<ISO time> for this hour")
    run_parser = commands.add_parser("run", help="fetch, compute and write the site data")
    run_parser.add_argument("--kind", choices=[LIGHT, FULL], required=True)
    run_parser.add_argument("--backfill", action="store_true",
                            help="also every calendar page, every played matchday's votes and past seasons")
    args = parser.parse_args(argv)
    now = datetime.now(TZ)

    if args.command == "gate":
        kind, slot = gate(now)
        lines = f"kind={kind}\nslot={slot}\n"
        print(lines, end="")
        if os.environ.get("GITHUB_OUTPUT"):
            with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as out:
                out.write(lines)
        return 0

    if args.backfill and args.kind != FULL:
        run_parser.error("--backfill needs --kind full")
    result = run(args.kind, polite(fetch_text), now, backfill=args.backfill)
    for error in result.errors:
        print(error, file=sys.stderr)
    print(f"ok={str(result.ok).lower()} wrote={str(result.wrote).lower()} errors={len(result.errors)}")
    return 0 if result.valid else 1


if __name__ == "__main__":
    sys.exit(main())
