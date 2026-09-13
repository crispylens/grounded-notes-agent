#!/usr/bin/env python3
"""Build my_notes.index from Markdown under a local folder."""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import faiss
import numpy as np
from openai import OpenAI

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from rag.chunking import load_markdown_chunks  # noqa: E402
from rag.notes_config import (  # noqa: E402
    BASE_URL,
    get_docs_root,
    DEFAULT_INDEX_ROOT,
    EMBED_BATCH_SIZE,
    EMBEDDING_MODEL,
    INDEX_FILENAME,
    MANIFEST_FILENAME,
    META_FILENAME,
    get_api_key,
    load_app_env,
)
from rag.notes_retriever import embed_texts  # noqa: E402


def embed_all(client: OpenAI, texts: list[str], batch_size: int) -> np.ndarray:
    vectors: list[np.ndarray] = []
    total = len(texts)
    for start in range(0, total, batch_size):
        batch = texts[start : start + batch_size]
        for attempt in range(3):
            try:
                vectors.append(embed_texts(client, batch))
                break
            except Exception as exc:  # noqa: BLE001
                if attempt == 2:
                    raise
                wait = 2**attempt
                print(f"[Indexer] Embed retry in {wait}s: {exc}", flush=True)
                time.sleep(wait)
        done = min(start + batch_size, total)
        print(f"[Indexer] Embedded {done}/{total} chunks", flush=True)
    return np.vstack(vectors)


def main() -> int:
    load_app_env()

    parser = argparse.ArgumentParser(description="Index local Markdown notes into FAISS.")
    parser.add_argument("--root", type=Path, default=None, help="Folder to scan")
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=DEFAULT_INDEX_ROOT,
        help="Directory for my_notes.index and metadata",
    )
    parser.add_argument("--batch-size", type=int, default=EMBED_BATCH_SIZE)
    args = parser.parse_args()

    docs_root = (args.root or get_docs_root()).resolve()
    out_dir = args.out_dir.resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    if not docs_root.is_dir():
        print(f"[Indexer] Not a directory: {docs_root}", flush=True)
        return 1

    print(f"[Indexer] Scanning {docs_root}", flush=True)
    records = load_markdown_chunks(docs_root)
    if not records:
        print("[Indexer] No Markdown chunks found.", flush=True)
        return 1

    texts = [r["text"] for r in records]
    client = OpenAI(api_key=get_api_key(), base_url=BASE_URL)
    matrix = embed_all(client, texts, args.batch_size)

    index = faiss.IndexFlatIP(matrix.shape[1])
    index.add(matrix)

    index_path = out_dir / INDEX_FILENAME
    meta_path = out_dir / META_FILENAME
    manifest_path = out_dir / MANIFEST_FILENAME

    faiss.write_index(index, str(index_path))
    meta_payload = {
        "embedding_model": EMBEDDING_MODEL,
        "dimension": matrix.shape[1],
        "docs_root": str(docs_root),
        "chunk_count": len(records),
        "chunks": records,
    }
    meta_path.write_text(json.dumps(meta_payload, ensure_ascii=False), encoding="utf-8")

    file_count = len({r["file_path"] for r in records})
    manifest = {
        "built_at": datetime.now(timezone.utc).isoformat(),
        "docs_root": str(docs_root),
        "file_count": file_count,
        "chunk_count": len(records),
        "embedding_model": EMBEDDING_MODEL,
        "index_path": str(index_path),
    }
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    print(
        f"[Indexer] Done: {file_count} files, {len(records)} chunks -> {index_path}",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
