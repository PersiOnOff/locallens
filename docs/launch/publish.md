# Publish the launch package

The package is prepared locally. About is already configured by the maintainer.
Nothing in this change posts announcements, creates GitHub issues, changes settings,
publishes a release or pushes Git commits automatically.

## 1. Upload the repository changes

After reviewing and committing the files:

```sh
git push origin main
```

The README uses the real repository path `PersiOnOff/locallens`. Its CI badge reads
the actual `CI` workflow, not a static passing badge. Wait for the new workflow run
before describing the published commit as passing.

## 2. Set the social preview image

Open:

https://github.com/PersiOnOff/locallens/settings

Under **Social preview → Edit → Upload an image**, choose:

```text
docs/media/social-preview.png
```

This is a 1280 × 640 opaque PNG below 1 MB. Adding the file to the repository alone
does not configure the repository's social-preview setting.

## 3. Publish v0.1.0

Create the release after the packaging commit has been pushed and CI is green:

https://github.com/PersiOnOff/locallens/releases/new

- Tag: `v0.1.0` (create it on `main`).
- Title: `LocalLens v0.1.0 — Your knowledge. Your machine.`
- Body: paste the contents of `docs/releases/v0.1.0.md`.
- Mark it as a pre-release: this is an initial local single-user version.
- No binaries or model weights need to be attached; use the documented source/Compose startup.

The repository's GitHub Actions CI checks the app but does not publish a release
automatically. `CHANGELOG.md` records the prepared feature set; the GitHub release
does not exist merely because that file was added.

## 4. Open the starter issues

Use `docs/launch/first-issues.md` to create three concrete issues. Read each draft
and apply only its suggested labels. For a documentation task, don't promise that
a backup walkthrough has already been tested.

Issue forms and the pull-request template appear automatically once their files
are on the default branch. The forms are under `.github/ISSUE_TEMPLATE/`.

## 5. Share a short demonstration

Use `docs/launch/announcements.md` for English and Russian copy. Attach the real
`docs/media/demo.gif` or a theme screenshot, and link the repository. The GIF is an
edited keyframe demonstration, not a recording suitable for latency claims.

Do not post identical promotional text everywhere. Explain the concrete use case,
follow each community's rules and answer technical questions candidly.
