/* A field write that replaces a payload its status was earned on is refused until a correction
   naming the kind stands, and a taken one puts the replaced value up before the field is written
   (ISS-74). Each case drives the verb against a fake tracker and reads what reached it. */
import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { ranAsync, tempHome, tempRoom } from "../../../fixtures.mjs";
import { trackerFor } from "../../../fixtures/own-project.mjs";

process.env.XDG_CONFIG_HOME = tempHome("superseding").path;
const { render, parse } = await import("../../../../src/flow/record/page.mjs");
const { handleOf } = await import("../../../../src/flow/machine.mjs");

const room = tempRoom("superseding-");
const FORGE = new URL("../../../../bin/forge", import.meta.url).pathname;
const MINE = "superseding-run";
const OLD_PLAN = "# The plan\n\nScreen change: no\nSchema coupling: no\nDeploy coupling: no\n\nThe first reading.";
const NEW_PLAN = "# The plan\n\nScreen change: no\nSchema coupling: no\nDeploy coupling: no\n\nThe second reading.";
const OLD_NOTE = { section: "Fixed", userFacing: "the list sorts by name", technical: null };

let clock = 0;
const stamp = () => `2026-09-26T10:${String((clock += 1)).padStart(2, "0")}:00.000Z`;

const state = {
  config: { baseBranch: "master", releaseModel: "publish", pipelineConfig: { autoProdDeploy: false } },
  issues: [],
  comments: {},
  refuseUpdate: 0,
  refuseUpload: 0,
  refuseSuperseded: 0,
  calls: [],
  answer: {
    forge_config: () => ({ config: state.config }),
    forge_issues: (args) => {
      if (args.action === "list") return { issues: state.issues, returned: state.issues.length, hasMore: false };
      const issue = state.issues.find((one) => one.documentId === args.documentId) ?? state.issues[0];
      if (args.action === "update") {
        const field = ["plan", "acceptanceCriteria", "releaseNotes"].some((one) => one in args.data);
        if (field) state.calls.push({ name: "field-write", data: args.data });
        if (field && state.refuseUpdate > 0) {
          state.refuseUpdate -= 1;
          return { refused: "the tracker would not take this update" };
        }
        Object.assign(issue, args.data);
      }
      return issue;
    },
    forge_comments: (args) => {
      const id = args.filters?.issue ?? args.data?.issue ?? state.issues[0].documentId;
      const held = (state.comments[id] ??= []);
      if (args.action === "list") return { comments: held, returned: held.length, hasMore: false };
      if (state.refuseSuperseded > 0 && /Superseded payload/u.test(args.data.body)) {
        state.refuseSuperseded -= 1;
        return { refused: "the tracker would not take this comment" };
      }
      const row = { documentId: `c-${held.length + 1}-${id}`, createdAt: stamp(), authorDeviceId: "a-device", body: args.data.body };
      state.calls.push({ name: "comment-posted", body: args.data.body });
      held.push(row);
      return row;
    },
    forge_uploads: (args) => {
      if (state.refuseUpload > 0) {
        state.refuseUpload -= 1;
        return { refused: "the tracker would not take this file" };
      }
      state.calls.push({ name: "upload-sent", file: args.data?.name, bytes: String(args.part?.bytes ?? "") });
      return { id: `up-${state.calls.length}`, name: args.data?.name };
    },
  },
};

const { tracker, env: ENV } = await trackerFor(state);
test.after(() => tracker.close());

const env = { ...ENV, AI_AGENT: "a-test-agent", CLAUDE_PID: "4242", FORGE_SESSION_ID: MINE, FORGE_CODEX_DISABLE: "1" };

const lease = () => ({ lease: { holder: MINE, agent: "a-test-agent", pid: "4242", renewedAt: new Date().toISOString(), minutes: 30, next: null, history: [] } });

/* One issue per case, standing where the case needs it, with the records it already carries. */
const issue = (key, fields, comments = []) => {
  const documentId = `${key}-uuid`;
  state.issues = [{ documentId, issueId: key, title: "a record corrected in the open", description: "x",
    complexity: "m", sessionContext: lease(), ...fields }];
  state.comments = { [documentId]: comments.map((body) => ({ documentId: `seed-${clock}-${documentId}`, createdAt: stamp(), authorDeviceId: "a-device", body })) };
  state.calls = [];
  return state.issues[0];
};

const fileOf = (name, text) => {
  const path = join(room, name);
  writeFileSync(path, `${text}\n`);
  return path;
};

const ask = (...argv) => ranAsync(FORGE, ["record", ...argv], env);
const correctionOf = (corrects) => render("correction", { moved: "the reading moved", why: "the code said otherwise", corrects });
const named = (kind) => state.calls.filter((one) => one.name === kind);
const posted = () => named("comment-posted").map((one) => parse(one.body)).filter(Boolean);

test("a plan replaced past approved with no correction naming it is refused before anything is sent", async () => {
  const held = issue("ISS-7401", { status: "in_progress", plan: OLD_PLAN });
  const run = await ask("plan", "ISS-7401", fileOf("plan.md", NEW_PLAN));
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /ISS-7401 stands at in_progress, and the plan it holds was read at approved/u);
  assert.match(run.stderr, /^ {2}forge record correction ISS-7401 --corrects plan --moved "<what moved in the plan>" --why "<why it moved>"$/mu,
    "the one correction write that clears it, naming the kind");
  assert.equal(held.plan, OLD_PLAN, "the field is untouched");
  assert.deepEqual(named("field-write"), [], "and nothing was sent");
  assert.deepEqual(named("upload-sent"), []);
});

test("criteria replaced past approved with no correction naming them are refused", async () => {
  const held = issue("ISS-7402", { status: "testing", acceptanceCriteria: "1. The first outcome." });
  const run = await ask("criteria", "ISS-7402", fileOf("criteria.md", "1. A relaxed outcome."));
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /--corrects criteria --moved/u);
  assert.equal(held.acceptanceCriteria, "1. The first outcome.");
  assert.deepEqual(named("field-write"), []);
});

test("a release note replaced at awaiting_release or closed is refused, a stray probe among them", async () => {
  issue("ISS-7403", { status: "awaiting_release", releaseNotes: OLD_NOTE });
  const run = await ask("note", "ISS-7403", "--section", "Changed", "--user", "the list sorts by date");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /--corrects note --moved "<what moved in the release note>"/u);
  const held = issue("ISS-7404", { status: "closed", releaseNotes: OLD_NOTE });
  const probe = await ask("note", "ISS-7404", "--skip", "--why", "probe");
  assert.equal(probe.status, 1, probe.stdout);
  assert.match(probe.stderr, /ISS-7404 stands at closed, and the release note it holds was read at awaiting_release/u);
  assert.deepEqual(held.releaseNotes, OLD_NOTE, "the earned note stands");
  assert.deepEqual(named("field-write"), []);
});

test("nothing is asked of a first write, an equal one, one below the status, or one the rung excuses", async () => {
  const first = issue("ISS-7405", { status: "in_progress" });
  assert.equal((await ask("plan", "ISS-7405", fileOf("plan.md", NEW_PLAN))).status, 0);
  assert.equal(first.plan, `${NEW_PLAN}\n`, "a first write replaces nothing");
  issue("ISS-7406", { status: "in_progress", plan: NEW_PLAN });
  const same = await ask("plan", "ISS-7406", fileOf("plan.md", NEW_PLAN));
  assert.equal(same.status, 0, same.stderr);
  assert.deepEqual(named("upload-sent"), [], "an equal write replaces nothing and puts nothing up");
  const below = issue("ISS-7407", { status: "confirmed", plan: OLD_PLAN });
  assert.equal((await ask("plan", "ISS-7407", fileOf("plan.md", NEW_PLAN))).status, 0);
  assert.equal(below.plan, `${NEW_PLAN}\n`, "below approved the plan has earned nothing yet");
  const noteBelow = issue("ISS-7408", { status: "testing", releaseNotes: OLD_NOTE });
  assert.equal((await ask("note", "ISS-7408", "--section", "Changed", "--user", "sorted by date")).status, 0);
  assert.equal(noteBelow.releaseNotes.section, "Changed", "a note is earned at awaiting_release, not before");
  const fix = issue("ISS-7409", { status: "in_progress", complexity: "s", plan: OLD_PLAN });
  const excused = await ask("plan", "ISS-7409", fileOf("plan.md", NEW_PLAN));
  assert.equal(excused.status, 0, excused.stderr);
  assert.equal(fix.plan, `${NEW_PLAN}\n`, "a fix's rung owes no plan, so its plan earned nothing");
});

test("a side status is judged by the status its latest park left", async () => {
  const left = (status) => render("park", { kind: "blocked", why: "waits on another issue", evidence: [] }, status);
  issue("ISS-7410", { status: "on_hold", plan: OLD_PLAN }, [left("confirmed"), left("in_progress")]);
  const refused = await ask("plan", "ISS-7410", fileOf("plan.md", NEW_PLAN));
  assert.equal(refused.status, 1, "parked from in_progress, the plan was earned");
  assert.match(refused.stderr, /stands at in_progress/u);
  const early = issue("ISS-7411", { status: "on_hold", plan: OLD_PLAN }, [left("confirmed")]);
  assert.equal((await ask("plan", "ISS-7411", fileOf("plan.md", NEW_PLAN))).status, 0);
  assert.equal(early.plan, `${NEW_PLAN}\n`, "parked from confirmed, it was not");
});

test("a correction naming the kind lets the replacement through, the old value up before the field", async () => {
  const held = issue("ISS-7412", { status: "in_progress", plan: OLD_PLAN },
    [correctionOf("criteria"), render("correction", { moved: "an old correction", why: "before the field existed" })]);
  const unnamed = await ask("plan", "ISS-7412", fileOf("plan.md", NEW_PLAN));
  assert.equal(unnamed.status, 1, "one naming another kind, or none, clears nothing");
  state.comments["ISS-7412-uuid"].push({ documentId: "named-correction-id", createdAt: stamp(), authorDeviceId: "a-device", body: correctionOf("plan:steps") });
  state.calls = [];
  const run = await ask("plan", "ISS-7412", fileOf("plan.md", NEW_PLAN));
  assert.equal(run.status, 0, run.stderr);
  assert.equal(held.plan, `${NEW_PLAN}\n`);
  const order = state.calls.map((one) => one.name);
  assert.ok(order.indexOf("upload-sent") >= 0 && order.indexOf("upload-sent") < order.indexOf("field-write"),
    `the replaced value goes up before the field is written: ${order.join(", ")}`);
  const [file] = named("upload-sent").map((one) => one.file);
  assert.match(file, /^plan-as-it-stood-\d{4}-\d{2}-\d{2}T\d{6}\.md$/u);
  const superseded = posted().find((one) => one.kind === "superseded");
  assert.ok(superseded, "and a Superseded payload record follows the field");
  assert.deepEqual({ ...superseded.fields }, { kind: "plan", by: handleOf("named-correction-id"), attached: file, was: OLD_PLAN },
    "naming the attachment, the correction it spent, and the value itself");
  state.calls = [];
  const again = await ask("plan", "ISS-7412", fileOf("plan.md", `${NEW_PLAN}\nA third reading.`));
  assert.equal(again.status, 1, "a second replacement owes a correction of its own");
  assert.deepEqual(named("field-write"), []);
});

test("a replaced value too long for one comment is named by the record and carried by the file alone", async () => {
  const long = `${OLD_PLAN}\n${"a line of the older plan\n".repeat(600)}`;
  issue("ISS-7413", { status: "in_progress", plan: long }, [correctionOf("plan")]);
  const run = await ask("plan", "ISS-7413", fileOf("plan.md", NEW_PLAN));
  assert.equal(run.status, 0, run.stderr);
  const superseded = posted().find((one) => one.kind === "superseded");
  assert.equal(superseded.fields.was, undefined, "no inline copy past the comment cap");
  const [sent] = named("upload-sent");
  assert.equal(superseded.fields.attached, sent.file, "the record names the attachment");
  assert.equal(sent.bytes, `${long.trim()}\n`, "and the attachment carries the replaced value whole");
});

test("a replacement whose field update fails leaves its correction unspent, and the same write goes through again", async () => {
  const held = issue("ISS-7414", { status: "in_progress", plan: OLD_PLAN }, [correctionOf("plan")]);
  state.refuseUpdate = 1;
  const failed = await ask("plan", "ISS-7414", fileOf("plan.md", NEW_PLAN));
  assert.notEqual(failed.status, 0, "the update was refused");
  assert.equal(held.plan, OLD_PLAN);
  assert.equal(posted().filter((one) => one.kind === "superseded").length, 0, "nothing claims the correction spent");
  const retried = await ask("plan", "ISS-7414", fileOf("plan.md", NEW_PLAN));
  assert.equal(retried.status, 0, retried.stderr);
  assert.equal(held.plan, `${NEW_PLAN}\n`);
  assert.equal(named("upload-sent").length, 2, "the retry puts up a copy of its own");
});

test("an upload the tracker refuses leaves the field as it was and the correction unspent", async () => {
  const held = issue("ISS-7415", { status: "in_progress", plan: OLD_PLAN }, [correctionOf("plan")]);
  state.refuseUpload = 1;
  const failed = await ask("plan", "ISS-7415", fileOf("plan.md", NEW_PLAN));
  assert.notEqual(failed.status, 0, "the upload was refused");
  assert.equal(held.plan, OLD_PLAN, "nothing was replaced");
  assert.deepEqual(named("field-write"), []);
  const retried = await ask("plan", "ISS-7415", fileOf("plan.md", NEW_PLAN));
  assert.equal(retried.status, 0, retried.stderr);
  assert.equal(named("upload-sent")[0].bytes, `${OLD_PLAN}\n`, "the retry puts the old value up");
});

test("a superseded record the tracker refuses leaves the old value readable in the file already up", async () => {
  const held = issue("ISS-7416", { status: "in_progress", plan: OLD_PLAN }, [correctionOf("plan")]);
  state.refuseSuperseded = 1;
  const failed = await ask("plan", "ISS-7416", fileOf("plan.md", NEW_PLAN));
  assert.notEqual(failed.status, 0, "the comment was refused");
  assert.equal(held.plan, `${NEW_PLAN}\n`, "the field was written before it");
  assert.equal(named("upload-sent")[0].bytes, `${OLD_PLAN}\n`, "and the old value is on the issue as a file");
  const again = await ask("plan", "ISS-7416", fileOf("plan.md", NEW_PLAN));
  assert.equal(again.status, 0, `the same write, equal to what is held, goes through: ${again.stderr}`);
});
