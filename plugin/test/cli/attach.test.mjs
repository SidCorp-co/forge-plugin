/* One name on one issue names one document, whichever verb attached it (ISS-137). ISS-112 carries
   `gate-at-merge.txt` twice because the bare verb sent a file without reading what was up, and there
   is no delete for an upload — so spawned: the refusal has to land before `forge_uploads`. */
import assert from "node:assert/strict";
import test, { after } from "node:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { ranAsync, tempHome } from "../fixtures.mjs";
import { trackerFor } from "../fixtures/own-project.mjs";

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const ISSUE = "33333333-3333-4333-8333-333333333333";
const COMMENT = "44444444-4444-4444-8444-444444444444";

const issue = {
  documentId: ISSUE,
  issueId: "ISS-1",
  status: "in_progress",
  title: "one",
  attachments: [{ name: "gate-at-merge.txt", url: "/api/attachments/one/download" }],
};

/* The lease is the verb's own precondition, so the stub holds the field the claim writes rather than
   answering a stale copy: a get that forgets the update refuses every write as unclaimed. */
let context = null;
const state = { issues: [issue], comments: {}, answer: {} };
state.answer.forge_issues = (args) => {
  if (args.action === "list") return { issues: [issue], returned: 1, hasMore: false };
  if (args.action === "update") {
    if (args.data && "sessionContext" in args.data) context = args.data.sessionContext;
    return { documentId: ISSUE, ...(args.data ?? {}) };
  }
  return { ...issue, sessionContext: context };
};

/* This checkout's own record, written into the home the child reads: the project a call
   resolves is no longer a file the checkout carries. */
const { tracker, env: base } = await trackerFor(state);
after(() => tracker.close());

/* One request per file carries the bytes, so the tracker stub is where they land and this list is
   what arrived: the order the whole set went in is what ISS-577's two cases are about. */
const order = [];
state.answer.forge_uploads = (args) => {
  const name = args?.data?.name ?? "unnamed";
  order.push(`sent ${name}`);
  return { id: `up-${order.length}`, url: "/api/attachments/up/download" };
};
const sunk = () => order.filter((one) => one.startsWith("sent ")).map((one) => one.slice(5));

const room = tempHome("attach-verb");
mkdirSync(join(room.path, "sub"), { recursive: true });
const env = { ...base, FORGE_SESSION_ID: "attach-session", AI_AGENT: "a-test-agent" };
const ask = (...argv) => ranAsync(FORGE, argv, env);
const asked = () => (state.calls ?? []).filter((one) => one.name === "forge_uploads").length;

const wrote = (name, where = ".") => {
  const path = join(room.path, where === "." ? name : join(where, name));
  writeFileSync(path, `${name}\n`);
  return path;
};

const claimed = await ask("claim", "ISS-1", "--unheld");
assert.equal(claimed.status, 0, `the lease every write needs: ${claimed.stderr}`);

test("a base name already a document on the issue is refused, and nothing is sent", async () => {
  const before = asked();
  const run = await ask("attach", "issue", "ISS-1", wrote("gate-at-merge.txt"));
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /^gate-at-merge\.txt is already a document on ISS-1/mu, "the document up is named");
  assert.match(run.stderr, /resolves to two documents/u, "and what the collision costs");
  assert.match(run.stderr, /cite it by that name/u, "the first way out");
  assert.match(run.stderr, /under a name of its own/u, "the second");
  assert.equal(asked(), before, "nothing is sent for a name that would resolve two ways");
});

/* A comment's attachments are in the same namespace as the issue's — `attachmentNames` reads both,
   and a verdict citing the name cannot say which document it meant either way. */
test("a base name a comment on the issue carries is the same collision", async () => {
  state.comments[ISSUE] = [{ documentId: COMMENT, body: "one", attachments: [{ name: "shot.png" }] }];
  const before = asked();
  const run = await ask("attach", "issue", "ISS-1", wrote("shot.png"));
  state.comments[ISSUE] = [];
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /^shot\.png is already a document on ISS-1/mu);
  assert.equal(asked(), before);
});

test("two paths of one base name in one command are refused before either goes up", async () => {
  const before = asked();
  const run = await ask("attach", "issue", "ISS-1", wrote("twice.txt"), wrote("twice.txt", "sub"));
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /is named twice in this command/u);
  assert.equal(asked(), before, "the paths are read whole before the first request");
});

/* Every collision in one refusal, whichever side it collides with: one refusal per name was one
   round per name (ISS-476). */
test("every colliding name of one command is named in one refusal, and nothing is sent", async () => {
  const before = asked();
  const [up, twin] = [wrote("gate-at-merge.txt"), wrote("pair.txt", "sub")];
  const run = await ask("attach", "issue", "ISS-1", up, wrote("pair.txt"), twin);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /^2 files carry a name already a document on ISS-1, or named twice in this command:$/mu, run.stderr);
  assert.ok(run.stderr.includes(`\n  ${up}  as gate-at-merge.txt\n`), `the one already up: ${run.stderr}`);
  assert.ok(run.stderr.includes(`\n  ${twin}  as pair.txt\n`), `and the one named twice: ${run.stderr}`);
  assert.equal(asked(), before, "the paths are read whole before the first request");
});

test("a base name on none of the issue's documents is sent as before", async () => {
  const run = await ask("attach", "issue", "ISS-1", wrote("gate-at-27f1f70.txt"));
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^gate-at-27f1f70\.txt {2}\/api\/attachments\/up\/download$/mu);
  assert.ok(sunk().includes("gate-at-27f1f70.txt"), `sent ${sunk().join(", ")}`);
});

/* Where the walk cannot reach the end the names cannot be read whole — and unlike `record
   --evidence`, which can cite a URL and send nothing, a refusal here is one nothing the caller could
   type would clear. So it is said, in the count the tracker returned (ISS-131), and sent. */
test("a thread the walk could not finish is said on stderr, and the file still goes up", async () => {
  state.answer.forge_comments = (args) =>
    (args.action === "list"
      ? { comments: [{ documentId: COMMENT, body: "one of many", attachments: [] }], returned: 1, hasMore: true }
      : { documentId: COMMENT });
  /* The first call is spent on the read-before-write hold, which the page's own comment earns. */
  await ask("attach", "issue", "ISS-1", wrote("cut-page.txt"));
  const run = await ask("attach", "issue", "ISS-1", wrote("cut-page.txt"));
  delete state.answer.forge_comments;
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stderr, /^The names already on ISS-1 cannot be read whole\./mu);
  assert.match(run.stderr, /stopped after 1 comment\(s\) of 1 without the tracker ever calling the read complete/u,
    "the count the tracker returned, and no cap of ours (ISS-131)");
  assert.match(run.stderr, /resolves to two documents/u, "what the unread names could cost");
  assert.ok(sunk().includes("cut-page.txt"), `sent ${sunk().join(", ")}`);
});

/* A comment id names no issue and the tracker offers no route from one to the other, so this route
   reads no names — the same reason it renews no lease. */
test("a comment target reads no names and is refused for no collision", async () => {
  const run = await ask("attach", "comment", COMMENT, wrote("gate-at-merge.txt", "sub"));
  assert.equal(run.status, 0, run.stderr);
  assert.ok(sunk().includes("gate-at-merge.txt"), `sent ${sunk().join(", ")}`);
});

/* Nothing precedes the request carrying the bytes: a pre-flight added back is what fails here. */
test("each file goes up in one request of its own, and nothing is sent for it first", async () => {
  order.length = 0;
  const run = await ask("attach", "issue", "ISS-1", wrote("first-of-two.txt"), wrote("second-of-two.txt"));
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(order, ["sent first-of-two.txt", "sent second-of-two.txt"],
    "two files, two requests, in the order they were named");
});

/* The tracker's refusal body as the live one answered on 2026-09-27: the reason, and the set it takes. */
const ALLOWED = { mimes: ["image/png", "text/plain", "text/markdown"], anyExtensionIfText: true };
const NOT_TEXT = "mime not allowed: text/plain — the bytes are binary, and this type carries text";

/* The fake judges the bytes as the live tracker does, a NUL making them binary, so a case can send a
   file of either kind under any name. */
const judging = (own) => (args) => {
  if (!args?.part?.bytes?.includes(0)) return own(args);
  order.push(`sent ${args.data.name}`);
  return { refused: NOT_TEXT, code: "MIME_NOT_ALLOWED", details: { reason: "not-text", allowed: ALLOWED } };
};
const uploadsTo = () => (state.calls ?? []).filter((one) => one.method === "POST" && one.path.endsWith("/attachments"))
  .map((one) => one.sent.multipart);

/* ISS-80's own rule: a `.log` of text goes up as text, and a `.log` of binary is refused with the set. */
test("a .log holding text arrives typed text/plain, and a .log holding binary is refused with the tracker's set", async () => {
  order.length = 0;
  const own = state.answer.forge_uploads;
  state.answer.forge_uploads = judging(own);
  const text = wrote("gate-run-text.log");
  const binary = join(room.path, "gate-run-binary.log");
  writeFileSync(binary, Buffer.from([0x1f, 0x8b, 0x08, 0x00, 0xff, 0x00]));
  const run = await ask("attach", "issue", "ISS-1", text, binary);
  state.answer.forge_uploads = own;
  const parts = uploadsTo();
  assert.equal(parts.find((one) => one.name === "gate-run-text.log")?.mime, "text/plain", "the text went up as text");
  assert.equal(parts.find((one) => one.name === "gate-run-binary.log")?.mime, "application/octet-stream",
    "and the binary as no text type");
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /^ {2}gate-run-binary\.log — MIME_NOT_ALLOWED: mime not allowed: text\/plain/mu);
  assert.match(run.stderr, /^The tracker takes image\/png text\/plain text\/markdown, and text under any name\.$/mu);
  assert.match(run.stderr, /^ {2}file --mime-type -- /mu, "bytes that are not text are read, never renamed");
  assert.doesNotMatch(run.stderr, /\bln --/u);
});

/* One request cannot ask before it sends, so a file the tracker will not take costs that file's own
   request and no other: the rest still go, and the refusal counts both and says what to cite. */
test("a file refused mid-write leaves the rest going up, and the refusal counts both", async () => {
  order.length = 0;
  const own = state.answer.forge_uploads;
  state.answer.forge_uploads = judging(own);
  const refused = join(room.path, "refused-here.txt");
  writeFileSync(refused, "capture\u0000with a NUL\n");
  const run = await ask("attach", "issue", "ISS-1", wrote("up-before-it.txt"), refused, wrote("up-after-it.txt"));
  state.answer.forge_uploads = own;
  assert.deepEqual(order, ["sent up-before-it.txt", "sent refused-here.txt", "sent up-after-it.txt"],
    "every file of the batch was sent");
  assert.equal(run.status, 1, "a batch with a refused file exits non-zero");
  assert.match(run.stderr, /^2 of 3 file\(s\) went up to ISS-1, and 1 was refused:$/mu);
  assert.match(run.stderr, /^ {2}refused-here\.txt — MIME_NOT_ALLOWED: /mu, "the file, in the tracker's own words");
  assert.match(run.stderr, /^Up already: up-before-it\.txt, up-after-it\.txt\./mu);
  assert.match(run.stderr, /--evidence up-before-it\.txt --evidence up-after-it\.txt/u);
  assert.match(run.stderr, /\(set -C; LC_ALL=C tr -d /u, "text with a control byte is answered by stripping it");
});

/* A 401 is the credential and no verdict on the file, and would meet every file after it alike. */
test("a refusal that is not the tracker's verdict on the file stops the write, naming what it left unsent", async () => {
  order.length = 0;
  const own = state.answer.forge_uploads;
  state.answer.forge_uploads = (args) => {
    if (args?.data?.name !== "second-of-three.txt") return own(args);
    order.push(`sent ${args.data.name}`);
    return { http: 401 };
  };
  const run = await ask("attach", "issue", "ISS-1", wrote("first-of-three.txt"), wrote("second-of-three.txt"),
    wrote("third-of-three.txt"));
  state.answer.forge_uploads = own;
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /^1 of 3 file\(s\) went up to ISS-1, and 1 was refused; 1 not sent:$/mu);
  assert.match(run.stderr, /^Not sent, the write stopping at second-of-three\.txt, which the tracker did not judge: third-of-three\.txt\.$/mu);
  assert.ok(!sunk().includes("third-of-three.txt"), `sent ${sunk().join(", ")}`);
});

/* A failure on the tracker's side may have stored the file, so it is no refusal and the rest wait. */
test("a file the tracker failed on stops the write and is named as possibly up", async () => {
  order.length = 0;
  const own = state.answer.forge_uploads;
  state.answer.forge_uploads = (args) => {
    if (args?.data?.name !== "lost-answer.txt") return own(args);
    order.push(`sent ${args.data.name}`);
    return { http: 502 };
  };
  const run = await ask("attach", "issue", "ISS-1", wrote("lost-answer.txt"), wrote("behind-lost.txt"));
  state.answer.forge_uploads = own;
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /^0 of 2 file\(s\) went up to ISS-1, and 0 were refused; 1 had no answer; 1 not sent:$/mu);
  assert.match(run.stderr, /It may be up with the answer lost: read ISS-1 before sending it again/u);
  assert.deepEqual(order, ["sent lost-answer.txt"], "nothing followed a request whose outcome is unknown");
});

/* What a write puts up is what it scanned, and between the two passes the digest is what says so. */
test("a file rewritten between the scan and its request is refused, and no bytes follow", async () => {
  const first = wrote("scanned-first.txt");
  const path = wrote("swapped-after-scan.txt");
  order.length = 0;
  const own = state.answer.forge_uploads;
  /* The rewrite rides the request before it, that being the window the digest covers. */
  state.answer.forge_uploads = (args) => {
    if (args?.data?.name === "scanned-first.txt") writeFileSync(path, "credential-bearing bytes\n");
    return own(args);
  };
  const run = await ask("attach", "issue", "ISS-1", first, path);
  state.answer.forge_uploads = own;
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /changed on disk between the scan that cleared it and its upload/u);
  assert.deepEqual(order, ["sent scanned-first.txt"], "the one before it went and nothing followed");
});

/* The scan is the write's other refusal, and its ordering is ISS-577's where the refusal is not. */
test("a credential in the last file is refused before the first of them is sent", async () => {
  const secret = "staging-password-nobody-should-attach";
  state.answer["forge_projects.get"] = () => ({ project: { environments: { preview: { url: "https://staging.test" }, testCredentials: [{ password: secret }] } } });
  order.length = 0;
  const clean = wrote("scan-first.txt");
  const leaky = join(room.path, "scan-second.txt");
  writeFileSync(leaky, `the deploy takes ${secret}\n`);
  const run = await ask("attach", "issue", "ISS-1", clean, leaky);
  delete state.answer["forge_projects.get"];
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /carries this project's/u, "the leak is named");
  assert.deepEqual(order, [], "and the file before it was never sent, its request never made");
});
