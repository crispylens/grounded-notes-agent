# grounded-notes-agent

Local-first **RAG + agent** over your personal notes: index Markdown and plain-text files on disk, search with FAISS, and chat through a FastAPI app that calls `query_my_notes` as an agent tool.

## Features

- **Indexer** (`know_your_data/build_index.py`): recursive scan, chunking, embeddings via [AI Builders Space](https://space.ai-builders.com/) OpenAI-compatible API, FAISS index (`my_notes.index` + metadata JSON).
- **Retriever** (`rag/`): cosine search, optional folder scoping, corporate-promotion attitude supplement for premise-check scenarios.
- **Agent** (`main.py`): FastAPI `/chat` with `query_my_notes`, `web_search`, and `read_page`; system prompt tuned for note-grounded answers and premise checking.

## Requirements

- Python 3.11+
- API key for AI Builders Space (`AI_BUILDER_TOKEN` or `SUPER_MIND_API_KEY`)

## Setup

```bash
cd grounded-notes-agent
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
copy .env.example .env   # then edit .env
```

Set in `.env`:

- `AI_BUILDER_TOKEN=your_token_here`
- Optional: `NOTES_ROOT=/path/to/your/notes` (folder to index; override with `--root`)

## Build the index

```bash
python know_your_data/build_index.py --root /path/to/your/notes
```

Outputs in the repo root (gitignored): `my_notes.index`, `my_notes_meta.json`, `index_manifest.json`.

Smoke test retrieval:

```bash
python know_your_data/smoke_rag.py
```

## Run the server

```bash
uvicorn main:app --reload
```

Open http://127.0.0.1:8000 for the static chat UI, or http://127.0.0.1:8000/docs for the API.

## Project layout

| Path | Role |
|------|------|
| `main.py` | FastAPI app and agent loop |
| `rag/` | Chunking, config, FAISS retriever |
| `know_your_data/` | Indexer and smoke scripts (no private eval docs in git) |
| `static/` | Simple web chat |
| `frontend/` | Next.js app (optional) |

## Security

- Never commit `.env`, index files, or API keys.
- Index only data you are willing to send as embedding API requests (per chunk).

## License

Private personal project; adjust as needed.
