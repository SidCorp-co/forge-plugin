/* The review-answers step judged from a home other than the one the shipped tree's run logged under.
   A delegated run is briefed with a home inside its scratch and every consult it takes lands there,
   while the ship runs in the landing's own process and home, so a review that run earned read as
   no read at all (ISS-2653). The tree's git directory records the scratch, which is what says where. */
import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { BARE, git, runIn } from "../run-fixtures.mjs";
import { ELSEWHERE, UNDER_REVIEW, baseMoved, readTaken } from "./read-fixtures.mjs";
import { tempRoom } from "../../../../plugin/test/fixtures.mjs";

const ID = "iss-962-0a1b2c3d";

/* A tree started for a run: its id and its scratch beside the git directory, and the log the read
   fixture built moved under the home that scratch holds. What is left for the ship is a home of its
   own holding no log at all. */
const handedAHome = (work, head) => {
  const log = readTaken(work, head, [UNDER_REVIEW]).XDG_CONFIG_HOME;
  const scratch = join(tempRoom("run-home-scratch-"), `forge-run-${ID}`);
  mkdirSync(join(scratch, "home"), { recursive: true });
  renameSync(join(log, "forge"), join(scratch, "home", "forge"));
  const gitDir = git(work, "rev-parse", "--absolute-git-dir").stdout.trim();
  writeFileSync(join(gitDir, "forge-run-id"), `${ID}\n`);
  writeFileSync(join(gitDir, "forge-run-scratch"), `${scratch}\n`);
  return { ...BARE, XDG_CONFIG_HOME: tempRoom("run-home-landing-") };
};

test("a read the shipped tree's run logged under its own home is the read the ship judges", () => {
  const { work, mine } = baseMoved("run-home-read", ELSEWHERE);
  const run = runIn(work, ["ship"], handedAHome(work, mine));
  assert.ok(run.stdout.includes(`the read that earned the review was taken at ${mine.slice(0, 7)}`),
    `a read under the run's home went unfound from the landing's:\n${run.stdout}${run.stderr}`);
  assert.doesNotMatch(run.stdout, /no consult in this log read the whole/u,
    `the step reported an absence the run's home does not hold:\n${run.stdout}`);
});

test("a tree recording no scratch is judged off the ship's own home, and the absence names that log", () => {
  const { work, mine } = baseMoved("run-home-none", ELSEWHERE);
  const own = readTaken(work, mine, [UNDER_REVIEW]);
  const found = runIn(work, ["ship"], own);
  assert.ok(found.stdout.includes(`the read that earned the review was taken at ${mine.slice(0, 7)}`),
    `a read in the ship's own home went unfound:\n${found.stdout}${found.stderr}`);

  const bare = baseMoved("run-home-absent", ELSEWHERE);
  const empty = tempRoom("run-home-empty-");
  const absent = runIn(bare.work, ["ship"], { ...BARE, XDG_CONFIG_HOME: empty });
  assert.match(absent.stdout, /no consult in this log read the whole of this change's 1 file\(s\)/u,
    `${absent.stdout}${absent.stderr}`);
  assert.ok(absent.stdout.includes(`(read from ${join(empty, "forge", "codex-log.jsonl")})`),
    `the absence does not name the log it read:\n${absent.stdout}`);
});
