/* A verb the credential cannot spend is hidden rather than re-routed, and the gate that hides it is
   keyed on the ACTION: the same tool answers three reads to the same token. Both halves are watched
   here, because a gate keyed on the tool would pass every case but the last one. */
import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import test from "node:test";

import { fakeTracker, ranAsync, tempRoom } from "../fixtures.mjs";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "cli.mjs");
const SLUG = "withheld-dep-fixture";
const DEVICE = "FORBIDDEN: PM_REQUIRES_DEVICE — this action needs a paired-device token";
const MISSING = "BAD_REQUEST: fromIssueId is required";

/* One tracker, one doctor run, then every surface asked of the record it left. `graph` answers and
   `set_dependency` refuses, which is this deployment: the tool is reachable and the action is not. */
const measured = async (refusal) => {
  const tracker = await fakeTracker({
    declared: ["forge_project_pm"],
    answer: {
      forge_project_pm: (args) =>
        (args.action === "set_dependency" ? { refused: refusal } : { nodes: [] }),
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

test("the credential class refusing the action gates the action alone", async () => {
  const { doctor, ran, close, capabilities } = await measured(DEVICE);
  try {
    assert.match(doctor.stdout, /\[ note \] dependency edge\s+forge_project_pm is declared but refuses/u);
    assert.match(doctor.stdout, /\[\s+ok\s+\] dependency graph\s+forge_project_pm answers/u,
      "the read the same token can make is still reported as reachable");

    const record = capabilities();
    assert.match(record["forge_project_pm.set_dependency"], /PM_REQUIRES_DEVICE/u, "keyed by action");
    assert.equal(record.forge_project_pm, null, "and the tool itself is not gated");

    const listed = await ran("-h");
    assert.doesNotMatch(listed.stdout, /^ {2}dep /mu, "the verb left the usage list");
    assert.match(listed.stdout, /^ {2}deps /mu, "and the read beside it did not");

    const typed = await ran("dep", "ISS-1", "ISS-2");
    assert.equal(typed.status, 1);
    assert.equal(typed.stderr.trim().split("\n").length, 1, "one line, as a spent turn is owed");
    assert.match(typed.stderr, /forge_project_pm set_dependency/u, "which action it needed");
    assert.match(typed.stderr, /paired device alone and this credential may not call/u);
    assert.match(typed.stderr, /no other verb needs a device/u, "and that nothing here wants one");
    assert.doesNotMatch(typed.stderr, /forge_issues|data\.relations|forge call/u,
      "naming a replacement route is the redirect docs/cli/withholding-a-verb.md forbids");

    const typo = await ran("dpe");
    assert.doesNotMatch(typo.stderr, /\bdep\b/u, "a withheld verb is off the did-you-mean set too");

    /* The assertion a gate keyed on the tool fails: three actions of it still answer this token. */
    const tools = await ran("tools");
    assert.match(tools.stdout, /^forge_project_pm$/mu, "the tool is still listed");
    const schema = await ran("schema", "forge_project_pm");
    assert.equal(schema.status, 0, schema.stderr);
  } finally {
    close();
  }
});

/* The probe names the action and none of its ids, so a paired device reaches argument validation
   and is told what it left out. Reading that as a gate would hide the verb from the one credential
   it is for, which no run here can catch: this deployment has no device token to try. */
test("a refusal that is not the credential class gates nothing", async () => {
  const { doctor, ran, close, capabilities } = await measured(MISSING);
  try {
    assert.equal(capabilities()["forge_project_pm.set_dependency"], null);
    assert.match(doctor.stdout, /\[\s+ok\s+\] dependency edge\s+forge_project_pm answers/u);
    const listed = await ran("-h");
    assert.match(listed.stdout, /^ {2}dep /mu, "the verb the token can spend stays offered");
  } finally {
    close();
  }
});
