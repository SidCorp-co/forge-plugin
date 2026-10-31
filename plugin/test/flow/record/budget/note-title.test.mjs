/* Core refuses a release note a user reads without a short title (FB-403), at most ten words and
   at most 80 characters (`@forge/contracts/release-notes`), and holds a stored note lacking one off
   every release page. So `record note` takes the title where core asks for it, prints both bounds,
   refuses a title over either before the request, and the rung that asks for a note asks for a
   titled one. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";

import { neutralRoom, tempHome } from "../../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("note-title").path;
const { noteFrom } = await import("../../../../src/flow/record/record.mjs");
const { deployedOwed, viewFrom } = await import("../../../../src/flow/earned.mjs");

const FORGE = new URL("../../../../bin/forge", import.meta.url).pathname;
const ask = (...argv) => spawnSync(FORGE, argv, { encoding: "utf8", cwd: neutralRoom(), env: process.env });

test("record note -h prints the title's bounds beside the flag", () => {
  const run = ask("record", "note", "-h");
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /--title T\(80\)/u, run.stdout);
  assert.match(run.stdout, /10 words/u, "the word bound is printed beside it");
});

test("a title past 80 characters is refused before the request, whatever its word count", () => {
  const unspaced = "ハ".repeat(81);
  assert.throws(() => noteFrom(["--section", "Added", "--title", unspaced, "--user", "You see it now."]),
    /--title is 81 code points and its cap is 80/u);
});

test("a Skip note owes no title, and every section a user reads does", () => {
  assert.equal(noteFrom(["--skip", "--why", "nothing a user sees"]).section, "Skip");
  assert.throws(() => noteFrom(["--section", "Fixed", "--user", "You see it now."]), /needs --title/u);
});

test("the rung that asks for a note asks for a titled one: a stored note a user reads with no title is owed", () => {
  const view = viewFrom("the-uuid", {
    acceptanceCriteria: "1. The outcome.",
    plan: "Screen change: no.\nSchema coupling: no.\nUser-facing outcome: no.",
    complexity: "m",
    releaseNotes: { section: "Fixed", userFacing: "The list shows again." },
  }, []);
  const owed = deployedOwed(view, "ISS-3");
  const titled = owed.find((one) => /title/u.test(one.what));
  assert.ok(titled, `nothing owed names the missing title:\n${owed.map((one) => one.what).join("\n")}`);
  assert.match(titled.command, /forge record note ISS-3 --section Fixed --title/u);
  const skipped = viewFrom("the-uuid", { ...view.issue, releaseNotes: { section: "Skip", userFacing: "-" } }, []);
  assert.equal(deployedOwed(skipped, "ISS-3").find((one) => /title/u.test(one.what)), undefined,
    "and a Skip note owes none");
});
