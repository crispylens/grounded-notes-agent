#!/usr/bin/env python3
"""Smoke checks for the notes RAG pipeline (no LLM chat)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from rag.chunking import load_markdown_chunks  # noqa: E402
from rag.notes_config import INDEX_FILENAME, META_FILENAME, get_docs_root, load_app_env  # noqa: E402

load_app_env()

from rag.notes_retriever import query_my_notes  # noqa: E402


def main() -> int:
    docs_root = get_docs_root()
    records = load_markdown_chunks(docs_root)
    file_count = len({r["file_path"] for r in records})
    print(f"[smoke] Markdown chunks under docs root: {len(records)} from {file_count} files")

    index_path = ROOT / INDEX_FILENAME
    meta_path = ROOT / META_FILENAME
    if not index_path.is_file() or not meta_path.is_file():
        print(
            "[smoke] Index not built yet. Run: python know_your_data/build_index.py "
            "(requires valid AI_BUILDER_TOKEN or SUPER_MIND_API_KEY)"
        )
        return 0 if records else 1

    for needle in ("anthony ephremides", "AE folder", "Japan travel"):
        result = query_my_notes(needle, top_k=3)
        hit_count = len(result.get("hits", []))
        err = result.get("error")
        print(f"[smoke] query={needle!r} hits={hit_count} error={err}")
        if hit_count:
            top = result["hits"][0]
            print(f"       top file={top['file_path']} score={top['score']:.4f}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
