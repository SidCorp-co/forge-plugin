/* A landing whose gate declined for want of a place: that gate ran no step, so it judged no branch,
   and the landing hands nothing back, splits no set and says the wait the decline named (ISS-2346).
   The gate is handed the landing's keys and its `--wait` minutes, which the real gate waits out
   before it declines, and a landing stopped for that alone exits 75 (ISS-2461). */
import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  BASE, KEY, NEXT_BRANCH, NEXT_KEY, NEXT_OWNED, NEXT_UUID, context, ctx, ready, seeded, sha, tracker,
  world,
} from "../fixture.mjs";
import { tempRoom } from "../../../fixtures.mjs";

const { landReady } = await import("../../../../../tools/run/land-ready.mjs");
const { Stop } = await import("../../../../../tools/checkout.mjs");
const { DECLINED } = await import("../../../../../tools/gates/machine.mjs");
const { landingOf } = await import("../../../../src/flow/landing/checkpoint.mjs");

test.after(() => tracker.close());

/* The gate's own decline, stood in for while the switch is there and green once it is gone, and a
   line per run so a case can count the candidates built. */
const ROOM = tempRoom("land-declined-");
const RUNS = join(ROOM, "runs.txt");
const FULL = join(ROOM, "no-place");
const GATE = `node -e "const fs = require('fs'); `
  + `fs.appendFileSync('${RUNS}', 'ran ' + process.env.FORGE_LANDING + '|' + process.env.FORGE_LANDING_WAIT + '\\n'); `
  + `process.exit(fs.existsSync('${FULL}') ? ${DECLINED} : 0)"`;
const placeless = () => writeFileSync(FULL, "both places held\n");
const placed = () => rmSync(FULL, { force: true });
const lines = () => (existsSync(RUNS) ? readFileSync(RUNS, "utf8") : "").split("\n").filter(Boolean);
const runs = () => lines().length;
const handed = () => lines().at(-1).slice("ran ".length);

let code = null;

const ran = async (keys, work, flags = new Map()) => {
  const out = [];
  const kept = [console.log, console.error];
  console.log = (...said) => out.push(said.join(" "));
  console.error = (...said) => out.push(said.join(" "));
  try {
    await landReady({ flags, words: keys }, ctx(work));
  } catch (error) {
    if (!(error instanceof Stop)) throw error;
    out.push(error.message);
  } finally {
    [console.log, console.error] = kept;
    code = process.exitCode;
    process.exitCode = 0;
  }
  return out.join("\n");
};

const landing = (documentId) => landingOf(context(documentId));
const remote = (at) => sha(join(at, "origin.git"), `refs/heads/${BASE}`);

test("a gate declined for a place leaves a lone branch's checkpoint where it was and names the wait", async () => {
  const { at, work, head, base } = world({ base: "other", gate: GATE });
  seeded({ landing: ready(head, base) });
  placeless();
  const before = runs();
  const said = await ran([KEY], work);
  assert.equal(runs() - before, 1, `the gate was reached:\n${said}`);
  assert.equal(landing().state, "reconciled", `still the landing's own turn, nothing handed back:\n${said}`);
  assert.equal(landing().head, head, `at the head it was captured at:\n${said}`);
  assert.doesNotMatch(said, /head-owed/u, `no turn of the builder's is named:\n${said}`);
  assert.equal(handed(), `${KEY}|30`, `the gate was handed the landing's keys and the default minutes:\n${said}`);
  assert.ok(said.includes("waited 30 minute(s) for a gate place"), `the wait it was given:\n${said}`);
  assert.ok(said.includes(`node tools/run.mjs land-ready ${KEY} --wait 60`), `and the landing after it, longer:\n${said}`);
  assert.match(said, /no branch of .* was judged and nothing was handed back/u, said);
  assert.equal(code, DECLINED, `a landing stopped for a place alone exits ${DECLINED}:\n${said}`);
  assert.equal(remote(at), base, `nothing was pushed:\n${said}`);
  placed();
  const again = await ran([KEY], work);
  assert.notEqual(remote(at), base, `the same checkpoint lands once a place is free:\n${again}`);
});

test("a gate declined for a place splits no set: no member is voided, handed back or gated alone", async () => {
  const { at, work, head, next, base } = world({ base: "other", second: true, gate: GATE });
  seeded({ landing: ready(head, base), next: ready(next, base, { branch: NEXT_BRANCH, files: [NEXT_OWNED] }) });
  placeless();
  const before = runs();
  const said = await ran([KEY, NEXT_KEY], work);
  assert.equal(runs() - before, 1, `one candidate was gated and no member was built alone:\n${said}`);
  assert.doesNotMatch(said, /green apart and red together/u, `no split is read into it:\n${said}`);
  for (const [documentId, was] of [[undefined, head], [NEXT_UUID, next]]) {
    assert.equal(landing(documentId).state, "reconciled", `every member is still the landing's turn:\n${said}`);
    assert.equal(landing(documentId).head, was, `at its own head:\n${said}`);
  }
  assert.equal(landing(NEXT_UUID).reconciled, landing().reconciled,
    `both still hold the reading taken at the one candidate, voided by nobody:\n${said}`);
  assert.equal(handed(), `${KEY} ${NEXT_KEY}|30`, `one gate, handed every key of the candidate:\n${said}`);
  assert.ok(said.includes(`node tools/run.mjs land-ready ${KEY} ${NEXT_KEY} --wait 60`), `and the landing after it:\n${said}`);
  assert.equal(code, DECLINED, said);
  assert.equal(remote(at), base, `nothing was pushed:\n${said}`);
  placed();
});

test("a landing's --wait is the minutes its gate is handed to wait for a place, and the ones its stop names", async () => {
  const { at, work, head, base } = world({ base: "other", gate: GATE });
  seeded({ landing: ready(head, base) });
  placeless();
  const said = await ran([KEY], work, new Map([["--wait", "0.5"]]));
  assert.equal(handed(), `${KEY}|0.5`, said);
  assert.ok(said.includes("waited 0.5 minute(s) for a gate place"), said);
  assert.ok(said.includes(`node tools/run.mjs land-ready ${KEY} --wait 1`), said);
  assert.equal(remote(at), base, `nothing was pushed:\n${said}`);
  placed();
});

/* The code alone, off the verb both landings share: a run that met a place decline and a refusal is
   not one a caller may retry as a decline. */
test("a stop carrying the decline's code exits with it, and a run that met another stop too exits 1", async () => {
  const { runLanding } = await import("../../../../../tools/run/land.mjs");
  const stops = (...codes) => codes.map((exitCode, at) => [`step ${at}`, () => {
    const error = new Stop(`stopped ${at}`);
    if (exitCode !== null) error.exitCode = exitCode;
    throw error;
  }]);
  const kept = console.error;
  console.error = () => {};
  const codeOf = async (...codes) => {
    process.exitCode = 0;
    for (const [at] of codes.entries()) {
      await runLanding(stops(...codes), [at], ROOM, { ms: 1, held: () => false, again: () => "" });
    }
    return process.exitCode;
  };
  try {
    assert.equal(await codeOf(DECLINED), DECLINED, "a decline alone");
    assert.equal(await codeOf(DECLINED, DECLINED), DECLINED, "two declines");
    assert.equal(await codeOf(null), 1, "a stop that carries no code");
    assert.equal(await codeOf(DECLINED, null), 1, "a decline and then a refusal");
    assert.equal(await codeOf(null, DECLINED), 1, "a refusal and then a decline");
  } finally {
    console.error = kept;
    process.exitCode = 0;
  }
});
