/* The published store as a run home sees it. A delegated run points its home under its own scratch
   and borrows this machine's config by reference; the release that published its head stood in the
   machine's home, so a store read under the run's home was empty and the rehearsal told the one run
   that most needed the citation that nothing had ever been published (ISS-2653). */
import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { tempHome } from "../../fixtures.mjs";

const machine = tempHome("published-machine").path;
const run = tempHome("published-run").path;
const MACHINE_CONFIG = join(machine, "forge", "config.json");
const MACHINE_STORE = join(machine, "forge", "gate-baselines.jsonl");
const RUN_STORE = join(run, "forge", "gate-baselines.jsonl");
mkdirSync(join(machine, "forge"), { recursive: true });
writeFileSync(MACHINE_CONFIG, "{}\n");
process.env.XDG_CONFIG_HOME = run;
process.env.FORGE_BORROW_FROM = MACHINE_CONFIG;

const { baselineAhead } = await import("../../../src/flow/route.mjs");
const { BORROWED, HELD, WROTE, citationProblem, publishBaseline, publishedPath, publishedSaid } =
  await import("../../../src/flow/earned/published.mjs");
const { slugIfAny } = await import("../../../src/resolve/settings.mjs");

const below = { issue: { status: "approved" } };
const HEAD = "6b51b0acc708fcf9a26975a1aef79e138445454a";
const OTHER = "3aabd8943aabd8943aabd8943aabd8943aabd894";
const RESULT = "nothing fails: all 14 gate step(s) green at this commit";
const entry = (commit) => ({ project: slugIfAny(), commit, gate: "npm run check", result: RESULT,
  scope: "whole", version: "3.36.424", at: "2026-09-27T00:25:22.855Z" });
writeFileSync(MACHINE_STORE, `${JSON.stringify(entry(HEAD))}\n`);
const machineHeld = readFileSync(MACHINE_STORE, "utf8");
const publish = (commit) => publishBaseline({ project: slugIfAny(), commit, gate: "npm run check",
  result: RESULT, scope: "whole" });

test("a borrowing home is offered the citation the machine's store holds for its head", () => {
  assert.equal(publishedPath(), MACHINE_STORE, "the store read is the one beside the borrowed config");
  const said = baselineAhead(below, "ISS-3", HEAD);
  assert.match(said, /a ship published a whole-tree result for the commit this checkout stands at/u, said);
  assert.match(said, new RegExp(`--commit ${HEAD} --scope whole --cited "the ship's gate at release 3\\.36\\.424"`, "u"), said);
  const got = { gate: "npm run check", result: RESULT, commit: HEAD, scope: "whole", cited: "the ship's gate" };
  assert.doesNotMatch(citationProblem("ISS-3", slugIfAny(), got) ?? "", /Nothing is published for/u,
    "the citing write takes the machine's publication as published");
});

test("a head the machine's store does not hold is said, naming the store that was read", () => {
  const said = baselineAhead(below, "ISS-3", OTHER);
  assert.match(said, /no ship has published a whole-tree result/u, said);
  assert.ok(said.includes(`(read from ${MACHINE_STORE})`), `the store read is not named:\n${said}`);
  const got = { gate: "npm run check", result: RESULT, commit: OTHER, scope: "whole", cited: "the ship's gate" };
  assert.ok(citationProblem("ISS-3", slugIfAny(), got).includes(`Nothing is published for ${OTHER} in ${MACHINE_STORE}`));
});

test("a borrowing home publishes nothing into either store, and names the shell that does", () => {
  assert.equal(publish(OTHER), BORROWED);
  assert.equal(readFileSync(MACHINE_STORE, "utf8"), machineHeld, "the machine's store was written");
  assert.equal(existsSync(RUN_STORE), false, "a publication nobody reads back went into the run's home");
  const said = publishedSaid(BORROWED, OTHER);
  assert.ok(said.includes(`FORGE_BORROW_FROM= XDG_CONFIG_HOME=${machine} and the same command`), said);
  assert.equal(publish(HEAD), HELD, "a head the machine's store holds is held rather than refused");
  assert.ok(publishedSaid(HELD, HEAD).includes(`already holds a published result in ${MACHINE_STORE}`));
  assert.equal(readFileSync(MACHINE_STORE, "utf8"), machineHeld);
});

test("a home that borrows nothing reads and writes its own store alone", () => {
  delete process.env.FORGE_BORROW_FROM;
  try {
    assert.equal(publishedPath(), RUN_STORE);
    assert.match(baselineAhead(below, "ISS-3", HEAD), /no ship has published/u,
      "the machine's store answers only through a borrow");
    assert.equal(publish(OTHER), WROTE);
    assert.equal(JSON.parse(readFileSync(RUN_STORE, "utf8")).commit, OTHER, "the publish was not appended to its own store");
    assert.equal(readFileSync(MACHINE_STORE, "utf8"), machineHeld, "the machine's store was written");
  } finally {
    process.env.FORGE_BORROW_FROM = MACHINE_CONFIG;
  }
});
