import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

let csrf;
async function api(url, body) {
  const response = await fetch("/api/" + url, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Clipdock-Session": csrf || "",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response
    .json()
    .catch(() => ({
      error: "The local server could not complete this request.",
    }));
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}
function Icon({ name, size = 20 }) {
  const paths = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    settings: (
      <>
        <path d="M4 7h16M4 17h16" />
        <circle cx="8" cy="7" r="3" />
        <circle cx="16" cy="17" r="3" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    play: <path d="m9 5 11 7-11 7z" />,
    check: <path d="m5 12 4 4L19 6" />,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    folder: <path d="M3 7V5h7l2 3h9v12H3z" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    link: (
      <>
        <path d="M14 3h7v7m0-7L10 14" />
        <path d="M10 3H3v18h18v-7" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.grid}
    </svg>
  );
}
const units = (bytes) =>
  bytes > 1024 ** 3
    ? `${(bytes / 1024 ** 3).toFixed(1)} GB`
    : `${(bytes / 1024 ** 2).toFixed(1)} MB`;
const niceDate = (date) => new Date(date).toLocaleString();
function App() {
  const [data, setData] = useState({
    episodes: [],
    jobs: [],
    history: [],
    roots: [],
  });
  const [tab, setTab] = useState("library"),
    [selected, setSelected] = useState([]);
  const [drafts, setDrafts] = useState({}),
    [editing, setEditing] = useState(null);
  const [modal, setModal] = useState(null),
    [folder, setFolder] = useState("");
  const [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [working, setWorking] = useState(false),
    [confirmed, setConfirmed] = useState(false);
  const [preview, setPreview] = useState(null),
    [search, setSearch] = useState("");
  const statusRef = useRef(null);
  const refresh = async () => {
    const state = await api("status");
    setData(state);
    return state;
  };
  useEffect(() => {
    let mounted = true;
    (async () => {
      csrf = (await fetch("/api/session").then((r) => r.json())).csrf;
      await api("preview-session", {});
      if (mounted) await refresh();
      statusRef.current = setInterval(() => {
        if (mounted) refresh().catch((e) => setError(e.message));
      }, 2500);
    })().catch((e) => setError(e.message));
    return () => {
      mounted = false;
      clearInterval(statusRef.current);
    };
  }, []);
  useEffect(() => {
    const close = (e) => {
      if (e.key === "Escape") {
        setModal(null);
        setPreview(null);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  async function act(fn) {
    setWorking(true);
    setError("");
    setNotice("");
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setWorking(false);
    }
  }
  const metadata = (e) => drafts[e.id] || e.metadata;
  const update = (e, key, value) =>
    setDrafts((d) => ({ ...d, [e.id]: { ...metadata(e), [key]: value } }));
  const save = async (e) => {
    const saved = await api("episodes/" + e.id, metadata(e));
    setDrafts((d) => {
      const next = { ...d };
      delete next[e.id];
      return next;
    });
    return saved;
  };
  const current = data.episodes.find((e) => e.id === editing);
  const chosen = data.episodes.filter((e) => selected.includes(e.id));
  const matches = data.episodes.filter((e) =>
    `${metadata(e).title} ${e.name}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  const uploaded = data.history.filter((h) => h.videoId).length;
  const openUpload = () => {
    setConfirmed(false);
    setModal("upload");
  };
  const nav = [
    {
      key: "library",
      icon: "grid",
      label: "Video library",
      count: data.episodes.length,
    },
    {
      key: "queue",
      icon: "upload",
      label: "Upload queue",
      count: data.jobs.filter(
        (j) => j.state === "queued" || j.state === "uploading",
      ).length,
    },
    { key: "history", icon: "clock", label: "Upload history", count: uploaded },
  ];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="ClipDock home">
          <span className="brand-mark">
            <Icon name="play" size={21} />
          </span>
          ClipDock<span className="version">LOCAL</span>
        </a>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav>
          {nav.map((n) => (
            <button
              key={n.key}
              className={tab === n.key ? "nav active" : "nav"}
              onClick={() => {
                setTab(n.key);
                setEditing(null);
              }}
            >
              <Icon name={n.icon} />
              {n.label}
              <span>{n.count}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-note">
            <span className="pulse" /> Running on your computer
            <p>Your files stay here until you upload.</p>
          </div>
          <button className="nav" onClick={() => setModal("settings")}>
            <Icon name="settings" /> Connection & settings
          </button>
          <a
            className="repo-link"
            href="https://github.com/mmhfarooque/clipdock"
            target="_blank"
            rel="noreferrer"
          >
            ClipDock on GitHub <Icon name="link" size={13} />
          </a>
        </div>
      </aside>
      <main>
        <header>
          <div className="breadcrumb">
            Workspace <span>/</span> {nav.find((n) => n.key === tab)?.label}
          </div>
          <button
            className="channel-button"
            onClick={() => setModal("settings")}
          >
            <span className={data.connected ? "dot connected" : "dot"} />
            {data.connected ? data.channel.title : "Connect YouTube"}
            <Icon name="arrow" size={15} />
          </button>
        </header>
        <div className="page">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                A LITTLE LESS ADMIN. A LOT MORE CREATING.
              </div>
              <h1>
                {tab === "library"
                  ? "Your next upload starts here."
                  : tab === "queue"
                    ? "From ready to uploaded."
                    : "Every upload, accounted for."}
              </h1>
              <p>
                {tab === "library"
                  ? "Bring in your videos, fine-tune the details, and send them to YouTube."
                  : tab === "queue"
                    ? "One video at a time. Originals always stay on your computer."
                    : "Keep track of what went where. No more accidental duplicates."}
              </p>
            </div>
            {tab === "library" && (
              <button
                className="primary"
                onClick={() => setModal("import")}
                disabled={data.busy}
              >
                <Icon name="plus" />
                Import folder
              </button>
            )}
          </div>
          {error && (
            <div className="banner error" role="alert">
              {error}
              <button onClick={() => setError("")} aria-label="Dismiss error">
                ×
              </button>
            </div>
          )}
          {notice && (
            <div className="banner success" role="status">
              {notice}
              <button
                onClick={() => setNotice("")}
                aria-label="Dismiss notification"
              >
                ×
              </button>
            </div>
          )}
          <section className="stats" aria-label="Workspace summary">
            <div>
              <span className="stat-icon">
                <Icon name="folder" />
              </span>
              <div>
                <strong>{data.episodes.length}</strong>
                <span>Videos in your library</span>
              </div>
            </div>
            <div>
              <span className="stat-icon">
                <Icon name="check" />
              </span>
              <div>
                <strong>{uploaded}</strong>
                <span>Uploaded through ClipDock</span>
              </div>
            </div>
            <div>
              <span className="stat-icon">
                <Icon name="lock" />
              </span>
              <div>
                <strong>Private first</strong>
                <span>Review in Studio before publishing</span>
              </div>
            </div>
          </section>
          {tab === "library" && (
            <>
              <div className="library-toolbar">
                <h2>
                  Video library <span>{data.episodes.length}</span>
                </h2>
                <div>
                  <input
                    className="search"
                    aria-label="Search videos"
                    placeholder="Search your videos…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <button
                    className="quiet"
                    onClick={() =>
                      act(async () => {
                        const r = await api("refresh", {});
                        setNotice(
                          r.errors.length
                            ? r.errors.join(" · ")
                            : "Library refreshed.",
                        );
                      })
                    }
                    disabled={working}
                  >
                    Refresh
                  </button>
                </div>
              </div>
              {!data.episodes.length ? (
                <div className="empty-state">
                  <div className="empty-art">
                    <Icon name="folder" size={40} />
                    <span>
                      <Icon name="plus" size={17} />
                    </span>
                  </div>
                  <h2>A home for your next great video.</h2>
                  <p>
                    Import an episode folder—or a folder of episodes.
                    <br />
                    We’ll find your final videos, captions and upload notes.
                  </p>
                  <button
                    className="primary"
                    onClick={() => setModal("import")}
                  >
                    <Icon name="plus" />
                    Import your first folder
                  </button>
                  <small>No files are moved or uploaded.</small>
                </div>
              ) : (
                <div
                  className={
                    current ? "library-layout with-editor" : "library-layout"
                  }
                >
                  <div className="video-grid">
                    {matches.map((e, i) => (
                      <article
                        key={e.id}
                        className={
                          "video-card" + (editing === e.id ? "editing" : "")
                        }
                      >
                        <div className={"video-poster tone-" + (i % 4)}>
                          <video
                            src={"/media/" + e.id + "#t=1"}
                            preload="metadata"
                            muted
                            playsInline
                            aria-label={"Preview of " + metadata(e).title}
                          />
                          <label className="selection">
                            <input
                              type="checkbox"
                              checked={selected.includes(e.id)}
                              disabled={data.busy}
                              onChange={(event) =>
                                setSelected((s) =>
                                  event.target.checked
                                    ? [...s, e.id]
                                    : s.filter((id) => id !== e.id),
                                )
                              }
                            />
                            <span className="sr-only">
                              Select {metadata(e).title}
                            </span>
                          </label>
                          <button
                            className="play-button"
                            aria-label={"Play " + metadata(e).title}
                            onClick={() => setPreview(e)}
                          >
                            <Icon name="play" size={24} />
                          </button>
                          <span className="poster-tag">
                            {e.video.includes("captioned")
                              ? "CAPTIONED"
                              : "VIDEO"}
                          </span>
                        </div>
                        <div className="video-details">
                          <div className="file-meta">
                            <span className="mini-dot" />
                            LOCAL FILE<span>{units(e.bytes)}</span>
                          </div>
                          <h3>{metadata(e).title}</h3>
                          <p className="folder-name" title={e.folder}>
                            {e.name}
                          </p>
                          <div className="card-footer">
                            <span>
                              {e.captions ? "SRT available" : "No SRT file"}
                            </span>
                            <button
                              onClick={() =>
                                setEditing(editing === e.id ? null : e.id)
                              }
                            >
                              Edit details <Icon name="arrow" size={14} />
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                    {!matches.length && <p>No matching videos.</p>}
                  </div>
                  {current && (
                    <section className="editor">
                      <div className="editor-title">
                        <h2>Upload details</h2>
                        <button
                          className="icon-button"
                          aria-label="Close editor"
                          onClick={() => setEditing(null)}
                        >
                          <Icon name="close" />
                        </button>
                      </div>
                      <p className="muted">
                        Saved locally. Your original files stay untouched.
                      </p>
                      <MetadataForm
                        episode={current}
                        value={metadata(current)}
                        update={(k, v) => update(current, k, v)}
                        disabled={data.busy}
                      />
                      <button
                        className="primary full"
                        disabled={working || data.busy}
                        onClick={() =>
                          act(async () => {
                            await save(current);
                            setNotice("Upload details saved.");
                          })
                        }
                      >
                        Save details
                      </button>
                    </section>
                  )}
                </div>
              )}
              {data.episodes.length > 0 && (
                <div className="selection-bar">
                  <label>
                    <input
                      type="checkbox"
                      checked={selected.length === data.episodes.length}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? data.episodes.map((x) => x.id)
                            : [],
                        )
                      }
                      disabled={data.busy}
                    />
                    Select all
                  </label>
                  <span>{chosen.length} selected</span>
                  <button
                    className="primary"
                    disabled={!chosen.length || data.busy || working}
                    onClick={openUpload}
                  >
                    Review & upload <Icon name="arrow" size={17} />
                  </button>
                </div>
              )}
            </>
          )}
          {tab === "queue" && (
            <section className="list-panel">
              <h2>Current session</h2>
              {!data.jobs.length ? (
                <p className="muted">
                  Nothing queued yet. Select videos from your library to get
                  started.
                </p>
              ) : (
                data.jobs.map((j) => (
                  <div className="job" key={j.id}>
                    <div className="job-icon">
                      <Icon
                        name={j.state === "uploaded" ? "check" : "upload"}
                      />
                    </div>
                    <div>
                      <strong>{j.name}</strong>
                      <p>
                        {j.error || j.state}
                        {j.state === "uploading"
                          ? ` · ${j.progress}% sent`
                          : ""}
                      </p>
                      {j.state === "uploading" && (
                        <progress max="100" value={j.progress} />
                      )}
                    </div>
                    {j.url && (
                      <a href={j.url} target="_blank" rel="noreferrer">
                        Open video ↗
                      </a>
                    )}
                  </div>
                ))
              )}
            </section>
          )}
          {tab === "history" && (
            <section className="list-panel">
              <h2>Upload receipts</h2>
              <p className="muted">
                An interrupted upload stays recorded. Check YouTube Studio
                before trying again.
              </p>
              {!data.history.length ? (
                <p>No uploads recorded yet.</p>
              ) : (
                data.history.map((h) => (
                  <div className="receipt" key={h.key}>
                    <div>
                      <strong>{h.title}</strong>
                      <p>
                        {niceDate(h.startedAt)} · {h.state} ·{" "}
                        {h.returnedPrivacy || "awaiting response"}
                      </p>
                      <small>
                        {h.channelId}
                        {h.videoId ? ` · Video ${h.videoId}` : ""}
                      </small>
                      {h.captions !== "not requested" && (
                        <p>Captions: {h.captions}</p>
                      )}
                    </div>
                    {h.url && (
                      <a href={h.url} target="_blank" rel="noreferrer">
                        Open video ↗
                      </a>
                    )}
                  </div>
                ))
              )}
            </section>
          )}
          <footer>
            <span>
              <Icon name="lock" size={13} /> Local workspace. Official YouTube
              API.
            </span>
            <span>
              <a href="https://www.youtube.com/t/terms" target="_blank" rel="noreferrer">YouTube terms</a>
              {" · "}
              <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google privacy</a>
              {" · "}
              <a href="https://github.com/mmhfarooque/clipdock/blob/main/PRIVACY.md" target="_blank" rel="noreferrer">ClipDock privacy</a>
            </span>
          </footer>
        </div>
      </main>
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              aria-label="Close dialog"
              onClick={() => setModal(null)}
            >
              <Icon name="close" />
            </button>
            {error && (
              <div className="banner error" role="alert">
                {error}
              </div>
            )}
            {modal === "import" && (
              <>
                <span className="dialog-icon">
                  <Icon name="folder" size={28} />
                </span>
                <h2 id="modal-title">Bring your videos aboard.</h2>
                <p>
                  Enter a folder path on this computer. ClipDock scans it and
                  its immediate subfolders for final videos, SRT captions and
                  upload logs.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    act(async () => {
                      const r = await api("import", { folder });
                      setNotice(`Imported ${r.imported} video folders.`);
                      setModal(null);
                    });
                  }}
                >
                  <label>
                    Episode folder or library folder
                    <input
                      autoFocus
                      value={folder}
                      onChange={(e) => setFolder(e.target.value)}
                      placeholder={
                        navigator.platform.includes("Win")
                          ? "C:\\Videos\\My Shorts"
                          : "/home/you/Videos/My Shorts"
                      }
                      required
                    />
                  </label>
                  <p className="hint">
                    Prefers final-video-captioned.mp4. Reads Title, Description
                    and Tags sections from UPLOAD_LOG.md. Files stay in place.
                  </p>
                  <button className="primary full" disabled={working}>
                    {working ? "Reading folder…" : "Import folder"}
                  </button>
                </form>
              </>
            )}
            {modal === "settings" && (
              <>
                <span className="dialog-icon">
                  <Icon name="settings" size={28} />
                </span>
                <h2 id="modal-title">Connect your channel.</h2>
                <p>
                  Sign in through Google in your browser. ClipDock never asks
                  for your Google password.
                </p>
                <ol className="setup-steps">
                  <li>
                    In Google Cloud, enable <b>YouTube Data API v3</b> and
                    configure your OAuth consent screen. Add yourself as a test
                    user if the app is in testing.
                  </li>
                  <li>
                    Create a <b>Web application</b> OAuth client. Add this exact
                    authorised redirect URI:
                    <code>
                      {data.redirectUri ||
                        "http://127.0.0.1:3210/oauth/callback"}
                    </code>
                  </li>
                  <li>Download its client JSON and import it here.</li>
                </ol>
                <label className="file-upload">
                  Google OAuth client JSON
                  <input
                    type="file"
                    accept=".json,application/json"
                    disabled={working || data.busy}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file)
                        act(async () => {
                          await api(
                            "oauth/config",
                            JSON.parse(await file.text()),
                          );
                          setNotice(
                            "Google client imported. You can now sign in.",
                          );
                        });
                    }}
                  />
                </label>
                <p className="hint">
                  Credentials stay in your OS user configuration directory,
                  outside the repository. Permission includes YouTube management
                  because caption uploads require it.
                </p>
                <div className="connection-state">
                  <span className={data.connected ? "dot connected" : "dot"} />
                  {data.connected
                    ? `${data.channel.title} · ${data.channel.id}`
                    : data.configured
                      ? "Google client configured · not connected"
                      : "No Google client configured"}
                </div>
                <button
                  className="primary full"
                  disabled={!data.configured || working || data.busy}
                  onClick={() =>
                    act(async () => {
                      const { url } = await api("oauth/start", {});
                      window.location.assign(url);
                    })
                  }
                >
                  {data.connected
                    ? "Connect a different channel"
                    : "Sign in with Google"}
                  <Icon name="arrow" size={17} />
                </button>
                {data.connected && (
                  <button
                    className="quiet full"
                    disabled={working || data.busy}
                    onClick={() =>
                      act(async () => {
                        const r = await api("oauth/disconnect", {});
                        setNotice(
                          r.revoked
                            ? "Disconnected and removed local tokens."
                            : "Local tokens removed. Google revocation could not be confirmed; revoke access in your Google account.",
                        );
                      })
                    }
                  >
                    Disconnect channel
                  </button>
                )}
                <a
                  className="help-link"
                  href="https://console.cloud.google.com/apis/dashboard"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open Google Cloud Console ↗
                </a>
              </>
            )}
            {modal === "upload" && (
              <>
                <span className="dialog-icon">
                  <Icon name="upload" size={28} />
                </span>
                <h2 id="modal-title">Ready for a private upload?</h2>
                <p>
                  Upload {chosen.length}{" "}
                  {chosen.length === 1 ? "video" : "videos"} to{" "}
                  <b>{data.channel?.title || "your channel"}</b>. Review them in
                  YouTube Studio before publishing.
                </p>
                <div className="review-list">
                  {chosen.map((e) => (
                    <div key={e.id}>
                      <Icon name="play" size={15} />
                      <span>{metadata(e).title}</span>
                      <small>Private</small>
                    </div>
                  ))}
                </div>
                <p className="hint">
                  Your latest edits are saved before uploading. Audience and AI
                  disclosure follow each video’s settings. ClipDock won’t
                  publish, schedule or send subscriber notifications.
                </p>
                {!data.connected && (
                  <div className="banner">
                    Connect YouTube in settings first.
                  </div>
                )}
                <label className="confirm">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />
                  I reviewed the content, rights, audience and AI disclosure,
                  and want to upload these videos privately to this channel.
                </label>
                <button
                  className="primary full"
                  disabled={
                    !confirmed || !data.connected || working || data.busy
                  }
                  onClick={() =>
                    act(async () => {
                      for (const e of chosen) await save(e);
                      await api("queue", {
                        ids: chosen.map((e) => e.id),
                        confirmPrivate: true,
                        channelId: data.channel.id,
                      });
                      setTab("queue");
                      setModal(null);
                      setSelected([]);
                    })
                  }
                >
                  {working ? "Preparing…" : "Upload privately"}
                  <Icon name="upload" size={17} />
                </button>
              </>
            )}
          </section>
        </div>
      )}
      {preview && (
        <div className="modal-backdrop" onClick={() => setPreview(null)}>
          <section
            className="video-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Video preview"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="icon-button"
              aria-label="Close preview"
              onClick={() => setPreview(null)}
            >
              <Icon name="close" />
            </button>
            <video src={"/media/" + preview.id} controls autoPlay playsInline />
            <p>{metadata(preview).title}</p>
          </section>
        </div>
      )}
    </div>
  );
}
function MetadataForm({ episode, value, update, disabled }) {
  return (
    <fieldset disabled={disabled} className="metadata-form">
      <label>
        Title <span>{[...value.title].length}/100</span>
        <input
          value={value.title}
          maxLength={100}
          onChange={(e) => update("title", e.target.value)}
        />
      </label>
      <label>
        Description
        <textarea
          rows="6"
          value={value.description}
          onChange={(e) => update("description", e.target.value)}
        />
      </label>
      <label>
        Tags <small>Separate with commas</small>
        <textarea
          rows="3"
          value={Array.isArray(value.tags) ? value.tags.join(", ") : value.tags}
          onChange={(e) => update("tags", e.target.value)}
        />
      </label>
      <div className="field-row">
        <label>
          Category
          <select
            value={value.categoryId}
            onChange={(e) => update("categoryId", e.target.value)}
          >
            <option value="26">Howto & Style</option>
            <option value="27">Education</option>
            <option value="24">Entertainment</option>
            <option value="22">People & Blogs</option>
            <option value="28">Science & Technology</option>
          </select>
        </label>
        <label>
          Language
          <input
            value={value.language}
            onChange={(e) => update("language", e.target.value)}
            placeholder="en"
          />
        </label>
      </div>
      <label>
        Audience
        <select
          value={String(value.madeForKids)}
          onChange={(e) => update("madeForKids", e.target.value === "true")}
        >
          <option value="false">Not made for kids</option>
          <option value="true">Made for kids</option>
        </select>
      </label>
      <label>
        Realistic altered or AI-generated content
        <select
          value={String(value.synthetic)}
          onChange={(e) => update("synthetic", e.target.value === "true")}
        >
          <option value="true">Yes — disclose AI content</option>
          <option value="false">No</option>
        </select>
      </label>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={value.uploadCaptions}
          disabled={!episode.captions || disabled}
          onChange={(e) => update("uploadCaptions", e.target.checked)}
        />
        Upload separate SRT caption track
      </label>
      <p className="hint">
        {episode.captions
          ? "Optional: burned-in captions already appear in your captioned video. A separate track can appear twice when CC is enabled."
          : "Add captions.srt to the episode folder, then refresh to enable this."}
      </p>
      <div className="private-note">
        <Icon name="lock" size={16} />
        <span>
          Uploads are private. Publish from YouTube Studio when ready.
        </span>
      </div>
    </fieldset>
  );
}
createRoot(document.getElementById("root")).render(<App />);
