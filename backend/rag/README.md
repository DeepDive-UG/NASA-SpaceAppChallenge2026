# Local CropTips knowledge assistant

The reusable `MascotChat` dialog calls `POST /api/chat/`. Each question is independent: no chat history, saved conversation or user profile is sent to the model. Retrieval and generation run locally, with a per-process generation limit and Django CSRF protection. No OpenAI key or cloud model is used.

## Models and storage

- Answer model: Ollama `ministral-3:3b`.
- Embeddings: Ollama `embeddinggemma`, using distinct query/document prefixes.
- Retrieval: normalized vector similarity plus SQLite FTS5 BM25 with reciprocal-rank fusion. Exact common/scientific crop aliases receive priority. Chat requests retrieve up to three excerpts with at most two per source/title. Generation omits long alias lists, caps each excerpt at 1,800 characters and limits output to 320 tokens. Ollama keeps the answer model loaded for 15 minutes; CPU response time still depends on hardware.
- Generated index: `backend/.rag/index.sqlite3` (ignored by Git). Override with `RAG_INDEX_PATH`.
- Local runtime and downloaded weights on this machine: `/home/martinez/CropTips-data/runtime/` (outside Git).

Ollama installation and model references: https://docs.ollama.com/linux, https://ollama.com/library/ministral-3:3b, https://ollama.com/library/embeddinggemma. The embedding model requires Ollama 0.11.10 or newer. Model licences are supplied by their distributors; downloading weights is not training a new model.

## Start

Install Ollama on another machine using its official instructions. For the portable installation on this machine, run:

```bash
OLLAMA_HOST=127.0.0.1:11434 \
OLLAMA_NO_CLOUD=1 \
OLLAMA_MODELS=/home/martinez/CropTips-data/runtime/models \
/home/martinez/CropTips-data/runtime/ollama/bin/ollama serve
```

With the server running, prepare the backend from the repository root:

```bash
backend/.venv/bin/pip install -r backend/requirements.txt
/home/martinez/CropTips-data/runtime/ollama/bin/ollama pull ministral-3:3b
/home/martinez/CropTips-data/runtime/ollama/bin/ollama pull embeddinggemma
backend/.venv/bin/python backend/manage.py build_rag_index
backend/.venv/bin/python backend/manage.py runserver
```

Start the frontend with `npm run dev` in `frontend`. Its `/api` proxy targets Django on port 8000. The dialog bootstraps its CSRF cookie through `/api/health/`; do not exempt the chat endpoint from CSRF checks. Development origins on port 5173 are trusted only in DEBUG mode; configure `DJANGO_CSRF_TRUSTED_ORIGINS` for deployment.

`--lexical-only` builds a diagnostic FTS index without embeddings. Answers still require the chat model. It is useful for ingestion/retrieval tests and must not be described as a tested semantic index. Rebuilding writes a temporary database and atomically replaces the previous index only when complete. Do not run concurrent builds to the same output path.

## Adding knowledge

The builder reads CSV files recursively under `/data`, plus JSON, UTF-8 TXT and Markdown under `/data/knowledge`. It never downloads arbitrary URLs during indexing. PDF files require text extraction and source review before import; scanned pages require OCR. Do not put raw NASA rasters or station archives into the text corpus.

Each CSV row is a source record, with its original file, starting line, SHA-256 and encoding. EcoCrop uses CP1252 on this machine; the other initial CSVs are UTF-8. Long records are split with overlap without crossing record boundaries. Missing values remain unknown. Known EcoCrop columns have explicit temperature, annual rainfall and pH labels; unmapped columns retain their original names. The two Dryad files retain raw column names and do not acquire invented experimental units.

For reviewed source summaries, create `data/knowledge/name.json`:

```json
{
  "url": "https://authoritative-source.example/document",
  "reviewed_on": "2026-11-14",
  "sections": [
    {"title": "Specific topic and geographic scope", "text": "Reviewed factual summary preserving units, limitations and dates."}
  ]
}
```

The initial five summaries cover crop rotation, frost, irrigation, California planting time and EcoCrop field interpretation. They are short reviewed summaries, not complete copies of the linked publications. Additional crop-specific commercial guidance, California regional planting calendars and validated seedling frost tolerances are still needed. The original EcoCrop file's full upstream version/licence has not been verified; its field interpretation uses the linked CGIAR catalogue. Dryad DOI attribution comes from the existing data README.

After adding, changing or deleting a source, run `build_rag_index` again. Runtime compares source hashes and refuses a stale index. It also rejects an embedding model/dimension mismatch. For a deployment, pin model weights/digests and review corpus licences before redistributing source material.

## Answer contract

Request: `{"message": "What temperatures does okra prefer?"}`. The endpoint rejects any `history` field, oversized input and concurrent generation in the same Django process. User identity and distributed quotas are not implemented here.

Responses contain `answer`, `sources`, `insufficient_evidence`, model name and index timestamp. Sources include inline reference labels, source file/line, URL, source SHA-256 and retrieved excerpt. Output with nonexistent or inconsistent citation labels is rejected. This checks reference integrity; it does not prove every generated claim is entailed by a source. The UI displays evidence gaps and lets users inspect excerpts. Model prose is rendered as text, not executable HTML.

The assistant must not turn annual rainfall into a 100-day irrigation prescription, research replicates into universal recommendations, or ecological temperature limits into seedling frost guarantees. It should request missing crop, location and history information when sources are insufficient. Retrieved content is data, not instructions.

Current alerts, field water observations and saved ML forecasts are deliberately absent from this static corpus. The existing environment endpoints remain their source of truth. The chatbot must not claim to have fetched those readings; a later live-tool integration should provide timestamps, field/station identity and model limitations explicitly.

## Checks

```bash
backend/.venv/bin/python backend/manage.py test rag api
cd frontend
npm run build
```

These tests cover encoding, row attribution, exact crop retrieval, stale-source refusal, citation validation, stateless request validation, CSRF and provider failure. They do not substitute for evaluating real generated answers against agricultural references.

## Mascot integration

`frontend/src/components/MascotChat.jsx` owns the mascot button and existing chat panel. Mount `<MascotChat />` once per page. Clicking the mascot opens the panel; Close or Escape unmounts it and aborts the browser request. Each submission sends only `{"message": "..."}` to `/api/chat/`. No conversation is persisted or sent as history. Source links and retrieved excerpts are available below each answer.

## Additional California references

The reviewed summaries `california_cover_crops.json` and `california_planting_scope.json` retain source URLs and review dates. They cover UC ANR Agronomy Fact Sheet 22 (2024) and the UC Master Gardener regional planting guide. The planting guide is gardening guidance for broad regions, not a farm-specific commercial schedule. Original publications remain available through the URLs in these files. The index reuses unchanged document vectors when rebuilt with the same embedding model.

## Portable setup

On any machine with Ollama installed, run `ollama serve`, then in another terminal:

```bash
ollama pull ministral-3:3b
ollama pull embeddinggemma
python backend/manage.py build_rag_index
python backend/manage.py runserver
```

Use the project's Python virtual environment with `backend/requirements.txt` installed. Optional environment variables are `OLLAMA_BASE_URL` (local server only), `RAG_CHAT_MODEL`, `RAG_EMBED_MODEL`, and `RAG_INDEX_PATH`. The repository contains code and reviewed knowledge; model weights and the generated index stay outside Git. Every deployment builds its own index from the repository's data directory.
