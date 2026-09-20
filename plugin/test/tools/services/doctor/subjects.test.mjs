/* `forge doctor`'s subjects, and what a bare reading owes one it withholds. The 2,500-byte help cap
   forced the split: nine flags were named in the usage and described nowhere (ISS-1692). */
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { tempRoom } from "../../../fixtures.mjs";
import {
  IN_BARE, SAYS, SUBJECTS, SUBJECT_SLUGS, USAGE, WIDENED,
} from "../../../../src/tools/services/doctor/subjects.mjs";
import { flagsNamed } from "../../../../src/resolve/flags.mjs";
import { usageOf } from "../../../../src/resolve/visibility.mjs";

const CLI = new URL("../../../../src/cli.mjs", import.meta.url).pathname;

/* A home of its own and no credential, so no spawn below reaches a tracker. */
const doctor = (...argv) => {
  const home = tempRoom("doctor-subjects-home-");
  const run = spawnSync(process.execPath, [CLI, "doctor", ...argv], {
    encoding: "utf8",
    env: { PATH: process.env.PATH, HOME: home, XDG_CONFIG_HOME: home },
  });
  return `${run.stdout}${run.stderr}`;
};

/* Over twelve characters, under which `abbreviated` prints `set` whether --full is given or not. */
const TOKEN = `forge_${"z".repeat(30)}head`;

/* A credential saved and no project: the slug is read before any request, so nothing waits on a host. */
const withCredential = (...argv) => {
  const home = tempRoom("doctor-subjects-cred-");
  mkdirSync(join(home, "forge"), { recursive: true });
  writeFileSync(join(home, "forge", "config.json"),
    JSON.stringify({ url: "http://127.0.0.1:1/mcp", token: TOKEN }));
  const run = spawnSync(process.execPath, [CLI, "doctor", ...argv], {
    encoding: "utf8",
    cwd: tempRoom("doctor-subjects-cwd-"),
    env: { PATH: process.env.PATH, HOME: home, XDG_CONFIG_HOME: home },
  });
  return { said: `${run.stdout}${run.stderr}`, status: run.status };
};

/* The second half of the same cause the review found: a reading the report gives up on is reported
   to whoever asked for it, or a subject prints nothing and exits green (ISS-1692, codex F1 twice). */
test("a subject that needs the project and finds no slug says so and exits on it", () => {
  const asked = withCredential("brief");
  assert.match(asked.said, /\[ miss \] project slug\s+no project slug resolves here/u);
  assert.match(asked.said, /\.forge\.json at the root of this checkout/u, "and the one command that clears it");
  assert.equal(asked.status, 1, "a reading nobody could take is not a green one");
  const bare = withCredential();
  assert.match(bare.said, /\[ note \] project slug\s+project-scoped calls will refuse/u,
    "while a bare reading keeps the note: a credential outside any checkout is an ordinary state");
  assert.doesNotMatch(bare.said, /\[ miss \] project slug/u);
  assert.match(bare.said, /No project slug: capability probes are project-scoped and were skipped/u);
  assert.equal(bare.status, 0, "and stays green: the note is the whole of what it counts");
});

/* A help line naming a flag the verb then refuses is a dropped input read from the other end, so the
   usage line offers --full where and only where the guard takes it (ISS-1692, codex F1). */
test("the verb's help gives every subject a line, and each subject's help opens on its own call", () => {
  for (const { slug, says, text, full } of SUBJECTS) {
    assert.ok(USAGE.includes(`  ${slug.padEnd(10)} ${says}`), `the verb's help gives ${slug} no line`);
    assert.equal(text.split("\n")[0], `Usage: forge doctor ${slug}${full ? " [--full]" : ""}`,
      `${slug}'s own help does not open on the call that prints it`);
    assert.equal(text.includes("--full"), Boolean(full),
      `${slug} ${full ? "takes --full and its help never names it" : "refuses --full and its help offers it"}`);
    assert.equal(SAYS[slug], text, `${slug}'s text and the map the call answers from differ`);
  }
  assert.deepEqual(Object.keys(SAYS).sort(), [...SUBJECT_SLUGS].sort());
});

/* Read off the usage row rather than off a list here, so a flag added to the verb arrives in this
   case with no second edit and lands on some subject or fails. */
test("every flag the verb takes is described under exactly one subject, and --full under the verb", () => {
  const owning = (flag) => SUBJECTS.filter(({ text }) => text.includes(flag)).map(({ slug }) => slug);
  const wrong = [];
  for (const flag of flagsNamed(usageOf("doctor"))) {
    if (flag === "--full") {
      if (!USAGE.includes(flag)) wrong.push(`${flag} is the report's own and the verb's help omits it`);
      continue;
    }
    const held = owning(flag);
    if (held.length !== 1) wrong.push(`${flag} is described by ${held.length} subject(s): ${held.join(", ") || "none"}`);
  }
  assert.deepEqual(wrong, []);
});

/* Checked at the layer that owns each: a flag a caller can find but not use has moved, not fixed. */
test("the flags the top-level help had no room for are described where a caller reaches them", () => {
  for (const [flag, slug] of [["--hide", "offer"], ["--show", "offer"], ["--ship", "project"], ["--job", "offer"]]) {
    assert.ok(SAYS[slug].includes(`forge doctor ${flag}`),
      `${flag} is not spelled as a call under ${slug}`);
  }
});

test("a subject asked for prints its own rows and no other subject's", () => {
  const said = doctor("machine");
  assert.match(said, /^\[ miss \] endpoint url/mu, "the subject's own rows");
  assert.match(said, /^\[ {2}ok {2}\] session id/mu);
  assert.doesNotMatch(said, /^\[[^\]]+\] (jobs|copy on PATH|contract|dependencies|rest base)/mu,
    "and nothing of offer, copy, serves, repo or tracker");
  assert.match(said, /The rest of the reading, subject by subject: `forge doctor -h`/u,
    "a layer that cannot carry something says which one does");
});

/* The scored prose that sat mid-list is the row's supporting reading, not the finding. */
test("a bare reading keeps a withheld subject's findings, drops its ok rows and leaves its detail", () => {
  const said = doctor();
  assert.match(said, /^\[ note \] claude\.md comment/mu, "the finding of a subject a bare call withholds");
  assert.doesNotMatch(said, /restated: deliberate/u, "and not the block under it");
  assert.doesNotMatch(said, /^\[ {2}ok {2}\] dependencies/mu, "nor that subject's ok rows");
  assert.match(said, /forge doctor repo {7}this checkout's own health/u,
    "and the call that prints it whole is named");
});

/* Every other flag writes and returns before the report; these two ask for a reading. */
test("a flag whose reading a subject does not hold is refused, not dropped", () => {
  const said = doctor("machine", "--credentials");
  assert.match(said, /--credentials prints the test credentials/u);
  assert.match(said, /Send `forge doctor project --credentials`/u, "and the call that reads it");
  assert.doesNotMatch(said, /^\[/mu, "a refusal reports nothing");
  const widened = doctor("copy", "--full");
  assert.match(widened, new RegExp(`which is ${WIDENED.join(", ")}`, "u"), widened);
  assert.doesNotMatch(widened, /^\[/mu);
  /* Off the row, not off the refusal's absence, which empty output satisfies too (ISS-1692, F2). */
  assert.ok(withCredential("machine").said.includes(`set (${TOKEN.length} chars)`),
    "the token row masks the value where the flag is not given");
  assert.ok(withCredential("machine", "--full").said
    .includes(`${TOKEN.slice(0, 6)}\u2026${TOKEN.slice(-4)} (${TOKEN.length} chars)`),
    "and a reading --full does widen prints the ends of it");
});

test("a word that is no subject is refused with the nearest, and nothing is read", () => {
  const said = doctor("trakcer");
  assert.match(said, /No doctor subject named trakcer\. Did you mean: tracker\?/u);
  assert.doesNotMatch(said, /^\[/mu, "a refusal reports nothing");
  const prose = doctor("A line of a brief.");
  assert.match(prose, /`A line of a brief\.` names no flag/u,
    "and a sentence is --line's prose, which no nearest name could be about");
});

test("the subjects a bare call reads are the table's own, and four are not among them", () => {
  assert.deepEqual([...IN_BARE].sort(), ["brief", "copy", "machine", "offer", "project", "services"]);
  assert.deepEqual(SUBJECTS.filter((one) => !one.bare).map((one) => one.slug),
    ["undecided", "serves", "repo", "tracker"]);
});

/* The read point ISS-1460 measured, held as what it is: a position in the one order this report is
   built in. Regrouping the row above the local checks reads correctly and silently costs the whole
   3.4s round trip, and elapsed time is what this suite refuses to bound. That the ask is already
   running when the row is read is release.test.mjs's half. */
test("the release ask is started above the report's local checks and read below them", () => {
  const source = readFileSync(new URL("../../../../src/tools/doctor.mjs", import.meta.url), "utf8");
  const at = (mark) => {
    const found = source.indexOf(mark);
    assert.notEqual(found, -1, `${mark} is no longer in the report, so this case measures nothing`);
    return found;
  };
  const started = at("shown(\"copy\") ? startRelease()");
  const local = at("checkClaudeMdLocally();");
  const read = at("report(await copyRows(release))");
  assert.ok(started < local, "the ask is started above the work it overlaps");
  assert.ok(local < read, "and read below it: above these checks puts the whole round trip back");
});
