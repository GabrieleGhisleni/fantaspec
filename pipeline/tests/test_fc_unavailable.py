import pytest
from conftest import load_fixture

from fantaspec.clubs import by_key
from fantaspec.models import Unavailable
from fantaspec.sources.fc_unavailable import parse_unavailable


def test_unavailable_structure():
    items = parse_unavailable(load_fixture("fc_unavailable.html.gz"))
    assert {i.kind for i in items} <= {"injured", "suspended", "warned"}
    assert all(i.club in by_key() for i in items)
    assert not any(i.name.lower().startswith("nessun") for i in items)


def test_unavailable_values():
    items = parse_unavailable(load_fixture("fc_unavailable.html.gz"))
    assert Unavailable(
        "atalanta",
        "Kessiè",
        "injured",
        "L'ivoriano condizionato da una distrazione di basso grado al polpaccio della gamba destra, "
        "tentativo rientro da inizio novembre.",
    ) in items
    assert Unavailable("lecce", "Gaspar K.", "suspended", "squalificato nella 10a giornata di campionato") in items
    assert Unavailable("cagliari", "Deiola", "warned", "") in items
    assert len(items) == 87


def test_unavailable_rejects_unknown_markup():
    with pytest.raises(ValueError):
        parse_unavailable("<html><body><p>Pagina non trovata</p></body></html>")
    with pytest.raises(ValueError):
        parse_unavailable('<div class="card team-card"><span class="team-name">Pisa</span></div>')
