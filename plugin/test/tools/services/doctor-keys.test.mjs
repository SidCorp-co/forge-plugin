/* The row that tells an adopting project whether its declaration will ever do anything. Spawned
   rather than called, because what is under test is the sentence a developer reads and the project
   file resolves once per process (ISS-1883). */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { fakeTracker, git, homeEnv, ranAsync, shortPage, tempRoom } from "../../fixtures.mjs";

const FORGE = new URL("../../../bin/forge", import.meta.url).pathname;

const ran = (room, ...args) => {
  const done = git(room, ...args);
  assert.equal(done.status, 0, `git ${args.join(" ")}: ${done.stderr}`);
};

const wrote = (room, path, lines) => {
  const at = join(room, path);
  mkdirSync(join(at, ".."), { recursive: true });
  writeFileSync(at, `${Array.from({ length: lines }, (one, index) => index).join("\n")}\n`);
};

const built = (name, review, { mark = true } = {}) => {
  const room = tempRoom(`review-row-${name}-`);
  wrote(room, join("app", "kept.txt"), 1);
  writeFileSync(join(room, ".forge.json"), JSON.stringify({ slug: name, ...review }));
  ran(room, "init", "-q", "-b", "master", ".");
  ran(room, "add", "-A");
  ran(room, "commit", "-q", "-m", "the first commit");
  if (mark) ran(room, "update-ref", "refs/forge/reviewed", "HEAD");
  return room;
};

const rowIn = async (room, name) => {
  const { stdout } = await ranAsync(FORGE, ["doctor", "project"], homeEnv(`review-row-${name}`), room);
  return stdout.split("\n").filter((one) => one.includes("] review ")).join("\n");
};

test("a project that declared neither key gets no review row at all", async () => {
  for (const [at, review] of [{}, { review: {} }, { review: null }].entries()) {
    assert.equal(await rowIn(built(`silent-${at}`, review), `silent-${at}`), "",
      `${JSON.stringify(review)} printed a row`);
  }
});

test("a declaration this repository cannot count is a miss naming the paths and the key to set", async () => {
  const said = await rowIn(built("elsewhere", { review: { lines: 40 } }), "elsewhere");
  assert.match(said, /^\[ miss \] review/u);
  assert.match(said, /plugin\/src, plugin\/hooks, plugin\/bin are counted paths this repository does not hold/u);
  assert.match(said, /Declare this repository's own under `review\.paths` in \.forge\.json/u);
});

test("a repository with no mark is told it is unplanted and given the command that plants it", async () => {
  const said = await rowIn(built("unplanted", { review: { lines: 9, paths: ["app"] } }, { mark: false }),
    "unplanted");
  assert.match(said, /^\[ {2}ok {2}\] review/u);
  assert.match(said, /refs\/forge\/reviewed is unplanted, so nothing is counted yet/u);
  assert.match(said, /git update-ref refs\/forge\/reviewed <that commit>/u);
  assert.doesNotMatch(said, /0 changed line/u);
});

test("a declaration that counts prints the count since the mark, with the project's own file as its source", async () => {
  const room = built("short", { review: { lines: 9, paths: ["app"] } });
  wrote(room, join("app", "grew.txt"), 4);
  ran(room, "add", "-A");
  ran(room, "commit", "-q", "-m", "four lines");
  const said = await rowIn(room, "short");
  assert.match(said, /4 changed line\(s\) in 1 file\(s\) under app since/u);
  assert.match(said, /short of the 9 that earn a reading of what has landed {2}← \.forge\.json$/u);
});

test("a mistyped key is a miss on the row, and every other project row still prints", async () => {
  for (const [at, review] of [{ lines: null }, { lines: 9, paths: [] }].entries()) {
    const said = await ranAsync(FORGE, ["doctor", "project"], homeEnv(`review-row-wrong-${at}`),
      built(`wrong-${at}`, { review }));
    const rows = said.stdout.split("\n").filter((one) => one.startsWith("["));
    assert.ok(rows.some((one) => /^\[ miss \] review/u.test(one)), `no miss row: ${said.stdout}`);
    assert.ok(rows.some((one) => one.includes("flow ")), `the report stopped at the review row: ${said.stdout}`);
  }
});

test("the row says a reading is owed once the count reaches the volume in force", async () => {
  const room = built("owed", { review: { lines: 4, paths: ["app"] } });
  wrote(room, join("app", "grew.txt"), 4);
  ran(room, "add", "-A");
  ran(room, "commit", "-q", "-m", "four lines");
  const said = await rowIn(room, "owed");
  assert.match(said, /at or past the 4 that earn a reading of what has landed/u);
});

/* The door the project named, and what arms it: a table of this repository's own commands is not
   reachable from a route that refuses, so the row is the only thing that can tell an adopting
   project its door is guarding nothing (ISS-1905). */
const doorRoom = (name, project) => {
  const room = tempRoom(`owed-row-${name}-`);
  writeFileSync(join(room, ".forge.json"), JSON.stringify({ slug: name, ...project }));
  return room;
};

const doorRow = async (name, project) => {
  const { stdout } = await ranAsync(FORGE, ["doctor", "project"], homeEnv(`owed-row-${name}`),
    doorRoom(name, project));
  return stdout.split("\n").filter((one) => one.includes("] codex.owed ")).join("\n");
};

test("a door the project named and armed with no command is a miss naming the key that arms it", async () => {
  const said = await doorRow("unarmed", { codex: { owed: ["gate", "commit"] } });
  assert.match(said, /^\[ miss \] codex\.owed/u, said);
  assert.match(said, /gate is a door this project asks at that no command arms/u, said);
  assert.match(said, /`stats\.commands\.gate` names none/u, "the key that arms it");
  assert.match(said, /"stats": \{ "commands": \{ "gate": "<the command this project runs>" \} \}/u,
    "and the shape of the value");
  assert.match(said, /one command or a list of them/u, "including that it takes more than one");
  assert.match(said, /commit is armed/u, "while the door that needs no command is still named");
});

test("a value that is no command is quoted back rather than read as a declaration", async () => {
  const said = await doorRow("unusable", { codex: { owed: ["gate"] }, stats: { commands: { gate: [] } } });
  assert.match(said, /^\[ miss \] codex\.owed/u, said);
  assert.match(said, /`stats\.commands\.gate` is \[\], which is no command/u, said);
});

test("every named door armed reads ok and names the command in force at each", async () => {
  const said = await doorRow("armed", { codex: { owed: ["gate", "ship"] },
    stats: { commands: { gate: ["make verify", "make verify-fast"], ship: "./deploy.sh" } } });
  assert.match(said, /^\[ {2}ok {2}\] codex\.owed/u, said);
  assert.match(said, /gate at `make verify` or `make verify-fast`, ship at `\.\/deploy\.sh`/u, said);
  assert.match(said, /each command door at what `stats\.commands` names {2}← \.forge\.json$/u,
    "and the file every one of them was read from");
});

/* The debt is printed twice — here and by the release step that files its reading — so the row says
   which of the three states it is in rather than a number a reader cannot act on (ISS-1887). */
const DECLARED = { review: { lines: 4, paths: ["app"] } };
const OWN_SLUG = JSON.parse(readFileSync(join(import.meta.dirname, "..", "..", "..", "..", ".forge.json"), "utf8")).slug;

const owedRoom = (name) => {
  const room = built(name, DECLARED);
  /* The fixture serves this repository's own slug and no other, so a scoped read resolves only
     where the room asks for that project. */
  writeFileSync(join(room, ".forge.json"), JSON.stringify({ slug: OWN_SLUG, ...DECLARED }));
  wrote(room, join("app", "grew.txt"), 4);
  ran(room, "add", "-A");
  ran(room, "commit", "-q", "-m", "four lines");
  return { room, mark: git(room, "rev-parse", "refs/forge/reviewed").stdout.trim().slice(0, 7) };
};

const readingRow = async (name, state) => {
  const { room, mark } = owedRoom(name);
  const tracker = await fakeTracker(state(mark));
  const { stdout } = await ranAsync(FORGE, ["doctor", "project"], { ...tracker.env }, room);
  tracker.close();
  return stdout.split("\n").filter((one) => one.includes("] review ")).join("\n");
};

const reading = (mark, key) => ({ issueId: key, documentId: `u-${key}`, status: "in_progress",
  title: `The batch ${mark}..deadbee is read once as a whole by a run that wrote none of it` });

test("the row names the issue whose reading opens at the mark", async () => {
  const said = await readingRow("held", (mark) => ({ issues: [reading(mark, "ISS-88")] }));
  assert.match(said, /at or past the 4 that earn a reading of what has landed, and ISS-88 holds it at in_progress/u, said);
});

test("the row says no issue holds the debt where a whole reading of the backlog found none", async () => {
  const said = await readingRow("unheld", () => ({ issues: [] }));
  assert.match(said, /and no issue holds it — the next release files one/u, said);
});

/* A reading of another range is the previous batch, whose end the mark already is: named as this
   debt's holder it would leave the range standing with no row and nobody looking for one. */
test("a reading whose range ends at the mark holds nothing, the row saying none does", async () => {
  const said = await readingRow("ended-here", (mark) => ({ issues: [{ issueId: "ISS-77",
    documentId: "u-77", status: "open",
    title: `The batch 0000000..${mark} is read once as a whole by a run that wrote none of it` }] }));
  assert.match(said, /and no issue holds it — the next release files one/u, said);
  assert.doesNotMatch(said, /ISS-77/u, said);
});

/* A page that carried the row carried it, whatever became of the page after: the answer is already
   in hand and withholding it here would file a second row for a range that has one. */
const refusingAfter = (rows) => {
  let served = 0;
  return () => (served++
    ? { refused: "the page after the first would not come back" }
    : { issues: rows, returned: rows.length, hasMore: false, beyond: 3 });
};

test("a holder on a page before one that refused is still the answer, and no reading is claimed short", async () => {
  const said = await readingRow("held-then-refused", (mark) =>
    ({ answer: { forge_issues: refusingAfter([reading(mark, "ISS-99")]) } }));
  assert.match(said, /and ISS-99 holds it at in_progress/u, said);
  assert.doesNotMatch(said, /unread/u, said);
});

test("a page that refused after one holding no such row leaves who holds the debt unread", async () => {
  const said = await readingRow("none-then-refused", () =>
    ({ answer: { forge_issues: refusingAfter([]) } }));
  assert.match(said, /and which issue holds it is unread: .*the page after the first would not come back/u, said);
  assert.doesNotMatch(said, /no issue holds it/u, said);
});

test("a backlog that came back short leaves who holds the debt unread, and claims no absence", async () => {
  const said = await readingRow("short", () => ({ answer: { forge_issues: shortPage([], 3) } }));
  assert.match(said, /and which issue holds it is unread: /u, said);
  assert.doesNotMatch(said, /no issue holds it/u,
    `a reading that could not finish was read as one that found nothing:\n${said}`);
});
