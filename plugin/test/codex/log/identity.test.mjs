/* Which run wrote a row of the consult log, in its own file because the log's other questions fill one.
   Waves of three to six runs rule at once here, and a clock told 151 of 302 ruling calls apart (ISS-834). */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, writeFileSync } from "node:fs";

import { standsInNoTree, tempRoom } from "../../fixtures.mjs";

/* Imported after XDG_CONFIG_HOME moves: these tests write the log, and the developer's own is live. */
const sandbox = tempRoom("forge-codex-identity-");
process.env.XDG_CONFIG_HOME = sandbox;
standsInNoTree("forge-codex-identity");

const { logConsult, logEntries, logLine, logPath } = await import("../../../src/codex/codex-log.mjs");

/* The environment the write reads, and whatever this suite's own run was handed put back after. */
const asRun = (held, then) => {
  const kept = ["FORGE_SESSION_ID", "CLAUDE_CODE_SESSION_ID"].map((name) => [name, process.env[name]]);
  for (const [name] of kept) delete process.env[name];
  Object.assign(process.env, held);
  try {
    return then();
  } finally {
    for (const [name, was] of kept) {
      if (was === undefined) delete process.env[name];
      else process.env[name] = was;
    }
  }
};

const AT = "2026-09-09T03:00:00.000Z";
const VERDICT = { kind: "verdict", at: AT, of: "c1", accepted: 1, rejected: 0, kept: ["F1"], dropped: {} };

test("an entry says which run wrote it, and which source answered for the id", () => {
  asRun({ FORGE_SESSION_ID: "iss-834-a" }, () => {
    logConsult({ kind: "started", id: "s1", at: AT, root: "/a", files: ["a.mjs"] });
    logConsult({ kind: "consult", id: "s1", ok: true, at: AT, root: "/a", files: ["a.mjs"], reply: "CODEX: 0 findings" });
    logConsult({ kind: "consult", id: "s2", ok: false, at: AT, root: "/a", files: ["a.mjs"], error: "gateway" });
    logConsult(VERDICT);
  });
  const rows = logEntries().slice(-4);
  assert.deepEqual(rows.map((one) => one.kind), ["started", "consult", "consult", "verdict"]);
  /* Every kind, because the stamp is on the one write path and not on the records the callers build. */
  assert.deepEqual(rows.map((one) => one.run), Array(4).fill("iss-834-a"));
  assert.deepEqual(rows.map((one) => one.runFrom), Array(4).fill("asked"));
  assert.match(logLine(rows.at(-1), false), /1 accepted, 0 rejected {2}by iss-834-a \(asked\)$/u,
    "and the line prints the source beside the id");
  assert.match(logLine(rows[0], false), /on a\.mjs {2}by iss-834-a \(asked\)$/u, "on a started row too");
  assert.match(logLine(rows[1], false), /0 finding\(s\) {2}by iss-834-a \(asked\)\n {2}files {2}a\.mjs$/u,
    "and at the end of a consult's own head, ahead of its files");
});

/* An id resolved from the session that dispatched a wave is the wave's, so six runs carry one value:
   stored bare it would read as attribution and pair the six as one. */
test("an id inherited from the dispatching session is stored and printed as inherited", () => {
  asRun({ CLAUDE_CODE_SESSION_ID: "wave-1" }, () => logConsult({ ...VERDICT, of: "c2" }));
  const entry = logEntries().at(-1);
  assert.deepEqual([entry.run, entry.runFrom], ["wave-1", "inherited"]);
  assert.match(logLine(entry, false), /by wave-1 \(inherited\)$/u);
});

/* Minting one here would save it, and every later run on this machine would then read the same
   `saved` id — the blank identity wearing a value, which two writes in a row is what proves. */
test("an entry written where no run id resolves says so rather than carrying a blank", () => {
  asRun({}, () => {
    logConsult({ ...VERDICT, of: "c3" });
    logConsult({ ...VERDICT, of: "c4" });
  });
  const rows = logEntries().slice(-2);
  assert.deepEqual(rows.map((one) => one.runFrom), ["none", "none"], "the second write minted nothing for the first");
  assert.deepEqual(rows.map((one) => "run" in one), [false, false], "and no field carries an empty id");
  assert.match(logLine(rows.at(-1), false), /by no run id$/u);
});

test("two rulings written in the same second by two runs are told apart by their entries alone", () => {
  asRun({ FORGE_SESSION_ID: "iss-834-a" }, () => logConsult({ ...VERDICT, of: "c5" }));
  asRun({ FORGE_SESSION_ID: "iss-841-b" }, () => logConsult({ ...VERDICT, of: "c5", accepted: 0, rejected: 1 }));
  const [mine, theirs] = logEntries().slice(-2);
  assert.deepEqual([mine.at, mine.of], [theirs.at, theirs.of], "one clock and one consult named: neither separates them");
  assert.notEqual(mine.run, theirs.run, "what each entry says of itself does");
});

/* AC-06-5-2 covers anything written here, an id included: this log has one masking seat and not two. */
test("a run id carrying a credential shape is masked, like every other string in the entry", () => {
  const fake = "7|notarealtokennotarealtokennotarealtoken";
  asRun({ FORGE_SESSION_ID: fake }, () => logConsult({ ...VERDICT, of: "c6" }));
  assert.ok(!readFileSync(logPath(), "utf8").includes("notarealtoken"), "no part of the value is on disk");
  assert.equal(logEntries().at(-1).run, "***");
});

/* Nothing can backfill the 1,332 entries logged before the field, so a reader has to be able to tell
   an unidentified row from an attributed one, and the file has to stay append-only while it does. */
test("an entry written before the field is left unidentified and its bytes are not rewritten", () => {
  const kept = readFileSync(logPath(), "utf8");
  try {
    const legacy = { kind: "verdict", at: "2026-08-01T00:00:00.000Z", of: "old-1", accepted: 1, rejected: 1, note: "kept the blocker" };
    writeFileSync(logPath(), `${JSON.stringify(legacy)}\n`);
    const before = readFileSync(logPath(), "utf8");
    asRun({ FORGE_SESSION_ID: "iss-834-a" }, () => logConsult({ ...VERDICT, of: "c7" }));
    assert.ok(readFileSync(logPath(), "utf8").startsWith(before), "the entries already written are not rewritten");
    const [stored] = logEntries();
    assert.deepEqual([stored.run, stored.runFrom], [undefined, undefined], "and nothing infers an identity for one");
    assert.equal(logLine(stored, false), "2026-08-01T00:00:00.000Z  verdict on old-1: 1 accepted, 1 rejected  kept the blocker",
      "so its line reads exactly as it read before the field existed");
  } finally {
    writeFileSync(logPath(), kept);
  }
});
