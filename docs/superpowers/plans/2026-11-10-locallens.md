# LocalLens Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement task by task.

**Goal:** A local document RAG workspace with grounded streaming answers and repository graph.
**Architecture:** ASP.NET Core serves React and JSON/SSE endpoints; SQLite persists sources and vector chunks; a bounded worker indexes with Ollama. Search excludes incompatible embedding models.
**Tech Stack:** .NET 10, React, SQLite/Dapper, PdfPig, Microsoft.Extensions.AI, Ollama, Cytoscape.
**Spec:** docs/superpowers/specs/2026-11-10-local-knowledge-design.md

## Global Constraints
Local inference, no telemetry, localhost binding, source citations, MIT, document workflow first. Preserve existing scaffold and do not publish private documents.

## Review Focus
- Oversized or scanned files fail visibly without partial searchable content.
- Traversal and symlink paths cannot escape configured repository root.
- Model mismatch cannot mix vector spaces.
- Interrupted streams and unavailable Ollama produce visible errors.
- Restart recovers unfinished indexing and persisted data.

## Task 1: Search and storage
Files: Models.cs, TextProcessing.cs, KnowledgeStore.cs, tests/LocalLens.Tests.
Interfaces: Chunker.Split(string) -> text chunks with line ranges; VectorMath.Cosine(float[],float[]) -> double; Store sources and chunks transactionally.
- [x] Write and run failing tests for overlap, vector mismatch, ranking and path confinement.
- [x] Implement core; run complete test suite.

## Task 2: Ingestion and chat
Files: OllamaService.cs, IndexingWorker.cs, Program.cs, RepositoryScanner.cs.
Interfaces: document upload/list/delete/retry, repository import, graph, health, POST chat SSE (sources/token/done/error).
- [x] Add integration tests covering upload, source lookup, failure and stream behavior.
- [x] Implement PDF/text extraction, queued indexing, model-compatible retrieval and bounded chat history.
- [x] Verify using a deterministic local Ollama protocol fixture; separately attempt real models.

## Task 3: Workspace
Files: client/src/App.tsx, components, styles and API client.
- [x] Implement document library, upload/status/retry/delete, streaming chat with code highlighting and clickable evidence, graph and repository import.
- [x] Build and lint; inspect UI and verify main flow in browser.

## Task 4: Distribution
Files: Dockerfile, compose.yaml, .gitignore, .dockerignore, README.md, LICENSE, CI.
- [x] Configure persistent local services and initial model download; document resource limits and offline boundaries.
- [x] Run builds/tests/configuration checks and final review; fix material findings.
- [x] Prepare local Git repository; GitHub publication delegated back to the user at their explicit request.

## Execution ledger
Ruling: execute inline in existing project; no worktree because no existing Git repository. Authorized publication is part of original user request.

Ruling (2026-11-10): User will upload to GitHub themselves. Prepare local Git repository only; do not publish.
Ruling: Added light/dark themes per user request, with persistent choice and theme-aware graph/code blocks.


Validation: see docs/verification.md. Browser access was initially blocked. During the subsequent repository-launch task, the user explicitly approved local browser access and a real sample walkthrough was captured; the verification record distinguishes those sessions.
