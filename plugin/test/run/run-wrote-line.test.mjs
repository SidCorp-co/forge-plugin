/* The flag the merged mark's `landing wrote` clause is typed into, printed by the release step that knows what the change landed: `developed` reads that set back against the plan.
   Its own file because the line is typed by hand into a shell, which is a question about what is printed rather than about the steps around a change (ISS-1023). */
import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { git, landIn, lastStep, pushed, stubbed } from "./run-fixtures.mjs";

const WROTE = /^ {4}--wrote '(.+)'$/mu;

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
  assert.match(out, /type the flag and the value whole, any quotes on it being the shell's/u,
    `the flag is printed with nothing saying it is typed whole:\n${out}`);
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
