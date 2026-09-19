/* The flags the merged mark's two path clauses are typed into, printed by the release step that knows what the change landed: `developed` reads the first back against the plan and `testing` the second, to decide whether a verdict taken before the landing still judges the code that landed.
   Its own file because the lines are typed by hand into a shell, which is a question about what is printed rather than about the steps around a change (ISS-1023). */
import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { git, landIn, lastStep, pushed, stubbed } from "./run-fixtures.mjs";

const WROTE = /^ {4}--wrote '(.+)'$/mu;
const MOVED = /^ {4}--moved (.+)$/mu;

/* The bump is not the change, so the files a release commit touches come out. */
test("the last step prints what this change wrote, and leaves the release commit's own files out of it", () => {
  const { work } = pushed("landing-wrote");
  stubbed(work);
  /* A module path nothing resolves, as every other case here uses: the scratch checkout's `plugin/src` is what the script under test loads, so this text on a real module's path would replace it and the script would not start. */
  landIn(work, join("plugin", "src", "flow", "entered.mjs"), 1, "the entry check");
  landIn(work, join("docs", "cli", "record.md"), 1, "and its page");
  const out = lastStep(work).stdout;
  const said = WROTE.exec(out);
  assert.ok(said, `no flag and value for the mark's note:\n${out}`);
  const wrote = said[1].split(", ");
  for (const one of ["docs/cli/record.md", "plugin/src/flow/entered.mjs"]) {
    assert.ok(wrote.includes(one), `${one} landed and the clause does not name it:\n${out}`);
  }
  for (const one of ["package.json", "package-lock.json", "plugin.json"]) {
    assert.ok(!said[1].includes(one), `the release commit's own ${one} is in the clause:\n${out}`);
  }
  /* ISS-730: a run that shortened the list by hand is what the composer's fitting replaced. ISS-1023: the line printed the note's own clause under `type that clause whole`, and `landing wrote` typed into the value read back as a path the landing moved. */
  assert.match(out, /type each flag and its value whole, any quotes on it being the shell's/u,
    `the flags are printed with nothing saying they are typed whole:\n${out}`);
  assert.doesNotMatch(out, /^ {4}landing (wrote|moved) /mu,
    `the note's own wording is still printed as the thing to type:\n${out}`);
  assert.doesNotMatch(out, /type that clause whole/u, `and still told the run to type a clause:\n${out}`);
});

/* Identity is the wrong test: a manifest is where a dependency lives too, and a change that added one would vanish from the clause a check reads back. Which commit wrote it is the question. */
test("a manifest the change itself edited stays in the clause, the bump alone being what comes out", () => {
  const { work } = pushed("landing-wrote-manifest");
  stubbed(work);
  const held = JSON.parse(readFileSync(join(work, "package.json"), "utf8"));
  writeFileSync(join(work, "package.json"), JSON.stringify({ ...held, dependencies: { left: "1.0.0" } }, null, 2));
  git(work, "add", "package.json");
  git(work, "commit", "-m", "the dependency this change needs");
  const out = lastStep(work).stdout;
  const said = WROTE.exec(out);
  assert.ok(said, `no flag and value for the mark's note:\n${out}`);
  assert.ok(said[1].split(", ").includes("package.json"),
    `the change edited package.json and the clause drops it:\n${out}`);
});

/* The value is typed into a shell, so a path holding a `$`, a backtick or an apostrophe has to reach the flag as itself (consult bb6f9c F1, 213dc0 F1); it is quoted at all because the paths of one clause are apart by `, `, which a shell splits a bare value on. */
test("the printed value survives the shell it is typed into", () => {
  const { work } = pushed("landing-wrote-shell");
  stubbed(work);
  const odd = ["docs/cli/$HOME-`id`.md", "docs/cli/it's-here.md"];
  for (const one of odd) landIn(work, one, 1, `${one}, a path a shell would rewrite`);
  const out = lastStep(work).stdout;
  const said = /^ {4}--wrote (.+)$/mu.exec(out);
  assert.ok(said, `no flag and value for the mark's note:\n${out}`);
  const back = execFileSync("sh", ["-c", `printf %s ${said[1]}`], { encoding: "utf8" });
  for (const one of odd) {
    assert.ok(back.split(", ").includes(one),
      `the shell the run types this into changed the value the flag takes: ${back}`);
  }
});

test("a release that landed nothing of its own says so in the value the flag takes", () => {
  const { work } = pushed("landing-wrote-nothing");
  const out = lastStep(work).stdout;
  assert.match(out, /^ {4}--wrote nothing$/mu, `a release of the bump alone named paths:\n${out}`);
});

/* The clause `testing` reads to decide whether the verdicts survived the landing. Before ISS-1896 the flag was
   printed six steps earlier, before the version commit existed, so a run reconstructed it from the judged head
   against the landed one and named the bump's own three files, standing every verdict down. */
test("the last step prints what the landing moved of this change, and a bump over none of its paths moved none", () => {
  const { work } = pushed("landing-moved-nothing");
  stubbed(work);
  landIn(work, join("plugin", "src", "flow", "entered.mjs"), 1, "the entry check");
  const out = lastStep(work).stdout;
  const said = MOVED.exec(out);
  assert.ok(said, `no flag and value for what the landing moved:\n${out}`);
  assert.equal(said[1], "nothing",
    `the release's own version commit is read as a path this change touched:\n${out}`);
  assert.match(out, /measured over what landed above [0-9a-f]{7}, the sha a mark takes/u,
    `the value does not say which commit it was measured from:\n${out}`);
});

/* The other half: a change that wrote a manifest really does have that path moved by the bump above it, and
   the refusal at `testing` is right to fire. Which commit wrote it is the question, not the filename. */
test("a path the change wrote and the bump writes too is named as moved, so the refusal still fires", () => {
  const { work } = pushed("landing-moved-manifest");
  stubbed(work);
  const held = JSON.parse(readFileSync(join(work, "package.json"), "utf8"));
  writeFileSync(join(work, "package.json"), JSON.stringify({ ...held, dependencies: { left: "1.0.0" } }, null, 2));
  git(work, "add", "package.json");
  git(work, "commit", "-m", "the dependency this change needs");
  const out = lastStep(work).stdout;
  const said = MOVED.exec(out);
  assert.ok(said, `no flag and value for what the landing moved:\n${out}`);
  assert.ok(said[1].includes("package.json"),
    `the bump moved a manifest this change wrote and the clause says nothing moved:\n${out}`);
});

/* Two paths in one value is the hazard the quoting is for, the clause's separator being `, `. The release
   writes three fixed paths, so no odd character reaches this clause and the separator is the whole test. */
test("the moved value survives the shell it is typed into when the bump moved more than one path", () => {
  const { work } = pushed("landing-moved-shell");
  stubbed(work);
  const held = JSON.parse(readFileSync(join(work, "package.json"), "utf8"));
  writeFileSync(join(work, "package.json"), JSON.stringify({ ...held, dependencies: { left: "1.0.0" } }, null, 2));
  writeFileSync(join(work, "package-lock.json"), JSON.stringify({ name: held.name, version: held.version, lockfileVersion: 3 }, null, 2));
  git(work, "add", "package.json", "package-lock.json");
  git(work, "commit", "-m", "the dependency this change needs, and its lock");
  const out = lastStep(work).stdout;
  const said = MOVED.exec(out);
  assert.ok(said, `no flag and value for what the landing moved:\n${out}`);
  const back = execFileSync("sh", ["-c", `printf %s ${said[1]}`], { encoding: "utf8" }).split(", ");
  for (const one of ["package-lock.json", "package.json"]) {
    assert.ok(back.includes(one), `the shell the run types this into changed the value the flag takes: ${back}`);
  }
});

/* A bump alone has no commit of the change under it, so the line says that rather than naming a sha. */
test("a release that landed nothing of its own says so where the measurement would be", () => {
  const { work } = pushed("landing-moved-nothing-landed");
  const out = lastStep(work).stdout;
  assert.match(out, /^ {4}--moved nothing$/mu, `a release of the bump alone named paths as moved:\n${out}`);
  assert.match(out, /this release landed no commit of this change, so there is nothing of it to have moved/u,
    `the line names a measurement over a change that did not land:\n${out}`);
});
