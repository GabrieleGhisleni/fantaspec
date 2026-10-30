from fantaspec.models import CalendarFixture, Club, EspnMatch, Fixture


def join_fixtures(calendar: list[CalendarFixture], espn: list[EspnMatch], clubs: list[Club]) -> list[Fixture]:
    """Every calendar fixture, in calendar order, with its kickoff and score from ESPN.

    The two sources are joined on the ordered pair (home, away), which is unique in a season.
    A fixture ESPN doesn't list keeps no kickoff and is not completed; ESPN matches outside the
    calendar or against a club not in `clubs` are ignored. When ESPN lists a match more than once
    (both clubs' schedules), the last copy wins, except that a completed copy always beats one that
    isn't (a stale copy from a page fetched before the match).
    """
    key_of = {c.espn_id: c.key for c in clubs}
    by_pair: dict[tuple[str | None, str | None], EspnMatch] = {}
    for m in espn:
        pair = (key_of.get(m.home_espn), key_of.get(m.away_espn))
        if m.completed or not (pair in by_pair and by_pair[pair].completed):
            by_pair[pair] = m
    out = []
    for c in calendar:
        m = by_pair.get((c.home, c.away))
        if m is None:
            out.append(Fixture(c.matchday, c.home, c.away, None, None, None, False))
        else:
            out.append(Fixture(c.matchday, c.home, c.away, m.kickoff, m.home_goals, m.away_goals, m.completed))
    return out
