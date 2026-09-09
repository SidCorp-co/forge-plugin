/* The record across a release commit, on the gate runner's own scratch checkout: what the bump
   costs when nothing carries it, what carrying it buys, and the nine trees it refuses to carry. */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import { acrossVersion, carryPasses, passesHeld } from "../../../../tools/gates/carried.mjs";
import { STEPS } from "../../../../tools/gates/steps.mjs";
import { tempRoom } from "../../fixtures.mjs";
import { entries, git, landed, passesFor, run, scratch, write } from "./scratch.mjs";

const MANIFEST = join(".claude-plugin", "plugin.json");
const LOCK = "package-lock.json";
const PACKAGE = "package.json";
const WROTE = [PACKAGE, LOCK, MANIFEST];
const SOURCE = join("plugin", "src", "one.mjs");

const json = (held) => `${JSON.stringify(held, null, 2)}\n`;
const read = (work, path) => JSON.parse(readFileSync(join(work, path), "utf8"));

const manifestAt = (version) => json({ name: "scratch", version });

/* Shaped like a real lock file: the root package's second copy of the version a release writes, a
   dependency's own, which is content like any other, and where a case asks for them, a root version
   left out altogether and a field nested one level below the one the locator names. */
const lockAt = (version, { dep = "4.10.1", root = version, nested = null } = {}) => json({
  name: "scratch", version,
  packages: {
    "": {
      name: "scratch",
      ...(root === null ? {} : { version: root }),
      ...(nested === null ? {} : { packages: { "": { version: nested } } }),
    },
    "node_modules/dep": { version: dep },
  },
});

const committed = (work, files) => {
  for (const [path, text] of Object.entries(files)) write(work, path, text);
  git(work, "add", ...Object.keys(files));
  git(work, "commit", "-m", "chore(release)");
};

const release = (work, version, { manifest = version, files = {}, ...lock } = {}) =>
  committed(work, {
    [PACKAGE]: json({ ...read(work, PACKAGE), version }),
    [LOCK]: lockAt(version, lock),
    [MANIFEST]: manifestAt(manifest),
    ...files,
  });

/* A checkout whose every step the record holds green, with the two manifests a release writes
   beside its package: gated on master with nothing differing, which is the head a release sits on. */
const gated = (name, plant = () => ({})) => {
  const { at, work } = scratch(name);
  landed(work, LOCK, lockAt("1.0.0"));
  landed(work, MANIFEST, manifestAt("1.0.0"));
  for (const [path, text] of Object.entries(plant(work))) landed(work, path, text);
  git(work, "checkout", "master");
  git(work, "merge", "work");
  const said = run(work);
  assert.equal(said.status, 0, said.stdout + said.stderr);
  assert.match(said.stdout, /the full gate — nothing differs from master/u, said.stdout);
  return { at, work };
};

const refused = (name, mutate, plant = undefined) => {
  const { at, work } = gated(name, plant);
  try {
    const held = passesHeld(work, WROTE);
    const before = entries(work);
    const said = mutate(work, held);
    assert.deepEqual(entries(work), before, `${name} wrote to the record it had refused to carry`);
    return said;
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
};

test("a commit that bumps every release manifest leaves no step of the record green", () => {
  const { at, work } = gated("bumped");
  try {
    release(work, "1.0.1");
    const again = run(work);
    assert.match(again.stdout, /the full gate — nothing differs from master/u, again.stdout);
    assert.match(again.stdout, new RegExp(`ledger: 0 of ${STEPS.length} step\\(s\\) green already`, "u"), again.stdout);
    assert.match(again.stdout, new RegExp(`All ${STEPS.length} gate step\\(s\\) passed`, "u"), again.stdout);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

test("the passes read before that commit and carried after it leave every step green and none spent", () => {
  const { at, work } = gated("carried");
  try {
    const held = passesHeld(work, WROTE);
    assert.equal(held.kept.length, STEPS.length, JSON.stringify(held.kept));
    release(work, "1.0.1");
    assert.match(carryPasses(work, held, WROTE),
      new RegExp(`${STEPS.length} of ${STEPS.length} gate step\\(s\\) carried onto this content`, "u"));
    for (const step of STEPS) {
      assert.equal(passesFor(work, step.label).length, 2, `${step.label} holds one content after the carry, `
        + `so the pass the gate judged was replaced rather than joined: ${Object.keys(entries(work)).join(", ")}`);
    }

    const again = run(work);
    assert.match(again.stdout, new RegExp(`ledger: ${STEPS.length} of ${STEPS.length} step\\(s\\) green already`, "u"), again.stdout);
    assert.match(again.stdout, /All 0 gate step\(s\) passed/u, again.stdout);
    assert.equal(again.status, 0, again.stdout + again.stderr);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

test("a source file that moved beside the bump carries nothing, and is the path named", () => {
  const said = refused("stranger", (work, held) => {
    release(work, "1.0.1", { files: { [SOURCE]: "export const one = 11;\n" } });
    return carryPasses(work, held, WROTE);
  });
  assert.match(said, /^no pass was carried: plugin\/src\/one\.mjs moved since the gate read this tree/u, said);
});

test("a path that appeared between the two reads carries nothing, tracked by git or not", () => {
  const said = refused("appeared", (work, held) => {
    release(work, "1.0.1");
    write(work, join("plugin", "src", "stray.mjs"), "export const stray = true;\n");
    return carryPasses(work, held, WROTE);
  });
  assert.match(said, /no pass was carried: plugin\/src\/stray\.mjs moved since the gate read this tree/u, said);
});

test("a dependency's own version moved inside the lock file carries nothing", () => {
  const said = refused("dependency", (work, held) => {
    release(work, "1.0.1", { dep: "4.11.0" });
    return carryPasses(work, held, WROTE);
  });
  assert.match(said, /no pass was carried: package-lock\.json moved in more than the version a release writes/u, said);
});

test("a bump that left a release manifest behind carries nothing", () => {
  const said = refused("behind", (work, held) => {
    committed(work, { [PACKAGE]: json({ ...read(work, PACKAGE), version: "1.0.1" }), [LOCK]: lockAt("1.0.1") });
    return carryPasses(work, held, WROTE);
  });
  assert.match(said, /a release writes one version into every file it writes/u, said);
  assert.match(said, /\.claude-plugin\/plugin\.json at 1\.0\.0/u, said);
});

test("a bump that dropped the lock file's root version carries nothing", () => {
  const said = refused("dropped", (work, held) => {
    release(work, "1.0.1", { root: null });
    return carryPasses(work, held, WROTE);
  });
  assert.match(said, /no pass was carried: package-lock\.json holds no version string where a release writes one/u, said);
});

test("a bump that wrote a number where a release writes a version carries nothing", () => {
  const said = refused("numbered", (work, held) => {
    committed(work, {
      [PACKAGE]: json({ ...read(work, PACKAGE), version: 2 }),
      [LOCK]: json({
        name: "scratch", version: 2,
        packages: { "": { name: "scratch", version: 2 }, "node_modules/dep": { version: "4.10.1" } },
      }),
      [MANIFEST]: json({ name: "scratch", version: 2 }),
    });
    return carryPasses(work, held, WROTE);
  });
  assert.match(said, /holds no version string where a release writes one/u, said);
});

/* One level below the location the locator names, so a reader that recursed would excuse it. */
test("a version nested below the lock file's root package is content, and moving it carries nothing", () => {
  const said = refused("nested", (work, held) => {
    release(work, "1.0.1", { nested: "9.9.9" });
    return carryPasses(work, held, WROTE);
  }, () => ({ [LOCK]: lockAt("1.0.0", { nested: "1.0.0" }) }));
  assert.match(said, /no pass was carried: package-lock\.json moved in more than the version a release writes/u, said);
});

test("a packages entry inside package.json is content, and moving its version carries nothing", () => {
  const said = refused("packaged", (work, held) => {
    const was = read(work, PACKAGE);
    release(work, "1.0.1", { files: { [PACKAGE]: json({ ...was, version: "1.0.1", packages: { "": { version: "9.9.9" } } }) } });
    return carryPasses(work, held, WROTE);
  }, (work) => ({ [PACKAGE]: json({ ...read(work, PACKAGE), packages: { "": { version: "1.0.0" } } }) }));
  assert.match(said, /no pass was carried: package\.json moved in more than the version a release writes/u, said);
});

test("a record the landing cannot read is reported, and the version is written anyway", () => {
  const at = tempRoom("unreadable-");
  try {
    const said = [];
    let bumped = false;
    const made = acrossVersion(at, WROTE, () => {
      bumped = true;
      return "1.0.1";
    }, (line) => said.push(line));
    assert.equal(bumped, true, "a record it could not read stopped the release");
    assert.equal(made, "1.0.1");
    assert.equal(said.length, 1, said.join("\n"));
    assert.match(said[0], /the gate's record holds could not be read, so this release carries none of it/u, said[0]);
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});

test("a bump that wrote a different version into each manifest carries nothing", () => {
  const said = refused("disagreed", (work, held) => {
    release(work, "1.0.1", { manifest: "2.0.0" });
    return carryPasses(work, held, WROTE);
  });
  assert.match(said, /a release writes one version into every file it writes/u, said);
  assert.match(said, /\.claude-plugin\/plugin\.json at 2\.0\.0/u, said);
});
