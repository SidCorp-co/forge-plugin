/* A stamp nobody removes is a file per session per subject per kind: 29,626 of them took a machine's
   temp filesystem to 97% of its inodes and killed a browser suite before its first test. So the room
   is proven, and so is the sweep — planted with an old mtime, gone after one write. */
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { tempHome } from "../fixtures.mjs";

import { STAMP_MS, askedAlready, askedByAnyone, stampRoom } from "../../src/hooks/stamps.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(HERE, "..", "..", "src", "hooks", "stamps.mjs");
/* Its own temp root, so the machine's is neither read nor added to: `tmpdir()` answers per call. */
const ROOT = tempHome("stamps").path;
process.env.TMPDIR = ROOT;

const EV = { session_id: "1bd89a37" };

const plant = (name, ageMs) => {
  const at = join(stampRoom(), name);
  mkdirSync(stampRoom(), { recursive: true });
  writeFileSync(at, "");
  const when = (Date.now() - ageMs) / 1000;
  utimesSync(at, when, when);
  return at;
};

test("every stamp lands in one room named for the plugin, which the first write makes", () => {
  assert.equal(dirname(stampRoom()), tmpdir(), "under the temp root");
  assert.match(basename(stampRoom()), /^forge-hook-stamps-/u, "its name says whose they are");
  assert.notEqual(basename(stampRoom()), "forge-hook-stamps-one", "and which user's, where the platform says");
  assert.equal(existsSync(stampRoom()), false, "nothing has written one yet");
  assert.equal(askedAlready(EV, "/w/one.md", "learning-gate"), false, "asked for the first time");
  assert.equal(askedAlready(EV, "/w/one.md", "learning-gate"), true, "and the second ask reads it back");
  assert.deepEqual(readdirSync(ROOT), [basename(stampRoom())], "the temp root gained the room and nothing loose");
  assert.deepEqual(readdirSync(stampRoom()).map((one) => one.split("-").slice(0, -1).join("-")), ["learning-gate"]);
});

test("one write sweeps every kind past the bound and leaves the ones inside it", () => {
  const stale = ["codex-turn-1111111111111111", "code-quality-2222222222222222"]
    .map((name) => plant(name, STAMP_MS + 60_000));
  const live = plant("derive-dont-list-3333333333333333", STAMP_MS - 60_000);
  assert.equal(askedAlready(EV, "/w/two.md", "learning-gate"), false, "the write that pays for the sweep");
  for (const at of stale) assert.equal(existsSync(at), false, `${basename(at)} was past the bound`);
  assert.equal(existsSync(live), true, "and one inside it is a live session's memory");
});

test("an ask that sets nothing writes nothing and sweeps nothing", () => {
  const stale = plant("codex-order-4444444444444444", STAMP_MS + 60_000);
  const before = readdirSync(stampRoom()).sort();
  assert.equal(askedAlready(EV, "/w/three.md", "learning-gate", { set: false }), false, "and answers the same");
  assert.deepEqual(readdirSync(stampRoom()).sort(), before, "nothing written");
  assert.equal(existsSync(stale), true, "and nothing removed either");
});

test("a write that cannot land has already paid for the sweep", () => {
  const stale = plant("codex-turn-5555555555555555", STAMP_MS + 60_000);
  const past = "x".repeat(300);
  assert.equal(askedAlready(EV, "/w/five.md", past), false, "a name no filesystem takes, so nothing is written");
  assert.equal(existsSync(stale), false, "and the sweep ran anyway — a temp root out of inodes is the case");
});

test("the ask that drops the session shares the room", () => {
  assert.equal(askedByAnyone({ session_id: "a" }, "/w/four.md", "learning-landed"), false);
  assert.equal(askedByAnyone({ session_id: "b" }, "/w/four.md", "learning-landed"), true, "keyed for anyone");
  assert.equal(askedAlready({ session_id: "b" }, "/w/four.md", "learning-landed"), false, "one session's is its own");
  const kinds = new Set(readdirSync(stampRoom()).map((one) => one.split("-").slice(0, -1).join("-")));
  assert.ok(kinds.has("learning-landed"), "and both of them stamp in the one room");
  assert.deepEqual(readdirSync(ROOT), [basename(stampRoom())], "with the temp root still holding only it");
});

test("the bound is a day, and it carries its reason where it is set", () => {
  assert.equal(STAMP_MS, 24 * 60 * 60 * 1000, "a session does not last one");
  const above = readFileSync(SOURCE, "utf8").split(/^export const STAMP_MS/mu)[0].trimEnd().split("\n").at(-1);
  assert.match(above, /^\s*\*/u, "the lines above the bound argue for it");
});

test("the harness hands the gates these very functions", async () => {
  const harness = await import("../../hooks/_hook.mjs");
  assert.equal(harness.askedAlready, askedAlready, "so no gate's import has to move");
  assert.equal(harness.askedByAnyone, askedByAnyone);
});
