/* A verb the credential cannot spend is hidden rather than re-routed, and the gate that hides it is
   keyed on the ACTION: the same tool answers three reads to the same token. Both halves are watched
   here, because a gate keyed on the tool would pass every case but the last one. */
import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import test from "node:test";

import { fakeTracker, ranAsync, tempRoom } from "../fixtures.mjs";
import { gatingRefusal } from "../../src/tools/doctor.mjs";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "cli.mjs");
const SLUG = "withheld-dep-fixture";

/* One tracker, one doctor run, then every surface asked of the record it left: the tool is
   reachable and one of its actions is not, refused by the table before any request. */
const measured = async () => {
  const tracker = await fakeTracker({
    declared: ["forge_project_pm"],
    answer: {
      forge_project_pm: () => ({ nodes: [] }),
      forge_guide: () => ({ guides: [] }),
      "forge_projects.list": () => ({ projects: [{ slug: SLUG, id: "1e1c1a1e-0000-4000-8000-00000000027d" }] }),
    },
  });
  const cwd = tempRoom("withheld-dep-");
  writeFileSync(join(cwd, ".forge.json"), JSON.stringify({ slug: SLUG }));
  const held = join(tracker.env.XDG_CONFIG_HOME, "forge", "config.json");
  const doctor = await ranAsync(process.execPath, [CLI, "doctor"], tracker.env, cwd);
  const ran = (...argv) => ranAsync(process.execPath, [CLI, ...argv], tracker.env, cwd);
  return { doctor, ran, close: tracker.close, capabilities: () => JSON.parse(readFileSync(held, "utf8")).capabilities?.[SLUG] };
};

test("the refusal of the action gates the action alone", async () => {
  const { doctor, ran, close, capabilities } = await measured();
  try {
    assert.match(doctor.stdout, /\[ note \] dependency edge\s+forge_project_pm is declared but refuses/u);
    assert.match(doctor.stdout, /\[\s+ok\s+\] dependency graph\s+forge_project_pm answers/u,
      "the read the same token can make is still reported as reachable");

    const record = capabilities();
    assert.match(record["forge_project_pm.set_dependency"], /has no route/u, "keyed by action");
    assert.equal(record.forge_project_pm, null, "and the tool itself is not gated");

    const listed = await ran("-h");
    assert.doesNotMatch(listed.stdout, /^ {2}dep /mu, "the verb left the usage list");
    assert.match(listed.stdout, /^ {2}deps /mu, "and the read beside it did not");

    const typed = await ran("dep", "ISS-1", "ISS-2");
    assert.equal(typed.status, 1);
    assert.equal(typed.stderr.trim().split("\n").length, 1, "one line, as a spent turn is owed");
    assert.match(typed.stderr, /forge_project_pm set_dependency/u, "which action it needed");
    assert.match(typed.stderr, /no route to on the tracker's data plane and may not call/u);
    assert.match(typed.stderr, /no edge is written from here/u, "and that nothing here writes one");
    assert.doesNotMatch(typed.stderr, /forge_issues|data\.relations|forge call/u,
      "naming a replacement route is the redirect docs/cli/withholding-a-verb.md forbids");

    const typo = await ran("dpe");
    assert.doesNotMatch(typo.stderr, /\bdep\b/u, "a withheld verb is off the did-you-mean set too");

    /* The assertion a gate keyed on the tool fails: three actions of it still answer this token. */
    const tools = await ran("tools");
    assert.match(tools.stdout, /^forge_project_pm\.graph\b/mu, "the tool's readable actions are still listed");
    assert.doesNotMatch(tools.stdout, /set_dependency/u, "and the action nothing routes is on no row");
    const schema = await ran("schema", "forge_project_pm");
    assert.equal(schema.status, 0, schema.stderr);
  } finally {
    close();
  }
});

/* Only something saying no gates a verb, or a dropped socket hides it from every run until the next
   probe. Judged in process, the probe having no way to reach the tracker for an action the table
   declares no route for — and judged for a row naming its own refusal and for one naming none,
   because four of the five probes name none and it was those that recorded a bad minute. */
test("a refusal that is not one saying no gates nothing, whether the row names one or not", () => {
  assert.match(gatingRefusal({ refused: "set_dependency has no route\nand a second line" }), /has no route/u);
  assert.equal(gatingRefusal({ refused: "Forge did not answer POST /api/projects/x/pm: socket hang up" }), null);
  assert.equal(gatingRefusal({ refused: "BAD_REQUEST: fromIssueId is required" }), null);
  assert.equal(gatingRefusal({ nodes: [] }), null, "and an answer gates nothing at all");
  const dropped = { refused: "Forge did not answer GET /api/projects/x/knowledge: fetch failed" };
  assert.equal(gatingRefusal(dropped), null, "a row naming no refusal is not gated by a fault of the moment");
  assert.equal(gatingRefusal({ refused: "Forge answered 503 for GET /api/guides" }), null);
  assert.match(gatingRefusal({ refused: "FORBIDDEN: knowledge is not enabled" }), /FORBIDDEN/u,
    "while the tracker saying no is what a capability record is for");
});
