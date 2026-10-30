from pathlib import Path
from zoneinfo import ZoneInfo

SEASON = "2026-27"
ESPN_SEASON = 2026
TZ = ZoneInfo("Europe/Rome")
H2H_SEASONS = 10

REPO_ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = REPO_ROOT / "raw"
OUT_DIR = REPO_ROOT / "web/public/data"

_ESPN_SITE = "https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1"
_ESPN_STANDINGS = "https://site.api.espn.com/apis/v2/sports/soccer/ita.1/standings"
_FC = "https://www.fantacalcio.it"


def espn_teams_url() -> str:
    return f"{_ESPN_SITE}/teams"


def espn_schedule_url(espn_id: int, season: int) -> str:
    return f"{_ESPN_SITE}/teams/{espn_id}/schedule?season={season}"


def espn_fixtures_url(espn_id: int) -> str:
    return f"{_ESPN_SITE}/teams/{espn_id}/schedule?fixture=true"


def espn_standings_url() -> str:
    return _ESPN_STANDINGS


def fc_votes_url(matchday: int) -> str:
    return f"{_FC}/voti-fantacalcio-serie-a/{SEASON}/{matchday}"


def fc_roster_url() -> str:
    return f"{_FC}/quotazioni-fantacalcio"


def fc_calendar_url(matchday: int) -> str:
    return f"{_FC}/serie-a/calendario/{matchday}"


def fc_lineups_url() -> str:
    return f"{_FC}/probabili-formazioni-serie-a"


def fc_unavailable_url() -> str:
    return f"{_FC}/indisponibili-serie-a"
