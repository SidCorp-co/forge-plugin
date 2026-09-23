/* Which pair of copies the brief compares, off a plugin cache of the case's own: the copy present when
   the session started against the one installed after it, never the newest against itself. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import { tempRoom } from "../fixtures.mjs";
import { copiesFor } from "../../src/brief/copies.mjs";

const put = (root, files) => {
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(join(root, name), text);
  }
};

/** Copy A written, the session's start taken, then copy B installed after it and named by the record. */
const cacheWith = async (was, now) => {
  const home = tempRoom("brief-copies-");
  process.env.HOME = home;
  const cache = join(home, ".claude", "plugins", "cache", "forge-local", "forge");
  put(join(cache, "1.0.0"), was);
  /* Half a second clear of each copy: file times come off a coarser clock than Date.now. */
  const began = Date.now() + 500;
  await sleep(1_000);
  put(join(cache, "1.0.1"), now);
  writeFileSync(join(home, ".claude", "plugins", "installed_plugins.json"), JSON.stringify({
    plugins: { "forge@forge-local": [{ version: "1.0.1", installPath: join(cache, "1.0.1"), lastUpdated: new Date().toISOString() }] },
  }));
  return began;
};

test("a session started on the older copy compares it with the one installed after, and names the restart file", async () => {
  const began = await cacheWith({ "hooks/hooks.json": "{}", "src/a.mjs": "1" }, { "hooks/hooks.json": "{\"x\":1}", "src/a.mjs": "1" });
  const copies = copiesFor(began);
  assert.equal(copies.loaded, "1.0.0");
  assert.equal(copies.installed, "1.0.1");
  assert.deepEqual(copies.frozen, ["hooks/hooks.json"]);
});

test("copies differing in no restart-set file owe no restart", async () => {
  const began = await cacheWith({ "hooks/hooks.json": "{}", "src/a.mjs": "1" }, { "hooks/hooks.json": "{}", "src/a.mjs": "2" });
  const copies = copiesFor(began);
  assert.deepEqual(copies.moved, ["src/a.mjs"]);
  assert.deepEqual(copies.frozen, []);
});

test("a session started after the install loaded the installed copy, and nothing moved", async () => {
  await cacheWith({ "src/a.mjs": "1" }, { "src/a.mjs": "2" });
  const copies = copiesFor(Date.now() + 1_000);
  assert.equal(copies.loaded, "1.0.1");
  assert.deepEqual(copies.between, []);
});
