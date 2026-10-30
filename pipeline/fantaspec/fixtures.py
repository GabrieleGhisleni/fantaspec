from fantaspec.models import CalendarFixture, Club, EspnMatch, Fixture


def join_fixtures(calendar: list[CalendarFixture], espn: list[EspnMatch], clubs: list[Club]) -> list[Fixture]:
    """Every calendar fixture, in calendar order, with its kickoff and score from ESPN.

    The two sources are joined on the ordered pair (home, away), which is unique in a season.
    A fixture ESPN doesn't list keeps no kickoff and is not completed; ESPN matches outside the
    calendar or against a club not in `clubs` are ignored.
    """
    key_of = {c.espn_id: c.key for c in clubs}
    by_pair = {(key_of.get(m.home_espn), key_of.get(m.away_espn)): m for m in espn}
    out = []
    for c in calendar:
        m = by_pair.get((c.home, c.away))
        if m is None:
            out.append(Fixture(c.matchday, c.home, c.away, None, None, None, False))
        else:
            out.append(Fixture(c.matchday, c.home, c.away, m.kickoff, m.home_goals, m.away_goals, m.completed))
    return out
