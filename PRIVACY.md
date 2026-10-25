# ClipDock privacy

ClipDock is a self-hosted, local application. The maintainers do not run an upload server, analytics endpoint, telemetry service or user database. This statement describes the included source, not third-party modifications or a hosted deployment.

## Local data

The local Node server reads folders you import and the media/metadata files in those folders. It stores imported paths, edited metadata and upload receipts in the operating-system configuration directory documented in README. Uploaded files remain on your disk. Credentials and OAuth tokens are stored locally, outside the Git checkout, with owner-only file permissions where supported; they are not encrypted by ClipDock.

## Google / YouTube data

When you choose to connect, the browser visits Google for authentication and consent. ClipDock exchanges the code with Google and uses authorised tokens to read your channel identity and upload only the videos and optional captions you explicitly queue. Google receives your selected video, title, description, tags, language, audience, AI disclosure and other configured fields. Uploads are private. Returned channel/video IDs, status and caption outcomes are stored locally. The app uses Google access only to provide these user-requested features, not advertising or model training.

The requested YouTube management scope is broader than upload-only because separate caption uploads require it. The current application provides no video deletion endpoint, no advertising and no automatic public publication.

## Control and deletion

Use Disconnect in settings to remove local tokens and request token revocation. If revocation cannot be confirmed, the interface reports this. You may revoke access yourself at [Google account permissions](https://myaccount.google.com/permissions).

Stop ClipDock and remove its configuration directory to remove its local records, settings and credential copies. This does not remove source media, downloaded Google client JSON elsewhere on your computer, or videos already uploaded to YouTube. Manage remote videos in YouTube Studio. Removing receipts also removes duplicate-upload protection, so retain receipts you still need.

Google's handling of information is governed by the [Google Privacy Policy](https://policies.google.com/privacy). Use of Google API information is subject to applicable [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including Limited Use requirements where applicable. The unmodified app does not sell data or transfer Google user data to another service.

Do not expose ClipDock on a public network. It is designed for one OS user and loopback access, not as a multi-user hosted service. A fork or host must publish its own accurate privacy statement and satisfy provider requirements.
