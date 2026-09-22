/* `forge codex log` prints the log back into a session, so what a line says of an entry — and what it refuses to let through on the way — is decided here, on entries handed in. */
import assert from "node:assert/strict";
import test from "node:test";
import { tempRoom } from "../../fixtures.mjs";

/* Imported after XDG_CONFIG_HOME moves, so anything reading the real log path reads a sandbox. */
const sandbox = tempRoom("forge-codex-log-verbs-");
process.env.XDG_CONFIG_HOME = sandbox;

const {
  logLine,
  startedState,
} = await import("../../../src/codex/log/verbs.mjs");

/* The same fake shape the write side is proved on, at the depth a reply carries it: this half is what the printer does with an entry stored before the mask existed. */
const FAKE = "7|notarealtokennotarealtokennotarealtoken";

test("a start inside the budget reads as running, past it as lost", () => {
  const at = "2026-08-31T08:00:00.000Z";
  const base = Date.parse(at);
  assert.match(startedState({ at }, base + 30_000), /running for 30s/);
  assert.match(startedState({ at }, base + 1_000_000), /never reported back/);
});

/* The write-side mask reaches nothing written before it, and the log is append-only with no pass that rewrites it (ISS-266). So the printer masks what it prints: an entry stored unmasked — every entry before 3.35.88 — comes back masked whichever way this verb is asked for it. */
const STORED_UNMASKED = {
  kind: "consult",
  id: "old-1",
  at: "2026-08-01T00:00:00.000Z",
  root: "/a",
  ok: true,
  ms: 2000,
  head: "abc1234",
  files: ["a.mjs"],
  sent: [{ rel: "a.mjs", sha: "9f2c", chars: 812 }],
  reply: `CODEX: 2 findings (1 major, 1 minor)\n- **F1 — major:** \`a.mjs:3\` — it ships --token ${FAKE} in the header.`,
};

test("an entry written before the write-side mask is masked on the way out", () => {
  const said = logLine(STORED_UNMASKED, true);
  assert.ok(!said.includes("notarealtoken"), "no part of the value reaches the session");
  assert.match(said, /it ships --token \*\*\* in the header/u, "and the prose around it is still readable");
});

test("a verdict's note is masked too, which is the other stored string this verb prints", () => {
  const said = logLine({
    kind: "verdict",
    at: "2026-08-01T00:01:00.000Z",
    of: "old-1",
    accepted: 1,
    rejected: 1,
    note: `kept F1: the fixture really did log in with ${FAKE}`,
  }, false);
  assert.ok(!said.includes("notarealtoken"));
  assert.match(said, /verdict on old-1: 1 accepted, 1 rejected {2}kept F1: the fixture really did log in with \*\*\*/u);
});

/* Masking shortens a reply, so a count taken off the masked copy would report a smaller eval set than was reviewed. The prose is the masked copy's; the numbers are the entry's own. */
test("the counts are read off the entry and not off what printed", () => {
  const said = logLine(STORED_UNMASKED, false);
  assert.match(said, new RegExp(`\\s${STORED_UNMASKED.reply.length}ch\\s`, "u"),
    "the reply's own length, not the masked one's");
  assert.match(said, /2 finding\(s\)/u);
});

/* What licenses masking at both ends: they answer different questions — what accumulates on disk from here, and what reaches a transcript now — and running both changes nothing twice. */
test("an entry already masked at the write passes through unchanged", () => {
  const clean = { ...STORED_UNMASKED, reply: STORED_UNMASKED.reply.replace(FAKE, "***") };
  const said = logLine(clean, true);
  assert.ok(said.includes(clean.reply), "a record written since 3.35.88 prints its stored prose verbatim");
  assert.match(said, new RegExp(`\\s${clean.reply.length}ch\\s`, "u"), "and reports its own length");
});

/* The line a run reads back months later, the stderr it read at the time being long gone. A row from before any of this prints nothing in that place, which is what tells it apart from one whose checkout declared no command (ISS-1898). */
test("the line says which state the declared check left the round in, and says nothing for a row from before", () => {
  const of = (extra) => logLine({ ...STORED_UNMASKED, ...extra }, false).split("\n")[0];
  assert.doesNotMatch(of({}), /check/u, "a row written before the field existed claims nothing");
  assert.match(of({ check: "declined", checkCommand: "npm test" }), /\s{2}check declined\s{2}by |\s{2}check declined$/u);
  assert.match(of({ check: "none" }), /\s{2}check none$/u, "and a checkout that declared none says so rather than reading as absent");
  assert.match(of({ check: "cut", checkCommand: "npm test" }), /\s{2}check cut$/u);
  /* Which command it was belongs to the entry read whole, being what a row is worth once the project's own `codex.check` has moved off the value this round ran. */
  assert.match(logLine({ ...STORED_UNMASKED, check: "ran", checkCommand: "npm test" }, true),
    /\n {2}check {3}ran {2}npm test\n/u);
  assert.doesNotMatch(logLine({ ...STORED_UNMASKED, check: "none" }, true), /\n {2}check {3}/u,
    "and there is no command to print where none was declared");
});

/* A reading that is not a review is in this log too, and the rest of the line is a review's: keyed
   on the kind, it says what it was taken over and what came back; keyed on nothing, it said `no
   commit` of a reading about no commit and carried a blank files line under it. */
test("a diagnostic reads as what it was taken over, not as a review with no files", () => {
  const row = {
    kind: "diagnostic", at: "2026-09-20T20:26:28.190Z", model: "cx/gpt-6-astra-high", ms: 58_000,
    ok: true, replyRead: true, findings: 7, leftOut: 2, run: "iss-1995-x", runFrom: "asked",
    runs: [{ label: "R1" }, { label: "R2" }, { label: "R3" }],
  };
  assert.equal(logLine(row, false),
    "2026-09-20T20:26:28.190Z  cx/gpt-6-astra-high  58s  diagnostic over 3 run(s)  "
    + "7 finding(s), 2 citing no call of the set  by iss-1995-x (asked)");
  const whole = logLine({ ...row, reply: "FINDING 1\nCITES R1/1\nDIAGNOSTIC: 1 findings" }, true);
  assert.doesNotMatch(whole, /files/u, "and the full form carries no files line either");
  assert.match(whole, /^ {2}runs {3}R1 {2}R2 {2}R3$/mu, "it names the runs where a review names its files");
  assert.match(whole, /FINDING 1\nCITES R1\/1\nDIAGNOSTIC: 1 findings/u,
    "and `--full` still opens the reply, which is the whole point of asking for one");
  assert.match(logLine({ ...row, replyRead: false, findings: 0, leftOut: 0, reply: "no shape at all" }, true),
    /no shape at all/u, "an unread reply above all: it is the row somebody most wants to open");
  assert.match(logLine({ ...row, replyRead: false, findings: 0, leftOut: 0 }, false),
    /diagnostic over 3 run\(s\) {2}the reply unread {2}by/u,
    "a reply this reader could not read is said to be, never printed as one that found nothing");
  assert.match(logLine({ ...row, ok: false, error: "the gateway streamed no text at all" }, false),
    /failed: the gateway streamed no text at all/u);
});

/* The second non-review kind in this log, and the printer's one distinction that a review has not
   got: a refusal — the band came back outside the ladder — is the row's own word, where `failed` is
   the gateway's. */
test("a band row reads as the issue it read and the band proposed, not as a review with no files", () => {
  const row = {
    kind: "band", at: "2026-09-22T10:00:00.000Z", model: "cx/gpt-5.6-sol", ms: 4_000,
    ok: true, key: "ISS-457", band: "s", confidence: 0.8, why: "one file, one enum",
    run: "iss-2161-x", runFrom: "asked",
  };
  assert.equal(logLine(row, false),
    "2026-09-22T10:00:00.000Z  cx/gpt-5.6-sol  4s  band ISS-457 -> s  confidence 0.8  by iss-2161-x (asked)");
  const whole = logLine(row, true);
  assert.doesNotMatch(whole, /files/u, "and the full form carries no files line");
  assert.match(whole, /one file, one enum/u, "the why opens under --full");
  assert.equal(logLine({ ...row, confidence: null }, false),
    "2026-09-22T10:00:00.000Z  cx/gpt-5.6-sol  4s  band ISS-457 -> s  by iss-2161-x (asked)",
    "a confidence the model did not give is not printed as one");
  assert.match(logLine({ ...row, band: undefined, refused: "`huge` is no band" }, false),
    /band ISS-457 {2}refused: `huge` is no band/u, "an answer outside the ladder is the row's own refusal");
  assert.match(logLine({ ...row, ok: false, error: "the gateway streamed no text at all" }, false),
    /band ISS-457 {2}failed: the gateway streamed no text at all/u);
});
