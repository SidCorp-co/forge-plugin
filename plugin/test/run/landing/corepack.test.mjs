/* The Corepack home a landing's gate runs `npm` under. Where `npm` is Corepack's shim, a room with
   no Corepack home of its own fetches npm from the registry before every gate, so a land-ready case
   went red whenever the network did (ISS-2512); and a room pointed at the developer's own would let
   Corepack write there. */
import assert from "node:assert/strict";
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join, sep } from "node:path";
import test from "node:test";

import { tempRoom } from "../../fixtures.mjs";
import { COREPACK, DEVELOPER_COREPACK, lendCorepack, tracker } from "./fixture.mjs";

/* No case here asks the tracker anything, so it is let go rather than closed and read for its routes. */
tracker.unref();

/** Every entry under a directory with what a write would move, links read and never followed. */
const entries = (root, at = root) => readdirSync(at).flatMap((name) => {
  const path = join(at, name);
  const seen = lstatSync(path);
  const kind = seen.isSymbolicLink() ? "link" : seen.isDirectory() ? "dir" : "file";
  const body = kind === "file" ? readFileSync(path, "utf8") : "";
  const own = `${path.slice(root.length)} ${kind} ${seen.mode} ${seen.mtimeMs} ${body}`;
  return kind === "dir" ? [own, ...entries(root, path)] : [own];
}).sort();

const developerCache = () => {
  const from = tempRoom("corepack-developer-");
  mkdirSync(join(from, "v1", "npm", "9.9.9"), { recursive: true });
  mkdirSync(join(from, "v1", "pnpm", "8.0.0"), { recursive: true });
  writeFileSync(join(from, "v1", "npm", "9.9.9", ".corepack"), "{}");
  writeFileSync(join(from, "lastKnownGood.json"), '{ "npm": "9.9.9" }\n');
  return from;
};

test("the landing's gate runs under a Corepack home inside the case's own HOME, a directory rather than a link", () => {
  assert.equal(process.env.COREPACK_HOME, COREPACK);
  assert.ok(COREPACK.startsWith(`${process.env.HOME}${sep}`), `${COREPACK} is outside HOME ${process.env.HOME}`);
  assert.equal(lstatSync(COREPACK).isDirectory(), true);
});

test("a lent Corepack home links each installed version to the developer's own and holds a copy of the pin", () => {
  const from = developerCache();
  const to = join(tempRoom("corepack-room-"), "corepack");
  lendCorepack(from, to);
  for (const [manager, version] of [["npm", "9.9.9"], ["pnpm", "8.0.0"]]) {
    assert.equal(lstatSync(join(to, "v1", manager)).isDirectory(), true, `${manager} is the room's own directory`);
    assert.equal(lstatSync(join(to, "v1", manager, version)).isSymbolicLink(), true);
    assert.equal(realpathSync(join(to, "v1", manager, version)), realpathSync(join(from, "v1", manager, version)));
  }
  assert.equal(lstatSync(join(to, "lastKnownGood.json")).isFile(), true);
  assert.equal(readFileSync(join(to, "lastKnownGood.json"), "utf8"), readFileSync(join(from, "lastKnownGood.json"), "utf8"));
});

test("a pin Corepack moves and a version it installs in a lent home leave the developer's cache as it was", () => {
  const from = developerCache();
  const to = join(tempRoom("corepack-room-"), "corepack");
  const before = entries(from);
  lendCorepack(from, to);
  writeFileSync(join(to, "lastKnownGood.json"), '{ "npm": "10.0.0" }\n');
  mkdirSync(join(to, "v1", "npm", "10.0.0"));
  writeFileSync(join(to, "v1", "npm", "10.0.0", ".corepack"), "{}");
  assert.deepEqual(entries(from), before);
});

test("the room lends every version this machine's own Corepack cache holds", {
  skip: !existsSync(join(DEVELOPER_COREPACK, "v1")) && "this machine's Corepack cache holds no installed version",
}, () => {
  const layout = join(DEVELOPER_COREPACK, "v1");
  for (const manager of readdirSync(layout)) {
    for (const version of readdirSync(join(layout, manager))) {
      assert.equal(realpathSync(join(COREPACK, "v1", manager, version)), realpathSync(join(layout, manager, version)));
    }
  }
});
