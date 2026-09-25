/* What the environment a child ran under says about whether it could have read this repository, which
   is what rules on one that left no record: where a name with no slash would be looked for, what
   could stand behind a builtin's name, and whether the program is one this tree holds (ISS-1793).
   Its own file because it asks about the environment rather than about per-file scoping. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";

import { auditEnv, recordsIn as recordsFrom, stepSetOf } from "../../../gates/reads/sets.mjs";
import { write } from "../scratch.mjs";
import { tempRoom } from "../../../../plugin/test/fixtures.mjs";

const FILE = "plugin/test/one.test.mjs";

// The module `auditEnv` preloads, named here as the caller of a spawn would already be naming it.
const PRELOAD = new URL("../../../gates/reads/audit.mjs", import.meta.url).href;

const room = (files = {}) => {
  const at = tempRoom("gate-environment-");
  const root = join(at, "checkout");
  for (const [path, text] of Object.entries({ [FILE]: "the test\n", ...files })) write(root, path, text);
  return { at, root };
};

const audited = (root, out, script) => {
  write(root, "ran.mjs", script);
  return spawnSync(process.execPath, [join(root, "ran.mjs")],
    { cwd: root, encoding: "utf8", env: { ...process.env, ...auditEnv(out, root) } });
};

const recordsIn = (out) => readdirSync(out).map((one) => JSON.parse(readFileSync(join(out, one), "utf8")));

// A search path entry elsewhere is no evidence that what it names is elsewhere.
test("a search path reaching this repository through a link outside it is recorded as reaching it", () => {
  const where = room({ "bin/helper": "#!/bin/sh\n" });
  const out = join(where.at, "out");
  const alias = join(where.at, "alias");
  mkdirSync(out, { recursive: true });
  symlinkSync(join(where.root, "bin"), alias);
  const ran = (path) => {
    rmSync(out, { recursive: true, force: true });
    mkdirSync(out, { recursive: true });
    audited(where.root, out, `import { spawnSync } from "node:child_process";\n`
      + `spawnSync("sh", ["-c", "command -v helper"], { env: { ...process.env, PATH: ${JSON.stringify(path)} } });\n`);
    return recordsIn(out).flatMap((one) => one.spawned).find((one) => one.file === "sh");
  };
  try {
    assert.equal(ran(`${alias}:/usr/bin:/bin`).pathIn, true, "the entry is absolute and outside by its name alone");
    assert.equal(ran("/usr/bin:/bin").pathIn, false, "and a path that reaches nothing of this tree does not");
    /* An entry this tree names is its own wherever it points, the link being a file of this tree
       that a later change is free to retarget. */
    symlinkSync("/usr/bin", join(where.root, "bin-out"));
    assert.equal(ran(`${join(where.root, "bin-out")}:/usr/bin`).pathIn, true,
      "a name of this tree's on the search path, pointing out of it");
    // Counting an unresolvable entry as inside took the exemption from every child in the suite.
    assert.equal(ran(`${join(where.at, "gone")}:/usr/bin:/bin`).pathIn, false,
      "an entry that resolves to nothing holds no program to find, so it reaches nothing");
    symlinkSync(join(where.root, "later"), join(where.at, "dangling"));
    assert.equal(ran(`${join(where.at, "dangling")}:/usr/bin:/bin`).pathIn, true,
      "a link with nothing at its end still names where a later change could put a program");
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

// node hands a child every enumerable name of an environment, its own comment saying so.
test("a name the environment inherits rather than owns is one the child gets, and is recorded", () => {
  const where = room();
  const out = join(where.at, "out");
  mkdirSync(out, { recursive: true });
  const ran = (made) => {
    rmSync(out, { recursive: true, force: true });
    mkdirSync(out, { recursive: true });
    audited(where.root, out, `import { execSync } from "node:child_process";\n`
      + `const env = ${made};\nenv.PATH = process.env.PATH;\n`
      + `try { execSync("printf %s hello", { env }); } catch { /* the answer is the record */ }\n`);
    return recordsIn(out).flatMap((one) => one.spawned).find((one) => one.shell !== undefined);
  };
  try {
    assert.equal(ran(`Object.create({ "BASH_FUNC_printf%%": "() { cat README.md; }" })`).funcIn, true,
      "the function is on the prototype, and node passes it all the same");
    assert.equal(ran("{}").funcIn, false, "and an environment carrying none of it says so");
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

// Naming a program `sh` does not make it one, and a path outside may name something in here.
test("a shell this repository holds itself is this repository's, however it is reached", () => {
  const where = room();
  const out = join(where.at, "out");
  const alias = join(where.at, "sh-alias");
  mkdirSync(out, { recursive: true });
  write(where.root, "bin/sh", "#!/bin/sh\nexec /bin/sh \"$@\"\n");
  chmodSync(join(where.root, "bin/sh"), 0o755);
  symlinkSync(join(where.root, "bin/sh"), alias);
  const ran = (program) => {
    rmSync(out, { recursive: true, force: true });
    mkdirSync(out, { recursive: true });
    audited(where.root, out, `import { spawnSync } from "node:child_process";\n`
      + `spawnSync(${JSON.stringify(program)}, ["-c", "command -v git"], `
      + `{ env: { ...process.env, PATH: "/usr/bin:/bin" } });\n`);
    return recordsIn(out).flatMap((one) => one.spawned).find((one) => one.args?.[0] === "-c");
  };
  try {
    assert.equal(ran("/bin/sh").mine, false, "the shell the box holds is the covered case");
    assert.equal(ran(join(where.root, "bin/sh")).mine, true, "a wrapper of this tree's own is not");
    assert.equal(ran(alias).mine, true, "and a path outside that is a link to it is the same wrapper");
    // The link is a file of this tree whatever it points at, and retargeting it changes what runs.
    symlinkSync("/bin/sh", join(where.root, "bin/outward"));
    assert.equal(ran(join(where.root, "bin/outward")).mine, true,
      "a name of this tree's pointing out of it is still a name of this tree's");
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

// A name under a directory that links into this tree is in it, whether or not it is there yet.
test("a search path entry under a link into this repository is placed inside it", () => {
  const where = room({ "bin/helper": "#!/bin/sh\n" });
  const out = join(where.at, "out");
  const alias = join(where.at, "under");
  mkdirSync(out, { recursive: true });
  symlinkSync(join(where.root, "bin"), alias);
  const ran = (path) => {
    rmSync(out, { recursive: true, force: true });
    mkdirSync(out, { recursive: true });
    audited(where.root, out, `import { spawnSync } from "node:child_process";\n`
      + `spawnSync("sh", ["-c", "command -v helper"], { env: { ...process.env, PATH: ${JSON.stringify(path)} } });\n`);
    return recordsIn(out).flatMap((one) => one.spawned).find((one) => one.file === "sh");
  };
  try {
    assert.equal(ran(`${join(alias, "optional")}:/usr/bin`).pathIn, true,
      "nothing is at the end of it, and what a later change puts there would answer the lookup");
    assert.equal(ran(`${join(where.at, "gone", "deeper")}:/usr/bin`).pathIn, false,
      "where no part of the name reaches this tree, nothing a later change does to it can");
    // The walk to something that is there is bounded, and running out of it is no answer at all.
    assert.equal(ran(`${join(alias, ...Array.from({ length: 40 }, () => "deep"))}:/usr/bin`).pathIn, true,
      "a name too deep to walk is a name this cannot place, and one it cannot place is not outside");
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

// A directory outside can hold a name resolving in, which is the lookup answering out of here.
test("a name the search path would answer out of this repository is recorded as reaching it", () => {
  const where = room({ "bin/helper": "#!/bin/sh\n" });
  const out = join(where.at, "out");
  const outside = join(where.at, "outside");
  mkdirSync(outside, { recursive: true });
  symlinkSync(join(where.root, "bin/helper"), join(outside, "helper"));
  const ran = (line) => {
    rmSync(out, { recursive: true, force: true });
    mkdirSync(out, { recursive: true });
    audited(where.root, out, `import { spawnSync } from "node:child_process";\n`
      + `spawnSync("sh", ["-c", ${JSON.stringify(line)}], { env: { ...process.env, PATH: ${JSON.stringify(`${outside}:/usr/bin`)} } });\n`);
    return recordsIn(out).flatMap((one) => one.spawned).find((one) => one.file === "sh");
  };
  try {
    assert.equal(ran("command -v helper").pathIn, true,
      "the directory stands outside and the name in it does not");
    assert.equal(ran("command -v git").pathIn, false, "and a name none of them answers from here");
    // The words this asks about are the words the exemption reads, quotes and escapes and all.
    assert.equal(ran("command -v 'helper'").pathIn, true, "however the line spells that name");
    assert.equal(ran(`command -v hel\\per`).pathIn, true, "and however it escapes it");
    // The program's own name is looked up along the same path as anything else on the line.
    symlinkSync(join(where.root, "bin/helper"), join(outside, "sh"));
    assert.equal(ran("true").pathIn, true, "the shell itself is a name this tree could answer");
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

// The loader maps a library in before a program's own code runs, so it stands behind every name.
test("a loader variable naming this repository is what the environment could put behind a builtin", () => {
  const where = room();
  const out = join(where.at, "out");
  mkdirSync(out, { recursive: true });
  const ran = (env) => {
    rmSync(out, { recursive: true, force: true });
    mkdirSync(out, { recursive: true });
    audited(where.root, out, `import { spawnSync } from "node:child_process";\n`
      + `spawnSync("sh", ["-c", "true"], { env: { ...process.env, ...${env} } });\n`);
    return recordsIn(out).flatMap((one) => one.spawned).find((one) => one.file === "sh");
  };
  try {
    assert.equal(ran(`{ LD_PRELOAD: ${JSON.stringify(join(where.root, "probe.so"))} }`).funcIn, true,
      "the library runs its own code before the shell reaches the line");
    assert.equal(ran(`{ DYLD_INSERT_LIBRARIES: ${JSON.stringify(join(where.root, "probe.dylib"))} }`).funcIn,
      true, "and the same on the other platform that has a loader");
    assert.equal(ran("{}").funcIn, false, "an environment carrying none of it says so");
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

/* A caller that curates a child's environment is choosing what that child reads its configuration
   from, and the audit's own three are the gate's instrument rather than that subject. Without them a
   test running the CLI under a home and a path starts a child that records nothing, which blinds the
   file that spawned it and spends it on every gate at every content (ISS-2119). */
const spawnedUnder = (where, out, env, child = `import { readFileSync } from "node:fs";\n`
  + `readFileSync(${JSON.stringify(FILE)}, "utf8");\n`) => {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  write(where.root, "child.mjs", child);
  audited(where.root, out, `import { spawnSync } from "node:child_process";\n`
    + `const ran = spawnSync(process.execPath, ["child.mjs"], `
    + `{ cwd: process.cwd(), encoding: "utf8", env: ${env} });\n`
    + `process.stdout.write(ran.stdout ?? "");\n`);
  return recordsIn(out);
};

test("a child handed an environment of its own records what it read, and blinds nobody", () => {
  const where = room();
  const out = join(where.at, "out");
  try {
    const kept = spawnedUnder(where, out, `{ PATH: process.env.PATH, HOME: process.env.HOME }`);
    /* The record that spawned something, not the one carrying no ticket: this file's own runner is
       ticketed too wherever the suite is spent under a gate of its own. */
    const parent = kept.find((one) => one.spawned.length > 0);
    const child = kept.find((one) => one.ticket === parent.spawned[0].ticket);
    assert.ok(child, "a curated environment stripped the preload, so the child recorded nothing");
    assert.deepEqual(child.paths.includes(FILE), true, "and its record holds the file it opened");
    // What the step is judged by, rather than the record alone: nothing in the tree blinds on it.
    const derived = stepSetOf(recordsFrom(out), where.root);
    assert.deepEqual(derived.blind, [], "and no cause is left for the file that spawned it");
    assert.deepEqual(derived.paths.has(FILE), true, "the file it opened is in what the step read");
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

test("the options a caller named survive beside the preload, and one already there is not added twice", () => {
  const where = room();
  const out = join(where.at, "out");
  const said = `import { writeFileSync } from "node:fs";\n`
    + `writeFileSync("said.txt", process.env.NODE_OPTIONS ?? "");\n`;
  const optionsAfter = (env) => {
    spawnedUnder(where, out, env, said);
    return readFileSync(join(where.root, "said.txt"), "utf8");
  };
  const imports = (text) => (text.match(/--import=\S*tools\/gates\/reads\/audit\.mjs/gu) ?? []).length;
  try {
    const own = optionsAfter(`{ PATH: process.env.PATH, NODE_OPTIONS: "--no-warnings" }`);
    assert.match(own, /--no-warnings/u, "an option the call named is the call's to keep");
    assert.deepEqual(imports(own), 1, "and the preload stands beside it, once");
    /* One record is the property and not the spelling: two names for one module URL are one module
       to the loader, which evaluates it once, so a duplicate would be inert rather than wrong. */
    const already = `{ PATH: process.env.PATH, NODE_OPTIONS: ${JSON.stringify(`--import=${PRELOAD}`)} }`;
    assert.deepEqual(imports(optionsAfter(already)), 1,
      "an environment already carrying the preload is handed one copy of it");
    assert.deepEqual(spawnedUnder(where, out, already).filter((one) => one.paths.includes(FILE)).length,
      1, "and the child writes one record");
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});

/* The interaction that cost release 3.36.248 a clean gate: every case in this tree that spawns a
   fixture under a room of its own failed under the gate and passed alone, the audit's own record
   directory having been written over theirs. What a caller said stands; what it left unsaid is
   added (ISS-2119). */
test("a call naming a record directory of its own keeps it, and its child records there", () => {
  const where = room();
  const out = join(where.at, "out");
  const mine = join(where.at, "mine");
  try {
    mkdirSync(mine, { recursive: true });
    spawnedUnder(where, out, `{ ...process.env, ...${JSON.stringify(auditEnv(mine, where.root))} }`);
    const aimed = readdirSync(mine).map((one) => JSON.parse(readFileSync(join(mine, one), "utf8")));
    assert.deepEqual(aimed.some((one) => one.paths.includes(FILE)), true,
      "the child wrote where the call aimed it");
    assert.deepEqual(recordsIn(out).some((one) => one.paths.includes(FILE)), false,
      "and nothing of what it read was taken to the audit's own room instead");
    /* The other half: naming the room and not the root would leave the child loading nothing at all,
       reading this repository under a ticket no record answers for. */
    rmSync(mine, { recursive: true, force: true });
    mkdirSync(mine, { recursive: true });
    const half = spawnedUnder(where, out, `{ PATH: process.env.PATH, GATE_READS: ${JSON.stringify(mine)} }`);
    const handed = half.find((one) => one.spawned.length > 0).spawned[0].ticket;
    const there = readdirSync(mine).map((one) => JSON.parse(readFileSync(join(mine, one), "utf8")));
    assert.deepEqual(there.some((one) => one.ticket === handed && one.paths.includes(FILE)), true,
      "a call naming the room and not the root gets the root it did not name, and what it read is "
      + "under the ticket it was handed rather than nowhere");
  } finally {
    rmSync(where.at, { recursive: true, force: true });
  }
});
