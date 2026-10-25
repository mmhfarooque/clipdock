import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir, symlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  scanEpisodes,
  parseLog,
  videoBody,
  validateMetadata,
  uploadOnce,
  asset,
} from "../src/core.mjs";
const metadata = {
  title: "A useful tip",
  description: "An illustrated demonstration.",
  tags: ["home tips"],
  categoryId: "26",
  language: "en",
  madeForKids: false,
  synthetic: true,
  uploadCaptions: true,
};
async function fixture(t) {
  const folder = await mkdtemp(path.join(tmpdir(), "clipdock-test-"));
  t.after(() => rm(folder, { recursive: true, force: true }));
  await writeFile(
    path.join(folder, "final-video-captioned.mp4"),
    "test-video-bytes",
  );
  await writeFile(
    path.join(folder, "captions.srt"),
    "1\n00:00:00,000 --> 00:00:01,000\nHello\n",
  );
  return {
    id: "one",
    folder,
    name: "Episode 1",
    video: "final-video-captioned.mp4",
    captions: "captions.srt",
  };
}
const consume = async (stream) => {
  for await (const _chunk of stream) {
    /* consume test input */
  }
};
test("import reads markdown metadata and prefers the captioned final over originals", async (t) => {
  const e = await fixture(t);
  await writeFile(path.join(e.folder, "video.mp4"), "original");
  await writeFile(
    path.join(e.folder, "UPLOAD_LOG.md"),
    "# Upload\n\n## Title\n\nA real title\n\n## Description\n\nLine one.\n\nLine two.\n\n## Tags\n\nfruit, home tips\n\n## Status\nNot uploaded.",
  );
  const episodes = await scanEpisodes(e.folder);
  assert.equal(episodes.length, 1);
  assert.equal(episodes[0].video, e.video);
  assert.equal(episodes[0].metadata.title, "A real title");
  assert.equal(episodes[0].metadata.description, "Line one.\n\nLine two.");
  assert.deepEqual(episodes[0].metadata.tags, ["fruit", "home tips"]);
});
test("markdown parser handles a last section without trailing newline", () => {
  assert.deepEqual(parseLog("## Tags\n\na, b").tags, ["a", "b"]);
});
test("metadata explicitly sets private visibility, audience and AI declaration", () => {
  const body = videoBody(metadata);
  assert.equal(body.status.privacyStatus, "private");
  assert.equal(body.status.selfDeclaredMadeForKids, false);
  assert.equal(body.status.containsSyntheticMedia, true);
  assert.throws(() =>
    validateMetadata({ ...metadata, title: "x".repeat(101) }),
  );
  assert.throws(() =>
    validateMetadata({ ...metadata, description: "🙂".repeat(1300) }),
  );
  assert.throws(() =>
    validateMetadata({ ...metadata, madeForKids: undefined }),
  );
  assert.throws(() =>
    validateMetadata({ ...metadata, tags: ["a".repeat(501)] }),
  );
});
test("records video ID before captions and refuses repeat content on the same channel", async (t) => {
  const episode = await fixture(t),
    ledger = {},
    snapshots = [];
  let count = 0;
  const youtube = {
    videos: {
      insert: async (request) => {
        count++;
        assert.equal(request.requestBody.status.privacyStatus, "private");
        assert.equal(snapshots[0][Object.keys(ledger)[0]].state, "uploading");
        await consume(request.media.body);
        return {
          data: { id: "video123", status: { privacyStatus: "private" } },
        };
      },
    },
    captions: {
      insert: async (request) => {
        assert.equal(Object.values(ledger)[0].videoId, "video123");
        assert.equal(Object.values(snapshots.at(-1))[0].videoId, "video123");
        await consume(request.media.body);
        throw new Error("caption unavailable");
      },
    },
  };
  const args = {
    episode,
    metadata,
    channel: { id: "channel1" },
    ledger,
    youtube,
    save: async (l) => snapshots.push(structuredClone(l)),
  };
  const result = await uploadOnce(args);
  assert.equal(result.state, "uploaded");
  assert.match(result.captions, /^failed/);
  await assert.rejects(uploadOnce(args), /Already recorded/);
  assert.equal(count, 1);
});
test("network uncertainty blocks a blind retry instead of silently duplicating", async (t) => {
  const episode = await fixture(t),
    ledger = {};
  const args = {
    episode,
    metadata,
    channel: { id: "channel2" },
    ledger,
    save: async () => {},
    youtube: {
      videos: {
        insert: async (request) => {
          await consume(request.media.body);
          throw new Error("timeout");
        },
      },
    },
  };
  await assert.rejects(uploadOnce(args), /Check YouTube Studio/);
  assert.equal(Object.values(ledger)[0].state, "needs reconciliation");
  await assert.rejects(uploadOnce(args), /Already recorded/);
});
test(
  "symlink escape cannot expose files outside the imported folder",
  { skip: process.platform === "win32" },
  async (t) => {
    const e = await fixture(t);
    const outside = path.join(e.folder, "outside");
    await mkdir(outside);
    await writeFile(path.join(outside, "secret"), "secret");
    await symlink(
      path.join(outside, "secret"),
      path.join(e.folder, "escape.mp4"),
    );
    await assert.rejects(
      asset(e.folder, "escape.mp4"),
      /inside its episode folder/,
    );
  },
);
