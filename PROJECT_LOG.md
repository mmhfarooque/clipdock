# ClipDock development log

## Initial implementation — 2026-10-25

- Built a React/Vite frontend and local Express backend, installable from Git with npm.
- Added episode folder import, final-video preference, Markdown upload metadata import, media previews, editing, selection and queue review.
- Implemented Google OAuth using the system browser with state validation and PKCE. Credentials stay in OS user configuration outside the Git checkout.
- Added private-only sequential uploads, explicit destination-channel confirmation, audience/AI metadata and optional SRT upload.
- Added content-hash duplicate protection and a write-ahead receipt; saved video IDs before caption processing.
- Added local Host/Origin/per-run request guards and a single-instance lock.
- Local checks: production build, seven automated core/HTTP tests, Chromium empty/mobile/settings/import smoke, and local episode import/edit/save/review checks. No real OAuth login or YouTube upload performed.
- Added cross-platform GitHub Actions configuration. Do not equate configuration with verified hosted CI results.
- Public source contains no user videos, OAuth credentials, tokens or private filesystem paths. Screenshot shows an empty workspace.

### Public repository and hosted checks

Published at https://github.com/mmhfarooque/clipdock . GitHub Actions run 40196607185 passed all three jobs: ubuntu-latest, windows-latest and macos-latest. Each ran npm ci, the React production build and seven core/HTTP tests. Live Google OAuth and uploads were not exercised.

## Guided onboarding — 2026-10-25

Added an in-app six-step Google setup guide, runtime callback copying, OAuth-vs-API-key explanation, audience/client field guidance, AI-agent checkbox explanation, sign-in state hints and troubleshooting. Added a shareable docs/SETUP.md tutorial with personal-use versus public OAuth verification distinctions. Local production build, seven tests and updated Chromium guide smoke passed. A user completed Google OAuth locally; no real upload was performed. No account names or credentials are included in this public log.
