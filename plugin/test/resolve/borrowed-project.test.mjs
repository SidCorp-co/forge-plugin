/* A borrowing run home and the project record: a home holding none of its own reads the machine's
   record of the same project, and every writer of that record refuses rather than writing the
   machine's file or shadowing it with one of the home's own (ISS-2619). Each case stands two homes
   up, the fake tracker's as the machine's and a fresh one as the run's, so a record turning up in the
   wrong one is a file to read. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { answered, escaped, fakeTracker, projectEntry, projectRecord, projectRoom, ranAsync, tempRoom }
  from "../fixtures.mjs";
import { BORROW_VAR } from "../../src/resolve/machine/borrowed.mjs";

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const SETTINGS = new URL("../../src/resolve/settings.mjs", import.meta.url).href;

const state = {
  answer: {
    forge_guide: () => ({ guides: [] }),
    forge_config: (args) => (args.action === "get"
      ? { config: { baseBranch: "master", releaseModel: "publish",
        pipelineConfig: state.settings?.pipelineConfig ?? {} } }
      : undefined),
  },
  config: { pipelineConfig: { autoProdDeploy: false, qa: "independent" } },
};

const tracker = await fakeTracker(state);
test.after(() => tracker.close());

const machine = tracker.env.XDG_CONFIG_HOME;
const borrowed = join(machine, "forge", "config.json");
const MACHINE_RECORD = { slug: "forge-plugin", ship: "ready", drainedBy: "qa-master" };

/** A checkout the machine's record carries, a run home holding nothing, and the record's bytes. */
const standing = (record = MACHINE_RECORD) => {
  const room = projectRoom(tempRoom("borrowed-project-"), machine, record);
  const file = projectEntry(room, machine);
  state.settings = { pipelineConfig: { autoProdDeploy: false, qa: "independent" }, projectFacts: {} };
  state.calls = [];
  return { room, file, bytes: readFileSync(file, "utf8"), home: tempRoom("borrowed-project-home-") };
};

const envOf = (home) => ({ ...tracker.env, HOME: home, XDG_CONFIG_HOME: home, [BORROW_VAR]: borrowed });

const forge = (at, ...argv) => ranAsync(FORGE, argv, envOf(at.home), at.room);

const rowOf = (stdout, label) => stdout.split("\n").find((line) => new RegExp(`^\\[.{6}\\] ${label} {2,}`, "u").test(line));

const ownRecord = (at) => projectEntry(at.room, at.home);

test("a borrowing home with no record of its own resolves the machine's slug, named as the source", async () => {
  const at = standing();
  const run = await forge(at, "doctor");
  const row = rowOf(run.stdout, "project slug");
  assert.match(row ?? "", /project slug\s+forge-plugin {2}← /u, `the slug is the machine's:\n${run.stdout}`);
  assert.ok(row.endsWith(`← ${at.file}`), `the source is the machine's record:\n${row}`);
  assert.ok(!row.includes(at.home), `and nothing under the run home:\n${row}`);
  assert.equal(existsSync(join(at.home, "forge", "projects")), false, "and the read wrote no record into the home");
});

test("a key the machine's record sets beside the slug reads the machine's value, not the default", async () => {
  const at = standing({ ...MACHINE_RECORD, ship: "self" });
  const run = await forge(at, "doctor");
  assert.match(rowOf(run.stdout, "ship") ?? "", new RegExp(`ship\\s+self {2}← ${escaped(at.file)}$`, "u"), run.stdout);
});

test("the reader aimed at a named directory returns the machine's record of that directory's project", () => {
  const at = standing();
  const run = spawnSync(process.execPath, ["--input-type=module", "-e",
    `import { projectFileAt } from ${JSON.stringify(SETTINGS)};`
    + ` process.stdout.write(JSON.stringify(projectFileAt(${JSON.stringify(at.room)})));`],
  { encoding: "utf8", cwd: tempRoom("borrowed-project-cwd-"), env: envOf(at.home) });
  assert.deepEqual(answered(run), MACHINE_RECORD);
});

test("a borrowing home holding a record of its own reads that record's slug and not the machine's", async () => {
  const at = standing();
  const own = projectRecord(at.room, at.home, { slug: "own-slug" });
  const run = await forge(at, "doctor");
  assert.match(rowOf(run.stdout, "project slug") ?? "", new RegExp(`project slug\\s+own-slug {2}← ${escaped(own)}$`, "u"),
    run.stdout);
});

test("a --set of a project key is refused naming the machine's record, which keeps its bytes, and the home holds none", async () => {
  const at = standing();
  const run = await forge(at, "doctor", "--set", "ship=self");
  assert.notEqual(run.code, 0, run.stdout);
  assert.ok(run.stderr.includes(`\`ship\` would be written to ${at.file}`), `the refusal names the record:\n${run.stderr}`);
  assert.ok(run.stderr.includes(`${BORROW_VAR}= XDG_CONFIG_HOME=${machine} and the same command`),
    `and the shell that writes it there:\n${run.stderr}`);
  assert.equal(readFileSync(at.file, "utf8"), at.bytes, "the machine's record is unchanged");
  assert.equal(existsSync(ownRecord(at)), false, "and the run home holds no record");
});

test("--flow is refused naming the machine's record", async () => {
  const at = standing();
  const run = await forge(at, "doctor", "--flow", "default");
  assert.notEqual(run.code, 0, run.stdout);
  assert.ok(run.stderr.includes(`--flow: \`flow\` would be written to ${at.file}`), run.stderr);
});

test("--adopt in a checkout carrying a .forge.json is refused naming the machine's record", async () => {
  const at = standing();
  writeFileSync(join(at.room, ".forge.json"), `${JSON.stringify({ slug: "committed" })}\n`);
  const run = await forge(at, "doctor", "--adopt");
  assert.notEqual(run.code, 0, run.stdout);
  assert.ok(run.stderr.includes(`--adopt: what .forge.json holds would be written to ${at.file}`), run.stderr);
});

test("coolify pin is refused naming the machine's record", async () => {
  const at = standing();
  /* The route that serves `pin` is this machine's choice and not a borrowed key, so the home says it. */
  mkdirSync(join(at.home, "forge"));
  writeFileSync(join(at.home, "forge", "config.json"), `${JSON.stringify({ coolifyRoute: "instance" })}\n`);
  const run = await forge(at, "coolify", "pin", "--app", "some-app");
  assert.notEqual(run.code, 0, run.stdout);
  assert.ok(run.stderr.includes(`coolify pin: \`coolifyPin\` would be written to ${at.file}`), run.stderr);
});

test("a pipeline judgement that would clear the machine's drainedBy is refused before the tracker is written", async () => {
  const at = standing();
  const run = await forge(at, "doctor", "--set", "pipeline.qa=builder");
  assert.notEqual(run.code, 0, run.stdout);
  assert.ok(run.stderr.includes(`--set: the cleared \`drainedBy\` would be written to ${at.file}`), run.stderr);
  assert.equal(readFileSync(at.file, "utf8"), at.bytes, "the machine's record keeps its drainedBy");
  assert.deepEqual((state.calls ?? []).filter((one) => one.method === "PATCH"), [], "and the tracker was sent no write");
});
