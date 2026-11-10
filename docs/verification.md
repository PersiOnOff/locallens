# Local verification — 2026-11-10

- .NET build: passed, zero warnings/errors.
- Core console suite: 4 checks passed (chunking, vectors, path rules, SQLite persistence/model isolation/metadata projection).
- API integration: passed using real ASP.NET/SQLite and a deterministic external Ollama protocol fixture; includes PDF page citations, upload validation, cross-origin rejection, streaming, failure/retry, imports and graph.
- Frontend stream tests: 3 passed, including split UTF-8 and truncated responses.
- Frontend TypeScript/production build and oxlint: passed.
- Docker Compose configuration and production image build: passed.
- Actual Docker startup: passed, app runs as uid 1654, web port bound to 127.0.0.1:8080.
- Real Ollama models: qwen2.5:3b and nomic-embed-text downloaded and ready.
- Real-model end-to-end check: fictional refund policy uploaded and embedded; answer returned "A standard customer can request a refund within 30 days after purchase. [1]" with retrieved source; generation request 5.9 seconds on this machine.
- Final production HTML includes pre-paint theme initialization. Light/dark styles, code highlighting and graph palette reviewed by source inspection.
- Visual browser QA was not performed: browser access was declined by the approval gate. No screenshot or visual-accuracy claim is made.
- Independent code review: important metadata memory issue fixed and regression-checked; no remaining Critical/Important source finding established.
- GitHub publication: user chose to upload independently. No remote repository was created or pushed by the agent.

These checks establish the tested paths, not comprehensive model accuracy or production readiness for public deployment. See README for local single-user boundaries and known limitations.
