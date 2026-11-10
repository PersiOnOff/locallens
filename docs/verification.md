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
- Final production HTML includes pre-paint theme initialization. Light/dark styles, code highlighting and graph palette were initially reviewed by source inspection.
- Browser access was initially declined. Later on 2026-11-10, the user explicitly approved opening the local app and recording fictional samples. Actual browser checks covered document upload, indexed status, a real model answer, citation/source preview, switching themes and the two-file graph. Captures are in `docs/media/`; no browser console errors were observed in that session. This was not a comprehensive accessibility or multi-device test.
- Independent code review: important metadata memory issue fixed and regression-checked; no remaining Critical/Important source finding established.
- GitHub publication: user chose to upload independently. No remote repository was created or pushed by the agent.

These checks establish the tested paths, not comprehensive model accuracy or production readiness for public deployment. See README for local single-user boundaries and known limitations.

## Repository launch package

- Existing public GitHub `CI` run on the original `main` commit was confirmed successful before adding this package. The badge uses live workflow status; it does not assert that unpushed changes have run in GitHub Actions.
- Issue-form YAML structure and local Markdown file targets checked.
- Social-preview PNG: 1280 × 640, opaque, under 1 MB.
- Demo GIF: 10 captured keyframes, 21.2 seconds, all frames decoded successfully. Timing is editorial rather than a performance measurement.
- Independent packaging review identified the stale browser-verification statement above; it was updated to reflect the subsequent approved session.
- No application source changed for the launch package. No announcements, GitHub issues, release or repository settings were published automatically.
