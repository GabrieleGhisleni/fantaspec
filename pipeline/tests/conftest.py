import gzip
import json
from pathlib import Path

FIXTURES = Path(__file__).parent / "fixtures"


def load_fixture(name: str):
    """Read a saved page from tests/fixtures: .json -> dict, .html -> str, .html.gz -> str."""
    path = FIXTURES / name
    if name.endswith(".json"):
        return json.loads(path.read_text(encoding="utf-8"))
    if name.endswith(".html.gz"):
        return gzip.decompress(path.read_bytes()).decode("utf-8")
    if name.endswith(".html"):
        return path.read_text(encoding="utf-8")
    raise ValueError(f"unsupported fixture type: {name}")
