from conftest import load_fixture

from fantaspec.models import CalendarFixture
from fantaspec.sources.fc_calendar import parse_calendar


def test_calendar_matchday_10():
    fx = parse_calendar(load_fixture("fc_calendar_10.html.gz"), 10)
    assert len(fx) == 10
    assert CalendarFixture(10, "juventus", "napoli") in fx
    assert CalendarFixture(10, "milan", "inter") in fx
