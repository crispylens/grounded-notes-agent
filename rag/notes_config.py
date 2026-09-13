import os
from pathlib import Path

from dotenv import dotenv_values, load_dotenv

BASE_URL = "https://space.ai-builders.com/backend/v1"
EMBEDDING_MODEL = "text-embedding-3-small"
DEFAULT_INDEX_ROOT = Path(__file__).resolve().parent.parent
INDEX_FILENAME = "my_notes.index"
META_FILENAME = "my_notes_meta.json"
MANIFEST_FILENAME = "index_manifest.json"

CHUNK_SIZE = 1000
CHUNK_OVERLAP = 180
EMBED_BATCH_SIZE = 64
DEFAULT_TOP_K = 5
HIT_TEXT_MAX_CHARS = 1500

SKIP_DIR_NAMES = frozenset(
    {".git", "node_modules", "__pycache__", ".venv", "venv", ".cursor"}
)

def get_docs_root() -> Path:
    env_root = os.getenv("NOTES_ROOT")
    if env_root:
        return Path(env_root)
    return DEFAULT_INDEX_ROOT

_API_KEY: str | None = None


def load_app_env() -> None:
    """Load env files; project root .env overrides frontend/.env.local."""
    load_dotenv(DEFAULT_INDEX_ROOT / "frontend" / ".env.local")
    load_dotenv(DEFAULT_INDEX_ROOT / ".env", override=True)


def get_api_key() -> str:
    """Prefer API keys from project root .env over frontend/.env.local."""
    global _API_KEY
    if _API_KEY is not None:
        return _API_KEY

    load_app_env()
    root_env = dotenv_values(DEFAULT_INDEX_ROOT / ".env")
    for name in ("AI_BUILDER_TOKEN", "SUPER_MIND_API_KEY"):
        value = root_env.get(name)
        if value and str(value).strip():
            _API_KEY = str(value).strip()
            return _API_KEY

    api_key = os.getenv("AI_BUILDER_TOKEN") or os.getenv("SUPER_MIND_API_KEY")
    if not api_key:
        raise RuntimeError(
            "Set AI_BUILDER_TOKEN or SUPER_MIND_API_KEY in the project root .env "
            "(recommended) or in the environment."
        )
    _API_KEY = api_key.strip()
    return _API_KEY


def index_paths(out_dir: Path | None = None) -> tuple[Path, Path]:
    root = out_dir or DEFAULT_INDEX_ROOT
    return root / INDEX_FILENAME, root / META_FILENAME
