import { createHash, randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  readFile,
  realpath,
  readdir,
  stat,
  writeFile,
  rename,
  mkdir,
} from "node:fs/promises";
import path from "node:path";

export async function atomicJSON(file, data) {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temp = `${file}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
  await writeFile(temp, JSON.stringify(data, null, 2) + "\n", { mode: 0o600 });
  await rename(temp, file);
}
export async function readJSON(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (e) {
    if (e.code === "ENOENT") return fallback;
    throw e;
  }
}
export async function digest(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}
export function parseLog(markdown = "") {
  const section = (name) => {
    const match = markdown.match(
      new RegExp(`^## ${name}\\s*\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, "m"),
    );
    return match?.[1]?.trim() || "";
  };
  return {
    title: section("Title").split("\n")[0].trim(),
    description: section("Description"),
    tags: section("Tags")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}
export function validateMetadata(value) {
  const title = String(value.title || "").trim();
  const description = String(value.description || "").trim();
  const tags = (
    Array.isArray(value.tags) ? value.tags : String(value.tags || "").split(",")
  )
    .map((s) => String(s).trim())
    .filter(Boolean);
  if (!title || [...title].length > 100 || /[<>]/.test(title))
    throw new Error("Title must be 1–100 characters without < or >.");
  if (Buffer.byteLength(description) > 5000 || /[<>]/.test(description))
    throw new Error(
      "Description must be under 5,000 UTF-8 bytes without < or >.",
    );
  if (
    tags.reduce(
      (n, s) => n + s.length + (s.includes(" ") ? 2 : 0),
      Math.max(0, tags.length - 1),
    ) > 500
  )
    throw new Error("Tags exceed YouTube’s 500-character limit.");
  const categoryId = String(value.categoryId || "26");
  if (!/^\d+$/.test(categoryId)) throw new Error("Choose a valid category.");
  const language = String(value.language || "en");
  if (!/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(language))
    throw new Error("Use a language code such as en or en-US.");
  if (
    typeof value.madeForKids !== "boolean" ||
    typeof value.synthetic !== "boolean"
  )
    throw new Error("Confirm audience and AI disclosure.");
  return {
    title,
    description,
    tags,
    categoryId,
    language,
    madeForKids: value.madeForKids,
    synthetic: value.synthetic,
    uploadCaptions: Boolean(value.uploadCaptions),
  };
}
export function videoBody(metadata) {
  const m = validateMetadata(metadata);
  return {
    snippet: {
      title: m.title,
      description: m.description,
      tags: m.tags,
      categoryId: m.categoryId,
      defaultLanguage: m.language,
      defaultAudioLanguage: m.language,
    },
    status: {
      privacyStatus: "private",
      license: "youtube",
      selfDeclaredMadeForKids: m.madeForKids,
      containsSyntheticMedia: m.synthetic,
      embeddable: true,
    },
  };
}
export async function asset(folder, name) {
  const base = await realpath(folder),
    target = await realpath(path.join(base, name));
  if (path.dirname(target) !== base)
    throw new Error("Asset must be a regular file inside its episode folder.");
  if (!(await stat(target)).isFile()) throw new Error("Asset is not a file.");
  return target;
}
export async function scanEpisodes(root) {
  root = await realpath(root);
  if (!(await stat(root)).isDirectory()) throw new Error("Select a folder.");
  const folders = [root];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.isDirectory() && !entry.name.startsWith("."))
      folders.push(path.join(root, entry.name));
  }
  const episodes = [];
  for (const folder of folders) {
    const entries = await readdir(folder, { withFileTypes: true });
    const files = entries.filter((e) => e.isFile()).map((e) => e.name);
    const video =
      [
        "final-video-captioned.mp4",
        "final-video.mp4",
        "kling-original.mp4",
        "video.mp4",
      ].find((n) => files.includes(n)) ||
      files.find((n) => /\.(mp4|mov|webm)$/i.test(n));
    if (!video) continue;
    const logName = files.includes("UPLOAD_LOG.md") ? "UPLOAD_LOG.md" : null;
    const log = logName
      ? await readFile(await asset(folder, logName), "utf8")
      : "";
    const parsed = parseLog(log);
    const id = createHash("sha256").update(folder).digest("hex").slice(0, 20);
    episodes.push({
      id,
      folder,
      name: path.basename(folder),
      video,
      bytes: (await stat(await asset(folder, video))).size,
      captions: files.includes("captions.srt") ? "captions.srt" : null,
      metadata: {
        title: parsed.title || path.basename(folder).replace(/^\d+[- ]*/, ""),
        description: parsed.description,
        tags: parsed.tags,
        categoryId: "26",
        language: "en",
        madeForKids: false,
        synthetic: true,
        uploadCaptions: false,
      },
    });
  }
  return episodes.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true }),
  );
}

// Keep a write-ahead receipt before sending a video. An interrupted/uncertain
// request requires manual reconciliation; retry never blindly creates a duplicate.
export async function uploadOnce({
  episode,
  metadata,
  channel,
  ledger,
  save,
  youtube,
  progress = () => {},
}) {
  const body = videoBody(metadata);
  const video = await asset(episode.folder, episode.video);
  const hash = await digest(video),
    key = `${channel.id}:${hash}`;
  if (ledger[key])
    throw new Error(
      `Already recorded: ${ledger[key].videoId || ledger[key].state}. Check upload history; do not upload again.`,
    );
  const receipt = {
    key,
    hash,
    channelId: channel.id,
    title: metadata.title,
    episode: episode.name,
    state: "uploading",
    startedAt: new Date().toISOString(),
    videoId: null,
    captions: "not requested",
  };
  ledger[key] = receipt;
  await save(ledger);
  try {
    const mimeType =
      path.extname(video).toLowerCase() === ".webm"
        ? "video/webm"
        : path.extname(video).toLowerCase() === ".mov"
          ? "video/quicktime"
          : "video/mp4";
    const response = await youtube.videos.insert(
      {
        part: ["snippet", "status"],
        notifySubscribers: false,
        requestBody: body,
        media: { mimeType, body: createReadStream(video) },
      },
      {
        retry: false,
        onUploadProgress: (event) =>
          progress(event.bytesRead || event.loaded || 0),
      },
    );
    if (!response.data.id)
      throw new Error("YouTube did not return a video ID.");
    receipt.videoId = response.data.id;
    receipt.url = `https://www.youtube.com/watch?v=${response.data.id}`;
    receipt.state = "uploaded";
    receipt.returnedPrivacy = response.data.status?.privacyStatus || "unknown";
    await save(ledger); // persist the ID before touching captions
    if (metadata.uploadCaptions && episode.captions) {
      receipt.captions = "pending";
      await save(ledger);
      try {
        const caption = await asset(episode.folder, episode.captions);
        const result = await youtube.captions.insert(
          {
            part: ["snippet"],
            requestBody: {
              snippet: {
                videoId: receipt.videoId,
                language: metadata.language,
                name: `${metadata.language} subtitles`,
                isDraft: false,
              },
            },
            media: {
              mimeType: "application/octet-stream",
              body: createReadStream(caption),
            },
          },
          { retry: false },
        );
        receipt.captions = "uploaded";
        receipt.captionId = result.data.id;
      } catch {
        receipt.captions =
          "failed — video is saved; add the SRT in YouTube Studio";
      }
    }
    receipt.finishedAt = new Date().toISOString();
    await save(ledger);
    return receipt;
  } catch (error) {
    receipt.state = receipt.videoId ? "uploaded" : "needs reconciliation";
    receipt.error =
      "Upload interrupted or rejected. Check YouTube Studio before any retry.";
    await save(ledger);
    throw new Error(
      `${receipt.error} ${error.response?.status ? `HTTP ${error.response.status}.` : ""}`,
    );
  }
}
