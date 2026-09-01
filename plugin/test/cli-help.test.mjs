/* `-h` worked on four of seventeen verbs; the rest read it as a filename, a uuid or a tool name.
   The loop is the point: verb eighteen cannot ship without one. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { VERB_NAMES, helpOf, usageOf } from "../src/resolve/visibility.mjs";
import { wantsHelp } from "../src/resolve/flags.mjs";

const FORGE = new URL("../bin/forge", import.meta.url).pathname;
const ask = (...argv) =>
  spawnSync(FORGE, argv, {
    encoding: "utf8",
    env: { ...process.env, XDG_CONFIG_HOME: mkdtempSync(join(tmpdir(), "cli-help-")) },
  });

test("every verb says what to type", () => {
  for (const verb of VERB_NAMES) {
    const run = ask(verb, "-h");
    assert.equal(run.status, 0, `forge ${verb} -h exited ${run.status}: ${run.stderr}`);
    assert.ok(
      `${run.stdout}${run.stderr}`.includes(usageOf(verb)),
      `forge ${verb} -h answered something else: ${run.stdout}${run.stderr}`,
    );
  }
});

/* On stderr, `forge -h | head` printed nothing, and callers learned to write `2>&1` first. */
test("help is an answer, not a failure", () => {
  const run = ask("-h");
  assert.equal(run.status, 0);
  assert.match(run.stdout, /Usage: forge </u, "it goes to stdout");
  assert.equal(run.stderr, "", `and nothing to stderr: ${run.stderr}`);
  const missing = ask("isues");
  assert.equal(missing.status, 1, "a verb that does not exist is still a failure");
  assert.match(missing.stderr, /No verb named isues. Did you mean: issues/u);
  assert.equal(missing.stdout, "", "and a failure says nothing on stdout");
});

test("the write-time rules wait to be asked for", () => {
  const brief = ask("-h").stdout;
  assert.ok(!brief.includes("Before you write"), `ten lines nobody asked for: ${brief}`);
  assert.match(brief, /forge -h --full/u, "and the way to ask is on the line");
  assert.match(ask("-h", "--full").stdout, /Before you write:/u);
});

/* Reported: the help advertised a pipeline run. `pipelineConfig` is a field the caller patches and
   the replace-not-merge warning is load-bearing, so the distinction is pinned rather than swept. */
test("no run of anything else is advertised", () => {
  for (const argv of [["-h"], ["-h", "--full"]]) {
    assert.ok(!ask(...argv).stdout.includes("pipeline run"), argv.join(" "));
  }
  assert.match(ask("-h", "--full").stdout, /replace-not-merge/u);
});

/* One usage line documents every action, and the actions are what a caller needs: a generic
   `Usage: forge codex <...>` would satisfy the old assertion while deleting all of it. */
test("a verb with actions of its own keeps its own help", () => {
  const out = ask("codex", "-h");
  assert.equal(out.status, 0);
  assert.match(`${out.stdout}${out.stderr}`, /--verify risk/u);
});

/* A reference followed by `-h` names a file to post, and help there is a write that never ran. */
test("an argument is not a question", () => {
  assert.ok(wantsHelp(["-h"]) && wantsHelp(["--help"]));
  assert.ok(!wantsHelp(["ISS-45", "-h"]), "a file to post");
  assert.ok(!wantsHelp(["x.md", "--title", "-h"]), "an issue may be titled -h");
  assert.ok(!wantsHelp(["forge_issues", '{"note":"-h"}']), "and a json field may hold it");
});

/* The detail is the schema, and a verb that takes nothing has none to offer. */
test("what a verb takes is named, where there is anything to take", () => {
  assert.match(helpOf("issues"), /The fields the tracker takes: `forge schema forge_issues`/u);
  assert.ok(!helpOf("project").includes("forge schema"), helpOf("project"));
});
