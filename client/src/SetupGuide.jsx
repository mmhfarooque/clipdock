import React, { useState } from "react";

const cloud = "https://console.cloud.google.com";
function External({ href, children }) {
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children} ↗
    </a>
  );
}

export default function SetupGuide({ configured, connected, redirectUri }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const callback = redirectUri || "http://127.0.0.1:3210/oauth/callback";
  return (
    <div className="setup-guide">
      <div className="setup-explainer">
        <b>One setup per installation</b>
        <p>
          ClipDock needs a Google <b>OAuth client JSON</b>, not an API key. It
          lets Google ask you for permission to use your YouTube channel. Each
          user creates their own client; keep the downloaded secret private.
        </p>
      </div>
      <div className="setup-progress" aria-label="Connection progress">
        <span className={configured ? "done" : ""}>
          {configured ? "✓" : "1"} Client {configured ? "imported" : "needed"}
        </span>
        <span className={connected ? "done" : ""}>
          {connected ? "✓" : "2"} Channel{" "}
          {connected ? "connected" : "sign-in needed"}
        </span>
      </div>
      <details open={!configured}>
        <summary>1. Choose a Google project and enable YouTube</summary>
        <div className="guide-body">
          <p>
            Open{" "}
            <External href={cloud + "/apis/dashboard"}>
              Google Cloud Console
            </External>{" "}
            and sign in with the Google account you want to use. Use the project
            picker at the top to create a project or choose one you control.
          </p>
          <p>
            Go to <b>APIs & Services → Library</b>, search for{" "}
            <b>YouTube Data API v3</b>, open it and click <b>Enable</b>. If it
            says <b>Enabled</b> or shows a <b>Disable API</b> button, this step
            is done.
          </p>
          <p>
            You do not need to change existing API clients or enable unrelated
            services.
          </p>
        </div>
      </details>
      <details>
        <summary>2. Set up the consent screen and audience</summary>
        <div className="guide-body">
          <p>
            In the left menu, choose <b>OAuth consent screen</b>. This opens{" "}
            <b>Google Auth Platform</b>. For a new project, complete{" "}
            <b>Get started</b> with an app name, your support/contact email and
            the appropriate audience. Personal Gmail accounts use{" "}
            <b>External</b>.
          </p>
          <p>
            Open <b>Audience</b>. If the publishing status is <b>Testing</b>,
            add the Google account you will sign in with under <b>Test users</b>
            . If the project is already <b>In production</b>, leave that status
            unchanged. Production status alone does not mean Google has verified
            every requested permission.
          </p>
          <p>
            ClipDock requests its YouTube permissions during sign-in. If Google
            requests additional configuration or verification, follow the
            instructions shown for your project.
          </p>
        </div>
      </details>
      <details>
        <summary>3. Create a client: Web application</summary>
        <div className="guide-body">
          <p>
            Under <b>Google Auth Platform → Clients</b>, click{" "}
            <b>Create client</b>.
          </p>
          <dl className="setup-fields">
            <dt>Application type</dt>
            <dd>Web application</dd>
            <dt>Name</dt>
            <dd>ClipDock Local</dd>
            <dt>Authorised JavaScript origins</dt>
            <dd>Leave blank</dd>
            <dt>Use this client for an AI-powered agent</dt>
            <dd>Leave unchecked</dd>
          </dl>
          <p>
            The AI-agent checkbox describes software that uses an AI agent to
            act on your behalf. ClipDock is a human-operated uploader.
            AI-created videos and AI-written source code do not make this client
            an AI agent.
          </p>
        </div>
      </details>
      <details>
        <summary>4. Add the exact callback URL</summary>
        <div className="guide-body">
          <p>
            Under <b>Authorised redirect URIs</b>, click <b>Add URI</b> and
            paste this exact value. Then click <b>Create</b>.
          </p>
          <div className="callback-box">
            <code>{callback}</code>
            <button
              type="button"
              className="quiet"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(callback);
                  setCopied(true);
                  setCopyError(false);
                } catch {
                  setCopyError(true);
                }
              }}
            >
              {copied ? "Copied!" : "Copy URL"}
            </button>
          </div>
          {copyError && (
            <p role="status">
              Select and copy the URL above manually; this browser did not allow
              clipboard access.
            </p>
          )}
          <p>
            <b>Why the same URL for everyone?</b> 127.0.0.1 means “this
            computer”. Each person’s browser returns to their own local ClipDock
            server. It is not a shared website. If you change the port, copy the
            updated URL shown here and add it to your Google client too. Use
            127.0.0.1 exactly; localhost is a different redirect value.
          </p>
        </div>
      </details>
      <details open={configured && !connected}>
        <summary>5. Download JSON, import, then sign in</summary>
        <div className="guide-body">
          <p>
            In the client-created dialog, download the <b>JSON</b>. You can also
            open the new client under <b>Clients</b> and use its download
            option. Import the file using <b>Google OAuth client JSON</b> below.
          </p>
          <p>
            The JSON contains the client ID and secret together. Do not enter an
            API key, paste the secret into chat, or commit the JSON to Git.
            Import stores the required settings in your private OS configuration
            directory.
          </p>
          <p>
            After import, <b>Sign in with Google</b> becomes available. Choose
            the Google/Brand account for your intended channel, review the
            requested permissions, and grant them if correct. Google then
            returns you to ClipDock. Confirm the displayed channel name and ID.
          </p>
          <p>
            Google says client-setting changes can take time to propagate. If
            you just created or changed the client, wait and retry if Google
            reports it is not ready.
          </p>
        </div>
      </details>
      <details>
        <summary>6. Review videos and upload privately</summary>
        <div className="guide-body">
          <p>
            Close settings, choose <b>Import folder</b>, and enter an absolute
            path on the computer running ClipDock. A folder of episode
            subfolders also works. We prefer <b>final-video-captioned.mp4</b>{" "}
            and read Title, Description and Tags from <b>UPLOAD_LOG.md</b>.
          </p>
          <p>
            Preview each video and choose <b>Edit details</b>. Check the title,
            description, category, audience and realistic AI disclosure.
            Separate SRT captions are optional; using them with burned-in
            subtitles may show duplicate text when CC is enabled.
          </p>
          <p>
            Select your videos, click <b>Review & upload</b>, confirm the
            channel and rights, then <b>Upload privately</b>. Keep ClipDock and
            its terminal running. Open YouTube Studio after upload to check
            processing and publish or schedule yourself.
          </p>
        </div>
      </details>
      <details>
        <summary>Something not working? Common fixes</summary>
        <div className="guide-body">
          <dl className="setup-fields">
            <dt>Sign-in button is disabled</dt>
            <dd>
              Import the downloaded OAuth client JSON first. Also wait for an
              active upload queue to finish.
            </dd>
            <dt>redirect_uri_mismatch</dt>
            <dd>
              Check the client type is Web application and that Authorised
              redirect URIs contains the exact URL shown above, including port
              and /oauth/callback. Do not put it in JavaScript origins.
            </dd>
            <dt>access_denied / test-user restriction</dt>
            <dd>
              Check the selected Google account and the project’s Audience page.
              If in Testing, add that account as a test user. Follow Google’s
              verification requirements if shown.
            </dd>
            <dt>Google displays an unverified-app warning</dt>
            <dd>
              Confirm that you recognise the project, client and permissions. Do
              not authorise an unfamiliar app. Review Google’s verification
              instructions; a public GitHub repo is not Google approval.
            </dd>
            <dt>API disabled or permission denied</dt>
            <dd>
              Enable YouTube Data API v3 in the same project that created this
              client. If you previously refused YouTube permissions, reconnect
              and review the consent screen.
            </dd>
            <dt>Wrong channel</dt>
            <dd>
              Reconnect using the account/Brand account that owns the intended
              channel. Check the name and ID before confirming uploads.
            </dd>
            <dt>Port 3210 is already in use</dt>
            <dd>
              Stop the other ClipDock process, or set PORT to a free port before
              npm start. Use the new address printed in the terminal and update
              the Google callback accordingly.
            </dd>
            <dt>An upload is interrupted</dt>
            <dd>
              Check Upload history and YouTube Studio before retrying. ClipDock
              keeps uncertain attempts to help prevent duplicates.
            </dd>
          </dl>
        </div>
      </details>
      <div className="guide-links">
        <External href="https://github.com/mmhfarooque/clipdock/blob/main/docs/SETUP.md">
          Full setup tutorial
        </External>
        <External href="https://support.google.com/cloud/answer/15549257">
          Google’s OAuth client help
        </External>
      </div>
    </div>
  );
}
