# Suggested first issues

These are ready-to-copy issue drafts, not claims that GitHub issues already exist.
Create the labels `good first issue`, `help wanted`, `accessibility`, `documentation`
and `enhancement` as needed. Give each issue only the labels that actually apply.

## 1. Keep keyboard focus inside the repository import dialog

Suggested labels: `good first issue`, `accessibility`, `help wanted`

The repository import dialog should be usable without a mouse. Focus currently
needs a deliberate lifecycle rather than relying only on an autofocus field.

Acceptance:

- Opening the dialog puts focus in its first input.
- Tab and Shift+Tab stay within the open dialog.
- Escape closes the dialog when no import is running.
- Closing returns focus to the button that opened it.
- Existing submit/loading behavior and both themes remain intact.
- Verify the full path with keyboard navigation and add focused regression coverage.

Start in `client/src/App.tsx`. Keep the change small; no UI framework is required.

## 2. Add a fictional PDF example for page-citation onboarding

Suggested labels: `good first issue`, `documentation`, `help wanted`

The sample library contains Markdown. Add a small, readable two-page PDF so a new
user can try page citations without using a private file.

Acceptance:

- All content is original, fictional and clearly labeled as sample material.
- Text can be extracted without OCR; the PDF stays below 100 KB.
- Include its editable source or a small reproducible generation script.
- Provide two sample questions whose answers live on different pages.
- Confirm upload, indexing and the page numbers in retrieved passages.
- Mention the example in the README sample walkthrough.

## 3. Document a tested backup-and-restore walkthrough

Suggested labels: `documentation`, `help wanted`

The README explains that the `knowledge` volume should be backed up while the app
is stopped. Add a concrete walkthrough using fictional data and a disposable
Compose project so a reader can verify restoration safely.

Acceptance:

- Include commands for both PowerShell and a POSIX shell.
- Explain the distinction between the knowledge volume and model cache.
- Stop the app before copying SQLite data, including its associated files.
- Restore into a new disposable volume and verify source metadata and retrieval.
- Never ask readers to delete their existing data to test the procedure.
- State which Docker/Compose versions were actually used to check it.
