/* `forge next` end to end over a checkout carrying a review mark: the batch reading the ship files
   scores last on every field it is filed with, so what lifts it is the range it owes (ISS-2719). */
import assert from "node:assert/strict";
import test from "node:test";

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { issue, rankRoom, reviewing, standing } from "./room.mjs";
import { git } from "../fixtures.mjs";

const { load, ran, close } = await rankRoom();
test.after(close);

/* A checkout whose range past the review mark holds `changed` lines under `src`, against a declared
   volume of ten: the mark is the first commit, so the batch it opens is named by that commit. */
const markedRoom = (changed, review = { lines: 10, paths: ["src"] }) => {
  const room = review ? reviewing(review) : standing(null);
  const wrote = (lines) => {
    mkdirSync(join(room, "src"), { recursive: true });
    writeFileSync(join(room, "src", "grown.txt"), `${Array.from({ length: lines }, (one, at) => at).join("\n")}\n`);
  };
  wrote(1);
  for (const args of [["init", "-q", "-b", "master"], ["add", "-A"], ["commit", "-q", "-m", "one"],
    ["update-ref", "refs/forge/reviewed", "HEAD"]]) git(room, ...args);
  const mark = git(room, "rev-parse", "--short=7", "HEAD").stdout.trim();
  wrote(1 + changed);
  git(room, "commit", "-q", "-am", "grown");
  return { room, mark };
};

const lowBacklog = (mark) => [
  ...["ISS-1", "ISS-2", "ISS-3"].map((key) => issue(key, { priority: "low", category: "bug", complexity: "xs" })),
  issue("ISS-9", { priority: null, category: "review", complexity: "xl",
    title: `The batch ${mark}..abcdef0 is read once as a whole by a run that wrote none of it, and the mark moves` }),
];

test("an owed batch reading heads the order over a low backlog, and --why names what it owes", async () => {
  const { room, mark } = markedRoom(30);
  load(lowBacklog(mark));
  const run = await ran(["next", "--why"], room);
  assert.equal(run.status, 0, run.stderr);
  const [first] = run.stdout.split("\n").filter((line) => /^ISS-\d+/u.test(line));
  assert.match(first, /^ISS-9\b/u, `the reading heads the top section:\n${run.stdout}`);
  assert.match(run.stdout, new RegExp(`reading ${mark}\\.\\.HEAD 3x 10 180`, "u"),
    `--why names the range, its multiple, the threshold and the points:\n${run.stdout}`);
  const json = JSON.parse((await ran(["next", "--json"], room)).stdout);
  assert.equal(json.candidates.find((one) => one.issueId === "ISS-9").parts.reading.points, 180);
});

test("a range short of the volume, or a project declaring none, ranks the reading by its fields alone", async () => {
  for (const [changed, review] of [[5, { lines: 10, paths: ["src"] }], [30, null]]) {
    const { room, mark } = markedRoom(changed, review);
    load(lowBacklog(mark));
    const json = JSON.parse((await ran(["next", "--json", "--count", "9"], room)).stdout);
    const reading = json.candidates.find((one) => one.issueId === "ISS-9");
    assert.equal(reading.parts.reading, undefined, JSON.stringify({ changed, review, parts: reading.parts }));
    assert.notEqual(json.candidates[0].issueId, "ISS-9");
  }
});

