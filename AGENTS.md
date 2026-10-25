# ClipDock contributor guidance

ClipDock is a local-only React/Vite interface plus Express/Node backend. Do not introduce remote hosting, embedded/shared OAuth secrets, automatic publication or invisible background uploads.

Keep default uploads private, preserve explicit channel confirmation, accurate audience/AI fields, and the write-ahead content-hash receipt. An unknown remote outcome must never trigger a blind duplicate upload. Save video IDs before attempting captions.

Credentials and user paths belong in OS user configuration outside the checkout. Never commit videos, tokens, Google client files, private logs or real user fixture paths. Tests must mock the YouTube API unless a user explicitly authorises a real action.

Run `npm test` and `npm run build` before publishing changes. Google OAuth, live uploads and cross-platform runtime support must not be claimed as verified unless actually exercised. User authorisation controls external publishing actions.
