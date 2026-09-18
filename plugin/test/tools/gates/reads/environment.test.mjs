/* What the environment a child ran under says about whether it could have read this repository, which
   is what rules on one that left no record: where a name with no slash would be looked for, what
   could stand behind a builtin's name, and whether the program is one this tree holds (ISS-1793).
   Its own file because it asks about the environment rather than about per-file scoping. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";

import { auditEnv } from "../../../../../tools/gates/reads/sets.mjs";
import { write } from "../scratch.mjs";
import { tempRoom } from "../../../fixtures.mjs";

const FILE = "plugin/test/one.test.mjs";

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
    // The program's own name is looked up along the same path as anything else on the line.
    symlinkSync(join(where.root, "bin/helper"), join(outside, "sh"));
    assert.equal(ran("true").pathIn, true, "the shell itself is a name this tree could answer");
    // The words this asks about are the words the exemption reads, quotes and escapes and all.
    assert.equal(ran("command -v 'helper'").pathIn, true, "however the line spells that name");
    assert.equal(ran(`command -v hel\\per`).pathIn, true, "and however it escapes it");
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
