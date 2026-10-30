from conftest import load_fixture

from fantaspec.sources.fc_votes import parse_votes


def test_votes_matchday_8():
    rows = parse_votes(load_fixture("fc_votes_8.html.gz"), 8)
    assert len(rows) == 316  # 305 in the spec missed the 11 players with accented slugs
    assert len({r.club for r in rows}) == 20
    meret = next(r for r in rows if r.player_id == 572)
    assert (meret.name, meret.club, meret.role, meret.vote, meret.fanta_vote, meret.conceded) == ("Meret", "napoli", "P", 6.5, 3.5, 3)
    bernardeschi = next(r for r in rows if r.player_id == 184)
    assert (bernardeschi.vote, bernardeschi.goals, bernardeschi.pens_scored) == (7.0, 0, 1)


def test_votes_accented_slug_and_senza_voto():
    rows = parse_votes(load_fixture("fc_votes_8.html.gz"), 8)
    assert {r.matchday for r in rows} == {8}
    soule = next(r for r in rows if r.player_id == 5734)  # href slug "soulè"
    assert (soule.name, soule.club) == ("Soulè", "roma")
    vitik = next(r for r in rows if r.player_id == 7068)  # data-value "55" = s.v.
    assert (vitik.vote, vitik.fanta_vote) == (None, None)
