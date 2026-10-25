import express from "express";
import { google } from "googleapis";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { readFile, mkdir, unlink, open, access } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  atomicJSON,
  readJSON,
  scanEpisodes,
  validateMetadata,
  asset,
  uploadOnce,
} from "./core.mjs";

const project = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const port = Number(process.env.PORT || 3210);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("PORT must be between 1024 and 65535.");
const origin = `http://127.0.0.1:${port}`;
const defaultState =
  process.platform === "win32"
    ? path.join(process.env.APPDATA || homedir(), "ClipDock")
    : process.platform === "darwin"
      ? path.join(homedir(), "Library", "Application Support", "ClipDock")
      : path.join(
          process.env.XDG_CONFIG_HOME || path.join(homedir(), ".config"),
          "clipdock",
        );
const stateDir = path.resolve(process.env.CLIPDOCK_STATE_DIR || defaultState);
if (stateDir === project || stateDir.startsWith(project + path.sep))
  throw new Error("Keep ClipDock state outside the Git checkout.");
await mkdir(stateDir, { recursive: true, mode: 0o700 });
const lockFile = path.join(stateDir, "server.lock");
let lock;
const files = Object.fromEntries(
  ["settings", "oauth", "tokens", "ledger"].map((k) => [
    k,
    path.join(stateDir, k + ".json"),
  ]),
);
let settings = await readJSON(files.settings, { roots: [], edits: {} });
let oauth = await readJSON(files.oauth, null),
  tokens = await readJSON(files.tokens, null);
let ledger = await readJSON(files.ledger, {}),
  episodes = [],
  channel = null;
const csrf = randomBytes(32).toString("hex");
const pending = new Map();
let jobs = [],
  busy = false;
const app = express();
app.disable("x-powered-by");
app.use((req, res, next) => {
  // No remote listening, CORS, proxy headers, or DNS rebinding.
  if (req.headers.host !== `127.0.0.1:${port}`)
    return res.status(403).send("Open " + origin);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  );
  if (req.headers.origin && req.headers.origin !== origin)
    return res.status(403).send("Cross-origin requests are not allowed.");
  next();
});
app.use(express.json({ limit: "256kb" }));
app.get("/api/session", (req, res) => {
  if (req.headers["sec-fetch-site"] === "cross-site")
    return res.sendStatus(403);
  res.json({ csrf });
});
app.use("/api", (req, res, next) => {
  const given = req.headers["x-clipdock-session"];
  if (
    typeof given !== "string" ||
    given.length !== csrf.length ||
    !timingSafeEqual(Buffer.from(given), Buffer.from(csrf))
  )
    return res.sendStatus(403);
  next();
});
const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res)).catch(next);
const saveSettings = () => atomicJSON(files.settings, settings);
const saveLedger = async (value) => {
  ledger = value;
  await atomicJSON(files.ledger, value);
};
function client() {
  if (!oauth) throw new Error("Import your Google OAuth client first.");
  const c = new google.auth.OAuth2(
    oauth.client_id,
    oauth.client_secret,
    `${origin}/oauth/callback`,
  );
  if (tokens) c.setCredentials(tokens);
  // Refreshed access tokens remain local, outside the repository.
  c.on("tokens", (fresh) => {
    tokens = { ...tokens, ...fresh };
    atomicJSON(files.tokens, tokens).catch(() =>
      console.error(
        "Could not persist refreshed credentials. Reconnect before the next upload.",
      ),
    );
  });
  return c;
}
async function verifyChannel(auth) {
  const yt = google.youtube({ version: "v3", auth });
  const response = await yt.channels.list({ part: ["snippet"], mine: true });
  const c = response.data.items?.[0];
  if (!c)
    throw new Error(
      "No YouTube channel was returned. Sign in with the channel owner.",
    );
  return { id: c.id, title: c.snippet.title };
}
async function refreshEpisodes() {
  const result = [],
    errors = [];
  for (const root of settings.roots) {
    try {
      result.push(...(await scanEpisodes(root)));
    } catch {
      errors.push(`Could not read folder: ${root}`);
    }
  }
  episodes = [
    ...new Map(
      result.map((e) => [
        e.id,
        { ...e, metadata: settings.edits[e.id] || e.metadata },
      ]),
    ).values(),
  ];
  return errors;
}
const episode = (id) => {
  const e = episodes.find((e) => e.id === id);
  if (!e) throw new Error("Episode not found. Import or refresh its folder.");
  return e;
};
app.get(
  "/api/status",
  wrap(async (_req, res) => {
    res.json({
      configured: Boolean(oauth),
      connected: Boolean(tokens && channel),
      channel,
      redirectUri: `${origin}/oauth/callback`,
      episodes,
      roots: settings.roots,
      jobs,
      history: Object.values(ledger).sort((a, b) =>
        b.startedAt.localeCompare(a.startedAt),
      ),
      busy,
    });
  }),
);
app.post(
  "/api/import",
  wrap(async (req, res) => {
    if (busy) throw new Error("Wait for the current queue to finish.");
    const root = String(req.body.folder || "").trim();
    if (!path.isAbsolute(root))
      throw new Error(
        "Enter an absolute folder path on the computer running ClipDock.",
      );
    const imported = await scanEpisodes(root);
    if (!imported.length)
      throw new Error(
        "No video files found in this folder or its immediate subfolders.",
      );
    settings.roots = [...new Set([...settings.roots, root])];
    await saveSettings();
    await refreshEpisodes();
    res.json({ imported: imported.length });
  }),
);
app.post(
  "/api/refresh",
  wrap(async (_req, res) => res.json({ errors: await refreshEpisodes() })),
);
app.post(
  "/api/episodes/:id",
  wrap(async (req, res) => {
    if (busy) throw new Error("Wait for the queue to finish before editing.");
    const e = episode(req.params.id);
    e.metadata = validateMetadata(req.body);
    settings.edits[e.id] = e.metadata;
    await saveSettings();
    res.json(e);
  }),
);
// Video previews use an HttpOnly cookie scoped to preview requests; tokens never
// appear in a media URL or browser history.
app.post("/api/preview-session", (_req, res) => {
  res.cookie("clipdockPreview", csrf, {
    httpOnly: true,
    sameSite: "strict",
    path: "/media",
    maxAge: 86400000,
  });
  res.json({ ok: true });
});
app.get(
  "/media/:id",
  wrap(async (req, res) => {
    if (
      !(req.headers.cookie || "")
        .split(";")
        .some((c) => c.trim() === `clipdockPreview=${csrf}`)
    )
      return res.sendStatus(403);
    const e = episode(req.params.id);
    const filename = await asset(e.folder, e.video);
    res.sendFile(filename); // Express supports range requests for local playback.
  }),
);
app.post(
  "/api/oauth/config",
  wrap(async (req, res) => {
    if (busy) throw new Error("Wait for uploads to finish.");
    const value = req.body.installed || req.body.web;
    if (
      !value ||
      typeof value.client_id !== "string" ||
      !value.client_id.endsWith(".apps.googleusercontent.com") ||
      typeof value.client_secret !== "string"
    )
      throw new Error(
        "Choose a Google OAuth client JSON file (Web application or Desktop app).",
      );
    oauth = { client_id: value.client_id, client_secret: value.client_secret };
    tokens = null;
    channel = null;
    pending.clear();
    await atomicJSON(files.oauth, oauth);
    await unlink(files.tokens).catch((e) => {
      if (e.code !== "ENOENT") throw e;
    });
    res.json({ ok: true });
  }),
);
app.post(
  "/api/oauth/start",
  wrap(async (_req, res) => {
    if (busy) throw new Error("Wait for uploads to finish.");
    const c = client();
    const state = randomBytes(32).toString("hex");
    const pkce = await c.generateCodeVerifierAsync();
    pending.clear();
    pending.set(state, { verifier: pkce.codeVerifier, created: Date.now() });
    const url = c.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      state,
      scope: ["https://www.googleapis.com/auth/youtube.force-ssl"],
      code_challenge: pkce.codeChallenge,
      code_challenge_method: "S256",
    });
    res.json({ url });
  }),
);
app.get(
  "/oauth/callback",
  wrap(async (req, res) => {
    const saved = pending.get(String(req.query.state));
    pending.delete(String(req.query.state));
    if (!saved || Date.now() - saved.created > 10 * 60000)
      return res
        .status(400)
        .send(
          "Sign-in expired or state did not match. Return to ClipDock and try again.",
        );
    if (req.query.error || typeof req.query.code !== "string")
      return res
        .status(400)
        .send("Google sign-in was not completed. Return to ClipDock.");
    try {
      const c = client();
      const result = await c.getToken({
        code: req.query.code,
        codeVerifier: saved.verifier,
      });
      c.setCredentials(result.tokens);
      const verified = await verifyChannel(c);
      tokens = result.tokens;
      channel = verified;
      await atomicJSON(files.tokens, tokens);
      res.redirect("/");
    } catch {
      res
        .status(400)
        .send(
          "Could not complete channel sign-in. Confirm the API, redirect URI and Google test user settings, then reconnect in ClipDock.",
        );
    }
  }),
);
app.post(
  "/api/oauth/disconnect",
  wrap(async (_req, res) => {
    if (busy) throw new Error("Wait for uploads to finish.");
    let revoked = true;
    try {
      if (tokens) await client().revokeCredentials();
    } catch {
      revoked = false;
    }
    tokens = null;
    channel = null;
    pending.clear();
    await unlink(files.tokens).catch((e) => {
      if (e.code !== "ENOENT") throw e;
    });
    res.json({ revoked });
  }),
);
app.post(
  "/api/queue",
  wrap(async (req, res) => {
    if (busy) throw new Error("A queue is already running.");
    if (!tokens || !channel)
      throw new Error("Connect your YouTube channel first.");
    if (
      !Array.isArray(req.body.ids) ||
      !req.body.ids.length ||
      req.body.ids.length > 20
    )
      throw new Error("Choose 1–20 videos.");
    if (req.body.confirmPrivate !== true || req.body.channelId !== channel.id)
      throw new Error("Confirm the private upload and destination channel.");
    const chosen = [...new Set(req.body.ids)].map((id) => episode(id));
    for (const e of chosen) validateMetadata(e.metadata);
    busy = true;
    const auth = client();
    let verified;
    try {
      verified = await verifyChannel(auth);
      if (verified.id !== req.body.channelId)
        throw new Error(
          "The channel changed. Reconnect and review the destination.",
        );
    } catch (error) {
      busy = false;
      throw error;
    }
    const youtube = google.youtube({ version: "v3", auth });
    busy = true;
    jobs = chosen.map((e) => ({
      id: e.id,
      name: e.name,
      state: "queued",
      progress: 0,
    }));
    res.json({ queued: jobs.length });
    (async () => {
      for (const job of jobs) {
        job.state = "uploading";
        try {
          const e = episode(job.id);
          const receipt = await uploadOnce({
            episode: e,
            metadata: e.metadata,
            channel: verified,
            ledger,
            save: saveLedger,
            youtube,
            progress: (bytes) => {
              job.progress = Math.min(99, Math.round((bytes / e.bytes) * 100));
            },
          });
          job.state = "uploaded";
          job.progress = 100;
          job.url = receipt.url;
        } catch (error) {
          job.state = "needs attention";
          job.error = error.message;
          // Stop after a failure, rather than repeatedly creating ambiguous uploads.
          for (const next of jobs)
            if (next.state === "queued") next.state = "not started";
          break;
        }
      }
      busy = false;
    })().catch(() => {
      busy = false;
      console.error("Queue stopped; inspect upload history before retrying.");
    });
  }),
);
const dist = path.join(project, "dist");
try {
  await access(path.join(dist, "index.html"));
} catch {
  throw new Error("Run npm run build before npm start.");
}
app.use(express.static(dist, { index: "index.html" }));
app.use((error, req, res, _next) => {
  // API messages originate in local validation. Do not serialize Google errors,
  // request configs, access tokens, or response bodies into the UI/logs.
  const message =
    error.response || error.config
      ? "Google request failed. Reconnect or check the API settings."
      : error.message;
  res.status(400).json({ error: message || "Request failed." });
});
await refreshEpisodes();
if (tokens && oauth) {
  try {
    channel = await verifyChannel(client());
  } catch {
    channel = null;
  }
}
try {
  lock = await open(lockFile, "wx", 0o600);
  await lock.writeFile(String(process.pid));
} catch {
  throw new Error(
    `ClipDock is already running, or a stale server.lock exists in ${stateDir}. See README recovery instructions.`,
  );
}
const server = app.listen(port, "127.0.0.1", () =>
  console.log(`ClipDock ready: ${origin}\nPress Ctrl+C to stop.`),
);
const cleanup = async () => {
  await lock.close().catch(() => {});
  await unlink(lockFile).catch(() => {});
};
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    server.close();
    await cleanup();
    process.exit(0);
  });
server.on("error", async (error) => {
  await cleanup();
  console.error(
    error.code === "EADDRINUSE"
      ? `Port ${port} is in use.`
      : "Server could not start.",
  );
  process.exit(1);
});
