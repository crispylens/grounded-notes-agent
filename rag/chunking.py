from pathlib import Path

from rag.notes_config import CHUNK_OVERLAP, CHUNK_SIZE


def should_skip_path(path: Path) -> bool:
    from rag.notes_config import SKIP_DIR_NAMES

    return any(part in SKIP_DIR_NAMES for part in path.parts)


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    text = text.strip()
    if not text:
        return []
    if len(text) <= chunk_size:
        return [text]

    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        if end >= len(text):
            break
        start = end - overlap
    return chunks


DOCUMENT_GLOBS = ("*.md", "*.txt")


def load_markdown_chunks(root: Path) -> list[dict]:
    """Return chunk records from Markdown and plain-text notes under root."""
    records: list[dict] = []
    root = root.resolve()

    paths: list[Path] = []
    for pattern in DOCUMENT_GLOBS:
        paths.extend(root.rglob(pattern))
    for path in sorted(set(paths)):
        if should_skip_path(path.relative_to(root)):
            continue
        try:
            raw = path.read_text(encoding="utf-8", errors="replace")
        except OSError as exc:
            print(f"[Indexer] Skip unreadable {path}: {exc}", flush=True)
            continue

        rel = path.relative_to(root).as_posix()
        for idx, piece in enumerate(chunk_text(raw)):
            prefixed = f"file: {rel}\n\n{piece}"
            records.append(
                {
                    "file_path": rel,
                    "chunk_index": idx,
                    "text": prefixed,
                }
            )
    return records
