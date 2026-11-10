# Launch copy

Prepared copy only. Nothing has been posted to a community or social account.
Use the real demo, describe current limits and follow the destination's rules.

## Short post

I built **LocalLens**, a self-hosted workspace for private documents and code.

Upload a PDF or a few notes, ask a question, then open the exact passage behind
the answer. Embeddings and chat run through local Ollama models; SQLite stores
the library. There's also a file graph and light/dark themes.

Built with ASP.NET Core + React. Starts with `docker compose up --build`.
The first run downloads the models. Initial release: single-user localhost,
extractable-text PDFs, no OCR, no cloud inference configured.

Source: https://github.com/PersiOnOff/locallens

I'd especially welcome feedback on the document-to-answer workflow and source
citations. Please use fictional examples when reporting a problem.

## Show HN title

Show HN: LocalLens — Self-hosted document chat with local models and source citations

## Longer introduction

I wanted a small document workspace where I could keep the source material on my
own machine and inspect the passages behind an AI answer.

LocalLens combines PDF/Markdown/text ingestion, local Ollama embeddings, SQLite
storage and a streaming chat. Sources open beside the answer, with PDF page or
text line references. A secondary workflow imports a local repository and shows
relative imports and Markdown links as a graph.

The stack is .NET 10, React and Microsoft.Extensions.AI/OllamaSharp. Docker Compose
starts the app and Ollama, then downloads the default models. Both themes use the
same quiet paper/sage visual direction.

It's an initial personal-library tool, not a replacement for every RAG stack:
there's no authentication for public hosting, no OCR and no autonomous execution.
Retrieval is exact cosine search, and citations still need checking. These limits
are documented alongside the startup instructions.

Repository: https://github.com/PersiOnOff/locallens

## Русский вариант

Сделал LocalLens — локальную базу знаний с чатом по PDF, заметкам и документации.
Загружаешь документ, задаёшь вопрос и открываешь фрагмент, на котором основан ответ.
Модели работают через Ollama, документы и эмбеддинги хранятся в SQLite.

Есть светлая и тёмная темы, подсветка кода и граф связей импортированных файлов.
Стек — ASP.NET Core + React, запуск — `docker compose up --build`.

Первый запуск скачивает модели. Это начальная версия для одного пользователя:
без OCR и авторизации для публичного хостинга. Ссылки на источники можно проверить,
но сами ответы модели всё равно требуют внимания.

Код: https://github.com/PersiOnOff/locallens

Буду рад отзывам о сценарии «документ → вопрос → проверка источника».
