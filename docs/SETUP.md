# ClipDock setup tutorial

This guide takes you from a fresh install to a private YouTube upload. You need a Google account that owns or can authorise the intended YouTube channel. ClipDock runs on your own computer; its GitHub repository is not a hosted upload service.

## 1. Install and start

Install Git and Node.js 24 LTS. Then run:

```sh
git clone https://github.com/mmhfarooque/clipdock.git
cd clipdock
npm ci
npm run build
npm start
```

Open **http://127.0.0.1:3210** in the browser on the same computer. Keep the terminal running while you use the app, particularly during uploads.

`127.0.0.1` is the loopback address: it means your own computer. All users can use the same address without sharing files or an account. Another person's `127.0.0.1` is their computer, not yours. If you change `PORT`, use the new address printed in the terminal and update the OAuth redirect below. The app deliberately uses `127.0.0.1`, not `localhost`, for an exact match.

## 2. Enable YouTube Data API v3

1. Open [Google Cloud Console](https://console.cloud.google.com/apis/dashboard).
2. Choose a project you control in the project picker at the top, or create one. For a separately distributed public application, prefer a dedicated project rather than changing unrelated integrations.
3. Go to **APIs & Services → Library** or **Enable APIs and services**.
4. Search **YouTube Data API v3**, open it, then click **Enable**.
5. A status of **Enabled** or a **Disable API** button means it is enabled. Do not click Disable.

## 3. Consent screen / Google Auth Platform

In the left sidebar, open **OAuth consent screen**. Google's current interface calls this **Google Auth Platform**.

For a new project, click **Get started** and provide your app name, support/contact email and audience. Choose the appropriate audience for your account; personal Gmail users use **External**. Do not claim an organisation or domain you do not control.

On **Audience**:

- If **Testing**, add the Google account you will use under **Test users**.
- If already **In production**, leave that status unchanged for the existing setup. It does not mean Google has verified the requested permissions.
- Complete any additional configuration or verification Google requests for your usage. Do not modify an existing client's unrelated settings.

## 4. Create the OAuth client (not an API key)

In **Google Auth Platform → Clients**, choose **Create client**.

| Field | Value |
| --- | --- |
| Application type | **Web application** |
| Name | **ClipDock Local** |
| Authorised JavaScript origins | Leave blank |
| Authorised redirect URIs | `http://127.0.0.1:3210/oauth/callback` |
| Use this client for an AI-powered agent | Leave unchecked |

Add the callback under **Authorised redirect URIs**, not JavaScript origins. Copy the value from ClipDock settings if using a different port. Include the path `/oauth/callback`; do not add an extra trailing slash.

Click **Create**, then download the **JSON** file. The client ID and client secret are both inside it. You can also open the client in the Clients list and use its download option.

An **API key** does not authorise uploading to your channel. ClipDock needs an **OAuth client JSON** so Google can ask you for consent.

The AI-agent checkbox is about software that uses AI agents to act or retrieve context for users. ClipDock is currently a user-operated uploader using the YouTube REST API. The fact that your videos or the app's code were made with AI does not make its OAuth client agentic. See [Google's client guidance](https://support.google.com/cloud/answer/15549257).

## 5. Import JSON and sign in

1. Return to ClipDock → **Connection & settings**.
2. Expand the numbered guide whenever you need help.
3. Under **Google OAuth client JSON**, choose the downloaded file.
4. Confirm **Client imported** appears. **Sign in with Google** now becomes enabled.
5. Click it, choose the account/Brand account for your intended YouTube channel, and review Google's consent request.
6. If you grant permission, Google returns to ClipDock. Check the **channel name and ID** shown in settings and at the upload review.

If the wrong channel appears, use **Connect a different channel**. A personal account and its Brand channel may be different destinations even when you use the same email.

Keep the JSON, client secret and tokens private. Do not send them in chat, add them to GitHub, or include them in screenshots. Store the original download outside the checkout. ClipDock saves its working credentials in your private OS configuration directory; see the [README](../README.md#files-credentials-and-receipts).

### “Google hasn't verified this app”

The warning concerns the OAuth app/project and requested permissions, not the selected YouTube channel. It can appear again when changing channels. A GitHub repository or **In production** status is not verification.

Do not authorise an app whose developer, client or permissions you do not recognise. For an OAuth client you created in your own project for personal use, Google documents a [personal-use exception](https://developers.google.com/identity/protocols/oauth2/policies). Review the warning and consent carefully; this exception is not a blanket exemption for a widely distributed shared app.

For public shared sign-in without the unverified warning, Google's process generally requires:

1. A publicly accessible app homepage and privacy policy on a domain you control and verify.
2. Accurate branding, support/contact information and disclosure of data use.
3. The minimum necessary OAuth scopes, with an explanation of how each is used. ClipDock uses `youtube.force-ssl` because separate caption uploads require it, in addition to uploading videos and reading the authorised channel identity.
4. A demonstration video showing sign-in, the consent request and the features using those permissions.
5. Submission under **Google Auth Platform → Verification centre**, plus any follow-up Google requests.

Read [Google's sensitive-scope verification guide](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification). Brand verification, sensitive-scope review and any YouTube-specific API compliance/audit requirements are distinct; approval of one does not establish every other approval. Do not assume a particular review time or outcome.

**Current distribution model:** each ClipDock installation provides its own OAuth client. Verifying the maintainer's project does not automatically verify a different user's project. A shared verified-client onboarding model needs separate design, provider review and secure distribution; never publish a web OAuth client secret in the Git repository.

## 6. Import your videos

Click **Import folder** and enter an absolute path on the computer running ClipDock. Choose one episode folder or a parent containing episode folders. The app scans that folder and its immediate child folders; it does not move files.

ClipDock prefers **final-video-captioned.mp4**, then **final-video.mp4**, then **kling-original.mp4**, then **video.mp4**. Each folder represents one video. Rename the intended final to a preferred filename, or put it in its own folder, if multiple versions exist.

An optional **UPLOAD_LOG.md** with `## Title`, `## Description` and `## Tags` sections supplies the initial text. An optional **captions.srt** enables separate CC uploads. Do not enable a separate track unnecessarily if subtitles are already burned into the picture.

## 7. Review and upload privately

1. Play the actual video. Choose **Edit details** and check title, description, tags, category, language, audience and realistic AI-content disclosure.
2. Save details. Select the videos you want, then **Review & upload**.
3. Check the displayed channel again. Confirm the content/rights/settings and private destination.
4. Click **Upload privately**. Watch the queue and keep the server running.
5. Open the returned link and YouTube Studio to check processing, captions and content checks. Publish or schedule manually when satisfied.

ClipDock does not automatically publish, guarantee Shorts classification or validate third-party commercial rights. You remain responsible for the content and accurate metadata.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Disabled Sign in with Google | Import OAuth JSON first; wait for an active queue to finish. |
| `redirect_uri_mismatch` | Client is Web application; exact callback is under redirect URIs; scheme, IP, port and path match; no trailing slash. |
| Access denied / test-user restriction | Correct account selected; that account is a test user when Audience is Testing; review any verification requirements. |
| API not enabled | YouTube Data API v3 is enabled in the same project as the client JSON. |
| Permission missing | Reconnect and review the permissions; refusing YouTube access prevents the requested operation. |
| Wrong YouTube channel | Reconnect using the correct Google/Brand account and verify name/ID. |
| Client recently changed | Google notes changes can take time to propagate. Confirm the settings, then wait and retry if necessary. |
| Port already in use | Stop the other app/process or change PORT and the callback together. |
| Upload interrupted / needs reconciliation | Check history and Studio before retrying. Never clear duplicate protection blindly. |
| Captions failed after upload | The video ID is saved. Add SRT in Studio; do not re-upload the video. |

Need provider help? [OAuth clients](https://support.google.com/cloud/answer/15549257) · [Google verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification) · [YouTube API](https://developers.google.com/youtube/data/reference/rest/v3/videos/insert)
