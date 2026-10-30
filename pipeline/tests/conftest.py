import gzip
import json
from pathlib import Path

import pytest

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


@pytest.fixture
def tmp_repo(tmp_path, monkeypatch):
    """A repo in tmp_path: config.RAW_DIR is tmp_path/raw and config.OUT_DIR is tmp_path/out."""
    from fantaspec import config

    monkeypatch.setattr(config, "RAW_DIR", tmp_path / "raw")
    monkeypatch.setattr(config, "OUT_DIR", tmp_path / "out")
    return tmp_path
