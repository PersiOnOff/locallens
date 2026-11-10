# Contributing to LocalLens

Thanks for helping make private knowledge a little easier to explore.

Small, focused contributions are welcome: clearer setup instructions, accessibility
improvements, reproducible bug reports and tests for real edge cases all help.

## Before you start

- Search existing issues before opening a new one.
- For a new feature or a significant behavior change, open a feature request first.
- Explain the user scenario and the smallest useful outcome. A large framework or
  dependency is rarely necessary for a small improvement.
- Never attach private documents, credentials, database files or model weights.
  Use a tiny fictional document that reproduces the problem.

## Run locally

Use .NET 10, Node.js 24 and local Ollama. See [README](README.md#local-development)
for model downloads and the two development terminals. Docker Compose is the
easiest way to try the complete application.

```sh
dotnet run --project src/SelfHostedAi.Api
```

```sh
cd client
npm ci
npm run dev
```

## Before opening a pull request

Run the checks relevant to your change:

```sh
dotnet build SelfHostedAi.slnx
dotnet run --project tests/LocalLens.Tests
python tests/smoke.py
npm --prefix client ci
npm --prefix client test
npm --prefix client run lint
npm --prefix client run build
docker compose config --quiet
```

The console suite is run with `dotnet run`, not `dotnet test`. The Python smoke
suite uses the real API and SQLite with a local Ollama protocol fixture; it does
not download models. Python 3.12+ is required. A real-model check is available as
`python tests/real_smoke.py` when the Docker stack and models are ready; it leaves
a fictional sample in the local library.

For behavior changes, include a regression test that would catch the failure.
For UI changes, include screenshots of both themes and check keyboard navigation
and a narrow window. Documentation-only changes do not need application tests.

## Keep the local promise

- Do not add telemetry, cloud inference or remote assets as a hidden default.
- Treat uploaded documents as untrusted input.
- Keep repository imports inside the configured root and skip symlinks.
- Do not mix embedding spaces or turn retrieval similarity into a confidence claim.
- Keep the one-command Docker workflow working.

Describe what changed, why it helps and how you checked it. Keep unrelated cleanup
in a separate pull request. The project uses the [MIT license](LICENSE).
