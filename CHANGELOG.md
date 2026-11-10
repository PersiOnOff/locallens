# Changelog

## [Unreleased]

Prepared for the initial `v0.1.0` release.

### Added

- Private PDF, Markdown, UTF-8 text and source-code ingestion.
- SQLite-backed documents, overlapping text chunks and local Ollama embeddings.
- Streaming RAG chat with retrieved passages, source citations and code highlighting.
- Document selection, indexing progress, retry, source preview and deletion.
- Read-only local repository imports and a graph of resolved relative links/imports.
- Light and dark themes with a saved browser preference.
- Docker Compose startup, persistent volumes, fictional samples and automated checks.

### Initial boundaries

Single-user localhost deployment without authentication. No OCR, remote repository
cloning, autonomous tools or cloud inference by default. Exact vector retrieval is
intended for small personal libraries. Citations require human verification.

See [README](README.md#supported-inputs-and-limits) for supported formats, resource
requirements and limits. Release publication is tracked on
[GitHub Releases](https://github.com/PersiOnOff/locallens/releases).
