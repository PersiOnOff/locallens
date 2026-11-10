# Local knowledge workspace

Date: 2026-11-10

## Intent
Build a self-hosted knowledge application for private documents. The primary user uploads PDF, Markdown and text documents, waits for indexing, and asks questions grounded in those documents. Local repository understanding is a secondary feature. Publish the finished source on GitHub through the browser.

## Accepted requirements
ASP.NET Core API, React client, SQLite documents/chunks/embeddings, Ollama local models, streamed RAG answers with citations, code highlighting, file relationship graph, Docker Compose, README and LICENSE, build and local verification.

## Proposed implementation decisions
Working name: LocalLens. Retain .NET 10 and existing React/Vite scaffold. Use English product UI and README for an international open-source audience. MIT license. All document processing and inference stay within the local deployment. Internet is required initially to obtain packages, container images and model weights.

One browser workspace provides document upload, collection/library list, indexing progress, chat, clickable source citations and a source preview. A graph tab exposes links between indexed files. Empty and failure states explain the next action; unavailable Ollama must never appear as a successful response.

Store source content, metadata, chunk offsets, embedding model identity and embeddings in SQLite. Run bounded background indexing with per-document progress and errors. Chunk with overlap, preserve source/page metadata, use local Ollama embeddings, rank chunks by cosine similarity, and stream model output with source metadata. Never claim a quote is verified merely because a model emitted a citation marker. Show retrieved evidence separately.

Support PDF text extraction (not OCR), Markdown, plain text and common source-code files. Exclude binary files, build directories, VCS metadata and likely secret files during repository indexing. Resolve graph links conservatively from relative imports and Markdown links. Uploaded files are stored under generated identifiers rather than user-controlled paths. Repository indexing is restricted to a configured root mounted read-only in Compose.

Compose starts the application, Ollama and a model initialization job; models and SQLite persist in volumes. Bind the web port to localhost by default. No cloud providers, telemetry, automatic code execution or remote repository cloning are in the initial scope. Scanned PDFs without text receive an actionable error. Large libraries use bounded document sizes and chunk counts, with limits documented. Exact vector search is appropriate for this initial single-user SQLite application.

## Acceptance
A clean frontend and backend build succeeds. Focused tests prove chunking, vector ranking, path confinement, source retrieval and failure handling. Local smoke verification covers upload, indexing status, chat streaming, citations and graph API; real Ollama end-to-end validation is performed if the environment supports it, otherwise reported explicitly. Docker configuration is validated if a working daemon is available. README documents models, hardware, initial download, privacy boundaries, supported formats, limitations and startup. GitHub publication contains source only, with no private indexed content, build outputs or credentials.

## Builder discretion
Choose concrete model defaults suitable for CPU machines, exact component layout, package APIs, incremental indexing details, and test tooling after inspecting installed dependencies. Preserve the primary document workflow when making tradeoffs.
