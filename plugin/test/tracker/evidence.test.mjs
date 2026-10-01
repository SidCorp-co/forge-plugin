/* An --evidence value that was a file on disk cost `forge attach` and a re-send of the same record,
   twenty times over one verdict loop (ISS-59's run). Each rule here fails without its check. */
import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { join } from "node:path";

import { attachPlan, batchRefusal, evidenceProblem, localFile, uploaded, urlBearing } from "../../src/tracker/evidence.mjs";
import { escaped, tempRoom } from "../fixtures.mjs";

const DIR = tempRoom("evidence-");
const FILE = join(DIR, "iss65-evidence.md");
writeFileSync(FILE, "# evidence\n");
mkdirSync(join(DIR, "a-directory"));
/* What a shell reads an operand the refusal printed as, so the path is judged against itself and never
   against a spelling the quoter under test produced. */
const readBack = (operand) => execFileSync("sh", ["-c", `printf '%s' ${operand}`], { encoding: "utf8" });
const operandOf = (said, pattern) => readBack(said.match(pattern)?.[1] ?? "''");
const held = (names) => (ref) => /^https?:\/\//u.test(ref) || /^[0-9a-f]{7,40}$/iu.test(ref) || names.includes(ref);

test("a path is evidence when it is a readable file, and a directory is not", () => {
  assert.deepEqual(localFile(FILE), { path: FILE, name: "iss65-evidence.md" });
  assert.equal(localFile(join(DIR, "a-directory")), null, "a directory is no document");
  assert.equal(localFile(join(DIR, "nothing-here.md")), null);
  assert.equal(localFile(""), null);
  assert.equal(localFile(undefined), null);
});

/* `find` hands back the value it found, and an empty one read as nothing found let a blank through,
   and every bad value behind it (ISS-196). */
test("an empty value is a problem like any value that is none of the three, wherever it stands", () => {
  assert.match(evidenceProblem([""], []) ?? "", /^Evidence `` is no attachment on this issue/u);
  assert.match(evidenceProblem(["c8c3550", ""], ["a.md"]) ?? "", /^Evidence `` is no attachment/u);
  assert.equal(evidenceProblem(["c8c3550", "a.md"], ["a.md"]), null);
});

/* A mistyped path was sent to `forge attach`, which then failed on the same missing file (ISS-2506). */
test("a path naming no file is refused as a missing file, with the directory to read the name off", () => {
  const asked = join(DIR, "iss65-evidenc.md");
  const said = evidenceProblem([asked], ["a.md"]) ?? "";
  assert.match(said, new RegExp(`^Evidence \`${escaped(asked)}\` names no readable file`, "u"));
  assert.doesNotMatch(said, /no attachment|forge attach|Attached:/u);
  assert.equal(operandOf(said, /\n {2}ls -- (.+)$/u), DIR);
});

test("a path under a directory that does not exist says so, and lists the nearest one that does", () => {
  const asked = join(DIR, "gone", "deeper", "x.txt");
  const said = evidenceProblem([asked], []) ?? "";
  assert.match(said, new RegExp(`${escaped(join(DIR, "gone", "deeper"))} is no directory here`, "u"));
  assert.equal(operandOf(said, /\n {2}ls -- (.+)$/u), DIR);
});

test("a relative path is named as typed and as resolved", () => {
  const said = evidenceProblem(["no-such-dir/x.txt"], []) ?? "";
  assert.match(said, new RegExp(`^Evidence \`no-such-dir/x\\.txt\` \\(${escaped(join(process.cwd(), "no-such-dir", "x.txt"))}\\) names no readable file`, "u"));
});

test("a bare name and a readable file keep the refusal that sends the caller to attach", () => {
  for (const ref of ["missing.md", FILE]) {
    const said = evidenceProblem([ref], ["a.md"]) ?? "";
    assert.match(said, new RegExp(`^Evidence \`${escaped(ref)}\` is no attachment on this issue`, "u"));
    assert.match(said, /Attach it first \(forge attach issue <ref> <file>\)/u);
  }
});

test("a file on disk is put up under its base name and cited by it", () => {
  const plan = attachPlan([FILE], [], held([]));
  assert.deepEqual(plan.upload, [{ path: FILE, name: "iss65-evidence.md" }]);
  assert.deepEqual(plan.cite, ["iss65-evidence.md"], "and the record cites the name, never the path");
  assert.equal(plan.refusal, null);
});

/* A name attached twice resolves to two documents and every verdict citing it is ambiguous (ISS-55),
   so the collision is refused with the two ways out rather than uploaded. */
test("a path whose name is already attached is refused, and the refusal names it", () => {
  const plan = attachPlan([FILE], ["iss65-evidence.md"], held(["iss65-evidence.md"]));
  assert.deepEqual(plan.upload, [], "nothing goes up before the whole plan is read");
  assert.match(plan.refusal, /already on this issue/u);
  assert.match(plan.refusal, /--evidence iss65-evidence\.md/u, "the one command that cites what is there");
});

/* The one collision keeps the message it always had, word for word (ISS-476). */
test("a single collision is refused in the words it always was", () => {
  const plan = attachPlan([FILE], ["iss65-evidence.md"], held(["iss65-evidence.md"]));
  assert.equal(plan.refusal, `${FILE} is a file on disk and iss65-evidence.md is already on this issue, `
    + "or named twice in this command. A name attached twice resolves to two documents. Cite the one "
    + "that is there:\n  --evidence iss65-evidence.md\nor amend it under a name of its own and cite that.");
});

/* A refusal naming only the first collision cost one round per colliding path (ISS-476). */
test("every collision of one plan is named, each with the citation that clears it", () => {
  const room = join(DIR, "several");
  mkdirSync(join(room, "twin"), { recursive: true });
  const [up, own, same, twin] = ["up.txt", "own.txt", "same.txt", join("twin", "same.txt")].map((name) => join(room, name));
  for (const path of [up, own, same, twin]) writeFileSync(path, "x\n");
  const plan = attachPlan([up, own, same, "4e41dfd", twin], ["up.txt"], held(["up.txt"]));
  assert.deepEqual([plan.upload, plan.cite], [[], []], "nothing goes up and nothing is cited");
  assert.equal(plan.refusal, "2 files on disk carry a name already on this issue, or named twice in this "
    + "command. A name attached twice resolves to two documents. Cite the one that is there in place of "
    + `each path:\n  ${up}  --evidence up.txt\n  ${twin}  --evidence same.txt\n`
    + "or amend each under a name of its own and cite that.");
});

test("a name, a URL and a commit are cited as they stand, and nothing is uploaded", () => {
  const names = ["a-screenshot.png"];
  const refs = ["a-screenshot.png", "https://example.test/run/1", "4e41dfd"];
  const plan = attachPlan(refs, names, held(names));
  assert.deepEqual(plan.upload, []);
  assert.deepEqual(plan.cite, refs);
});

/* Two paths whose base names are one name is the same ambiguity as a name already attached, and the
   plan is read whole before anything goes up, so the second is seen. */
test("two files with one base name in the same command is the collision too", () => {
  const other = join(DIR, "a-directory", "iss65-evidence.md");
  writeFileSync(other, "# another\n");
  const plan = attachPlan([FILE, other], [], held([]));
  assert.deepEqual(plan.upload, [], "nothing goes up when the plan cannot be read whole");
  assert.match(plan.refusal, /named `?twice in this command/u);
});

/* The one case where a citation and a file are the same string: refusing it would name the citation
   the author already made, and the default off the record cites exactly this (F2 of the recheck). */
test("a citation that is also a file here is cited and said, not refused", () => {
  const said = [];
  const stderr = console.error;
  console.error = (line) => said.push(line);
  let plan = null;
  try {
    plan = attachPlan([FILE], [FILE], () => true);
  } finally {
    console.error = stderr;
  }
  assert.deepEqual(plan.upload, [], "what is up is not sent again");
  assert.deepEqual(plan.cite, [FILE]);
  assert.equal(plan.refusal, null, "a refusal here has no route to name");
  assert.match(said.join("\n"), /is on this issue and is also a file here/u, "and the ambiguity is said");
});

/* A document called `deadbee` is seven hex digits too, and a verdict citing it as a commit points
   at nothing: the file wins, and the line says the other reading was there (F2 of the final review). */
test("a readable file whose name reads as a commit goes up as a file, and says so", () => {
  writeFileSync(join(DIR, "deadbee"), "a document, not a sha\n");
  const cwd = process.cwd();
  const said = [];
  const stderr = console.error;
  console.error = (line) => said.push(line);
  let plan = null;
  try {
    process.chdir(DIR);
    plan = attachPlan(["deadbee"], [], held([]));
  } finally {
    process.chdir(cwd);
    console.error = stderr;
  }
  assert.equal(plan.upload.length, 1, "the file goes up");
  assert.match(plan.upload[0].path, /deadbee$/u);
  assert.deepEqual(plan.cite, ["deadbee"]);
  assert.match(said.join("\n"), /readable file here and goes up as one/u);
  const nowhere = attachPlan(["deadbee"], [], held([]));
  assert.deepEqual(nowhere.upload, [], "and the same value with no file behind it is cited as the commit");
  assert.deepEqual(nowhere.cite, ["deadbee"]);
});

/* The tracker's refusal body as the live one answered on 2026-09-27, trimmed to what is read. */
const ALLOWED = { reason: "not-text", allowed: { mimes: ["image/png", "text/plain", "text/html"], anyExtensionIfText: true } };
const NOT_TEXT = "MIME_NOT_ALLOWED: mime not allowed: text/plain — the bytes are binary, and this type carries text";
const refusedOne = (name, { utf8 = true, said = NOT_TEXT, details = ALLOWED, status = 400 } = {}) =>
  ({ name, path: join(DIR, name), utf8, said, details, status });

/* ISS-80: the set printed was this CLI's copy of the tracker's, so a name missing from it read as refused. */
test("a type refusal names the file in the tracker's words and prints the set the tracker's body carried", () => {
  const said = batchRefusal("ISS-1", { sent: [], refused: [refusedOne("gate.log")], unsent: [] });
  assert.match(said, /^0 of 1 file\(s\) went up to ISS-1, and 1 was refused:$/mu);
  assert.match(said, /^ {2}gate\.log — MIME_NOT_ALLOWED: mime not allowed: text\/plain — the bytes are binary/mu);
  assert.match(said, /^The tracker takes image\/png text\/plain text\/html, and text under any name\.$/mu);
  assert.doesNotMatch(said, /\.png \.jpg|This CLI types/u, "no extension list of this CLI's own");
});

test("a type refusal whose body carries no set says the tracker named none", () => {
  const said = batchRefusal("ISS-1", { sent: [], refused: [refusedOne("gate.log", { details: null })], unsent: [] });
  assert.match(said, /^The tracker's refusal named no set of types it takes\.$/mu);
});

test("the refusal counts what went up and what was refused, and cites what is up by name", () => {
  const said = batchRefusal("ISS-1", {
    sent: ["first.txt", "second.txt"], refused: [refusedOne("a.log"), refusedOne("b.log")], unsent: [],
  });
  assert.match(said, /^2 of 4 file\(s\) went up to ISS-1, and 2 were refused:$/mu);
  assert.match(said, /^ {2}a\.log — /mu);
  assert.match(said, /^ {2}b\.log — /mu);
  assert.match(said, /^Up already: first\.txt, second\.txt\. Cite them by name rather than by path/mu);
  assert.match(said, /^ {2}--evidence first\.txt --evidence second\.txt$/mu);
});

/* finding cab3efb3: a rename resends the bytes the tracker judged, so it can clear no content refusal. */
test("bytes that decode as text are answered with the command that strips their control bytes", () => {
  const said = batchRefusal("ISS-1", { sent: [], refused: [refusedOne("capture.txt")], unsent: [] });
  assert.match(said, /so it is their control bytes the tracker read as binary/u);
  const capture = join(DIR, "capture.txt");
  const plain = join(DIR, "capture-plain.txt");
  assert.match(said, /^ {2}\(set -C; LC_ALL=C tr -d '[^']+' < .+ > .+\)$/mu);
  assert.equal(operandOf(said, /^ {2}\(set -C;.* < (.+) > .+\)$/mu), capture);
  assert.equal(operandOf(said, /^ {2}\(set -C;.* < .+ > (.+)\)$/mu), plain);
  assert.match(said, /^ {4}then send capture-plain\.txt in place of capture\.txt\.$/mu);
  assert.doesNotMatch(said, /\bln --/u, "and no rename");
});

test("bytes that do not decode as text are answered with the read of what they are, and no rename", () => {
  const said = batchRefusal("ISS-1", { sent: [], refused: [refusedOne("probe-gz.txt", { utf8: false })], unsent: [] });
  assert.match(said, /The bytes do not decode as text/u);
  assert.equal(operandOf(said, /^ {2}file --mime-type -- (.+)$/mu), join(DIR, "probe-gz.txt"));
  assert.doesNotMatch(said, /\bln --|\.txt\.txt|tr -d/u, "no rename and no strip of bytes that are not text");
});

/* A 401 or a dropped answer is no fact about the file, so no set and no way out is offered against it. */
test("a refusal that is not about the type offers no set, and names the files it left unsent", () => {
  const said = batchRefusal("ISS-1", {
    sent: ["first.txt"],
    refused: [refusedOne("second.txt", { said: "Forge answered 401: token expired", details: null, status: 401 })],
    unsent: ["third.txt", "fourth.txt"],
  });
  assert.match(said, /^1 of 4 file\(s\) went up to ISS-1, and 1 was refused; 2 not sent:$/mu);
  assert.match(said, /token expired/u);
  assert.match(said, /^Not sent, the write stopping at second\.txt, which the tracker did not judge: third\.txt, fourth\.txt\.$/mu);
  assert.doesNotMatch(said, /The tracker takes|named no set|Do this/u);
});

/* A request with no answer may have landed, so it is neither up nor refused, and a retry of its path
   could put it up twice. */
test("a file with no answer is counted apart, and the caller is sent to read the issue before resending it", () => {
  const said = batchRefusal("ISS-1", {
    sent: ["first.txt"],
    refused: [refusedOne("second.txt", { said: "Forge did not answer POST /issues/u/attachments", details: null, status: null })],
    unsent: ["third.txt"],
  });
  assert.match(said, /^1 of 3 file\(s\) went up to ISS-1, and 0 were refused; 1 had no answer; 1 not sent:$/mu);
  assert.match(said, /^ {4}It may be up with the answer lost: read ISS-1 before sending it again, and cite second\.txt by name if it is there\.$/mu);
  const failed = batchRefusal("ISS-1", { sent: [], refused: [refusedOne("x.txt", { said: "Forge answered 502", details: null, status: 502 })], unsent: [] });
  assert.match(failed, /1 had no answer/u, "a failure on the tracker's side may have stored the file too");
});

/* The one action a refusal prints is only an action if running it does what it says, so it is run:
   a name a shell would read, a name a program would read as a flag, and a destination already there. */
const ranWayOut = (name, cwd) => {
  const said = batchRefusal("ISS-1", { sent: [], refused: [{ ...refusedOne(name), path: name }], unsent: [] });
  const line = said.split("\n").find((one) => one.includes("tr -d"));
  return spawnSync("sh", ["-c", line.trim()], { cwd, encoding: "utf8" });
};

test("the command the refusal prints strips the control bytes, and refuses a destination already there", () => {
  const room = tempRoom("strip-command-");
  writeFileSync(join(room, "$(touch PWNED) it's.log"), "ring\u0007 \u001b[31mred\u001b[0m\r\nnext\tline\n");
  assert.equal(ranWayOut("$(touch PWNED) it's.log", room).status, 0, "a name a shell would read is one path");
  assert.equal(readFileSync(join(room, "$(touch PWNED) it's-plain.log"), "utf8"), "ring [31mred[0m\r\nnext\tline\n",
    "the control bytes go, and tab, CR and line feed stay");
  assert.equal(existsSync(join(room, "PWNED")), false, "and nothing in it ran");
  writeFileSync(join(room, "-f.log"), "flag\u0001-shaped\n");
  assert.equal(ranWayOut("-f.log", room).status, 0, "a leading hyphen is a path to a redirection");
  assert.equal(readFileSync(join(room, "-f-plain.log"), "utf8"), "flag-shaped\n");
  writeFileSync(join(room, "held.log"), "new\u0007\n");
  writeFileSync(join(room, "held-plain.log"), "already here\n");
  assert.notEqual(ranWayOut("held.log", room).status, 0, "a destination already there is refused");
  assert.equal(readFileSync(join(room, "held-plain.log"), "utf8"), "already here\n", "and its bytes stand");
});

test("the upload answer is read for its url, and one carrying none is printed whole", () => {
  assert.equal(uploaded({ documentId: "x", name: "n", url: "https://example.test/n" }), "https://example.test/n");
  const bare = { documentId: "x", name: "n" };
  assert.equal(uploaded(bare), bare, "the row itself, since a reader needs to see what came back");
  assert.equal(urlBearing({ url: "https://example.test/n" }), true);
  assert.equal(urlBearing({ url: 12 }), false);
});
