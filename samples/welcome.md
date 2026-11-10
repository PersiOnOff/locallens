# Welcome to LocalLens

LocalLens turns private documents into a searchable local knowledge workspace.

## Getting started

1. Add PDF, Markdown or UTF-8 text documents using Add documents.
2. Wait for the local embedding model to index the passages.
3. Ask a question and inspect the retrieved source passages.

## Where does my data go?

Documents, extracted text and embeddings stay in your local SQLite database.
Inference uses the configured Ollama service. Default Compose configuration disables
Ollama cloud features and does not publish the Ollama port.

Initial dependency, image and model downloads require an internet connection.

See the [sample policy](policy.md) for a simple question-answering example.
