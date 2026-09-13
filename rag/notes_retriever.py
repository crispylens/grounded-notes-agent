from __future__ import annotations

import json
from functools import lru_cache
from typing import Any

import faiss
import numpy as np
from openai import OpenAI

import re

from rag.notes_config import (
    BASE_URL,
    DEFAULT_TOP_K,
    EMBEDDING_MODEL,
    HIT_TEXT_MAX_CHARS,
    META_FILENAME,
    get_api_key,
    index_paths,
)

# Merged only for corporate/promotion-style queries (see 问题.md #4), not every new interest.
_ATTITUDE_SUPPLEMENT_QUERY = (
    "corporate job promotion cage trap side business personal goal freedom "
    "disinterest in climbing the ladder 牢笼 副业 猫鼠游戏"
)
_CORPORATE_PROMOTION_PATTERN = re.compile(
    r"promot|promo\b|perf\b|calibrat|ladder|\bl[3456]\b|\bt[3456]\b|"
    r"升职|加薪|晋升|绩效|校准|"
    r"google|gmail|corporate|大厂|"
    r"升职加薪|争取升职|公司.*升职|升职.*公司",
    re.IGNORECASE,
)


def _needs_attitude_supplement(query: str) -> bool:
    return bool(_CORPORATE_PROMOTION_PATTERN.search(query))


def _normalize_folder_prefix(folder_path: str | None) -> str | None:
    if not folder_path:
        return None
    cleaned = folder_path.strip().replace("\\", "/").strip("/")
    if not cleaned:
        return None
    return f"{cleaned}/"


def _folder_prefix_from_query(query: str) -> str | None:
    if re.search(r"/AE\b|\\AE\\|\bAE/", query, re.IGNORECASE):
        return "AE/"
    if re.search(r"\bAE\b", query, re.IGNORECASE) and re.search(
        r"folder|FOLDER|文件夹|目录", query, re.IGNORECASE
    ):
        return "AE/"
    return None


def resolve_folder_prefix(query: str, folder_path: str | None = None) -> str | None:
    return _normalize_folder_prefix(folder_path) or _folder_prefix_from_query(query)


def _filter_hits_by_folder(hits: list[dict], folder_prefix: str) -> list[dict]:
    prefix = folder_prefix.replace("\\", "/")
    if not prefix.endswith("/"):
        prefix += "/"
    return [hit for hit in hits if hit["file_path"].replace("\\", "/").startswith(prefix)]


def _normalize(vectors: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    norms = np.maximum(norms, 1e-12)
    return vectors / norms


def embed_texts(client: OpenAI, texts: list[str]) -> np.ndarray:
    response = client.embeddings.create(model=EMBEDDING_MODEL, input=texts)
    ordered = sorted(response.data, key=lambda item: item.index)
    vectors = np.array([item.embedding for item in ordered], dtype=np.float32)
    return _normalize(vectors)


class NotesRetriever:
    def __init__(self, index_dir=None) -> None:
        index_path, meta_path = index_paths(index_dir)
        if not index_path.is_file():
            raise FileNotFoundError(f"Missing FAISS index: {index_path}")
        if not meta_path.is_file():
            raise FileNotFoundError(f"Missing index metadata: {meta_path}")

        self._index = faiss.read_index(str(index_path))
        with meta_path.open(encoding="utf-8") as handle:
            payload = json.load(handle)
        self._chunks: list[dict] = payload["chunks"]
        self._model = payload.get("embedding_model", EMBEDDING_MODEL)
        self._client = OpenAI(api_key=get_api_key(), base_url=BASE_URL)

    def _search(self, query: str, top_k: int) -> list[dict]:
        k = min(max(top_k, 1), len(self._chunks))
        query_vec = embed_texts(self._client, [query])
        scores, indices = self._index.search(query_vec, k)

        hits: list[dict] = []
        for score, idx in zip(scores[0].tolist(), indices[0].tolist(), strict=True):
            if idx < 0:
                continue
            chunk = self._chunks[idx]
            text = chunk["text"]
            if len(text) > HIT_TEXT_MAX_CHARS:
                text = text[:HIT_TEXT_MAX_CHARS] + "..."
            hits.append(
                {
                    "file_path": chunk["file_path"],
                    "chunk_index": chunk["chunk_index"],
                    "score": float(score),
                    "text": text,
                }
            )
        return hits

    @staticmethod
    def _merge_hits(primary: list[dict], extra: list[dict], top_k: int) -> list[dict]:
        by_key: dict[tuple[str, int], dict] = {}
        for hit in primary + extra:
            key = (hit["file_path"], hit["chunk_index"])
            existing = by_key.get(key)
            if existing is None or hit["score"] > existing["score"]:
                by_key[key] = hit
        merged = sorted(by_key.values(), key=lambda item: item["score"], reverse=True)
        return merged[:top_k]

    def query(
        self,
        query: str,
        top_k: int = DEFAULT_TOP_K,
        folder_path: str | None = None,
    ) -> dict[str, Any]:
        query = query.strip()
        if not query:
            return {"query": query, "hits": [], "error": "Empty query"}

        k = min(max(top_k, 1), len(self._chunks))
        folder_prefix = resolve_folder_prefix(query, folder_path)
        search_k = min(len(self._chunks), max(k * 10, 50)) if folder_prefix else k
        hits = self._search(query, search_k)

        supplement_query: str | None = None
        if folder_prefix is None and _needs_attitude_supplement(query):
            supplement_query = _ATTITUDE_SUPPLEMENT_QUERY
            extra = self._search(supplement_query, min(3, k))
            hits = self._merge_hits(hits, extra, search_k)

        result: dict[str, Any] = {"query": query, "top_k": k, "hits": hits}
        if supplement_query:
            result["attitude_supplement_query"] = supplement_query

        if folder_prefix:
            result["folder_filter"] = folder_prefix
            scoped = _filter_hits_by_folder(hits, folder_prefix)
            result["hits"] = scoped[:k]
            if not scoped:
                result["folder_miss"] = True
                result["note"] = (
                    f"No indexed chunks under {folder_prefix} matched this query. "
                    "Re-run build_index if files were added recently."
                )
        else:
            result["hits"] = hits[:k]

        return result


@lru_cache(maxsize=1)
def get_notes_retriever() -> NotesRetriever:
    return NotesRetriever()


def query_my_notes(
    query: str,
    top_k: int = DEFAULT_TOP_K,
    folder_path: str | None = None,
) -> dict[str, Any]:
    try:
        return get_notes_retriever().query(
            query, top_k=top_k, folder_path=folder_path
        )
    except FileNotFoundError as exc:
        return {"query": query, "hits": [], "error": str(exc)}
    except RuntimeError as exc:
        return {"query": query, "hits": [], "error": str(exc)}
