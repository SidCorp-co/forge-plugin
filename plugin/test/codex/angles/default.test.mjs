/* Which angles review a consult where nothing names them, and what `show` says of it. Spawned where the
   checkout's own file is read, because that file resolves once per process. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { neutralRoom, projectRoom, tempRoom } from "../../fixtures.mjs";

/* Imported after XDG_CONFIG_HOME moves, so the caller's own project file is not the one read. */
process.env.XDG_CONFIG_HOME = tempRoom("forge-codex-angles-home-");
const { consultArgs } = await import("../../../src/codex/codex.mjs");
const { roleFor } = await import("../../../src/codex/codex-api.mjs");
const { DEFAULT_ANGLES } = await import("../../../src/codex/codex-plan.mjs");
const CLI = new URL("../../../src/cli.mjs", import.meta.url).pathname;

/* The owner's defaults: debt of 2026-09-25 and simplify of 2026-10-06, each added to every angle there was,
   off only where a list leaves it out. */
test("the debt and simplify angles are on by default, and a list without them turns them off", () => {
  assert.deepEqual(DEFAULT_ANGLES, ["tech", "ba", "user", "ux", "debt", "simplify"]);
  assert.deepEqual(consultArgs(["a.mjs"]).angles, ["tech", "ba", "user", "ux", "debt", "simplify"],
    "no angles named: the four there were, debt and simplify");
  assert.match(roleFor(), /Reply as a board of 6:[\s\S]*- Business Analyst — [\s\S]*- Debt Reviewer — [\s\S]*- Simplifier — /u);
  assert.deepEqual(consultArgs(["a.mjs", "--angles", "tech"]).angles, ["tech"], "one consult turns it off");
  assert.ok(!roleFor(["tech"]).includes("Debt Reviewer") && !roleFor(["tech"]).includes("Simplifier"));
});

test("the consult help names simplify among the angles, and says all six are the default", () => {
  const help = spawnSync(process.execPath, [CLI, "codex", "consult", "-h"], { encoding: "utf8", cwd: neutralRoom() });
  assert.match(help.stdout, /--angles a,a +which angles review this consult: tech, ba, user, ux, debt, simplify; all six by default/u, help.stdout + help.stderr);
});

const shownIn = (config) => {
  const home = tempRoom("forge-codex-angles-");
  const room = projectRoom(tempRoom("forge-codex-angles-room-"), home, config);
  const run = spawnSync(process.execPath, [CLI, "codex", "show"],
    { cwd: room, encoding: "utf8", env: { ...process.env, XDG_CONFIG_HOME: home, HOME: home } });
  return (run.stdout.split("\n").find((line) => line.startsWith("angles")) ?? "") + run.stderr;
};

test("show says whether each later angle is on and where the list was read, and how to add one where it is off", () => {
  assert.match(shownIn({ slug: "own" }), /^angles {4}: tech, ba, user, ux, debt, simplify {2}← the plugin's default — debt is on; simplify is on$/mu);
  const kept = shownIn({ slug: "own", codex: { angles: ["tech"] } });
  assert.match(kept, /^angles {4}: tech {2}← codex\.angles in \S+ — debt is available and off here: `forge doctor --set project\.codex\.angles=tech,debt` adds it; simplify is available and off here: `forge doctor --set project\.codex\.angles=tech,simplify` adds it$/mu, kept);
  assert.match(shownIn({ slug: "own", codex: { angles: ["tech", "debt"] } }), /^angles {4}: tech, debt {2}← codex\.angles in \S+ — debt is on; simplify is available and off here: `forge doctor --set project\.codex\.angles=tech,debt,simplify` adds it$/mu);
});

test("a list naming no angle is refused where a consult reads it, and show says so", () => {
  assert.match(shownIn({ slug: "own", codex: { angles: [] } }), /^angles {4}: none {2}← codex\.angles in \S+ — a list naming no angle, so a consult here is refused$/mu);
  const run = spawnSync(process.execPath, [CLI, "codex", "consult", "a.mjs", "--angles", ","],
    { encoding: "utf8", cwd: neutralRoom() });
  assert.match(run.stderr, /codex: --angles names no angle\. Name some of tech, ba, user, ux, debt, simplify, or drop the key for the default, tech, ba, user, ux, debt, simplify\./u, run.stderr);
  assert.notEqual(run.status, 0);
});
