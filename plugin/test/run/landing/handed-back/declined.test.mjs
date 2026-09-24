/* A landing whose gate declined for want of a place: that gate ran no step, so it judged no branch,
   and the landing hands nothing back, splits no set and says the wait the decline named (ISS-2346). */
import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  BASE, KEY, NEXT_BRANCH, NEXT_KEY, NEXT_OWNED, NEXT_UUID, context, ctx, ready, seeded, sha, tracker,
  world,
} from "./fixture.mjs";
import { tempRoom } from "../../fixtures.mjs";

const { landReady } = await import("../../../../tools/run/land-ready.mjs");
const { Stop } = await import("../../../../tools/checkout.mjs");
const { DECLINED } = await import("../../../../tools/gates/machine.mjs");
const { landingOf } = await import("../../../src/flow/landing/checkpoint.mjs");

test.after(() => tracker.close());

/* The gate's own decline, stood in for while the switch is there and green once it is gone, and a
   line per run so a case can count the candidates built. */
const ROOM = tempRoom("land-declined-");
const RUNS = join(ROOM, "runs.txt");
const FULL = join(ROOM, "no-place");
const GATE = `node -e "const fs = require('fs'); fs.appendFileSync('${RUNS}', 'ran\\n'); `
  + `process.exit(fs.existsSync('${FULL}') ? ${DECLINED} : 0)"`;
const placeless = () => writeFileSync(FULL, "both places held\n");
const placed = () => rmSync(FULL, { force: true });
const runs = () => (existsSync(RUNS) ? readFileSync(RUNS, "utf8") : "").split("\n").filter(Boolean).length;

const ran = async (keys, work) => {
  const out = [];
  const kept = [console.log, console.error];
  console.log = (...said) => out.push(said.join(" "));
  console.error = (...said) => out.push(said.join(" "));
  try {
    await landReady({ flags: new Map(), words: keys }, ctx(work));
  } catch (error) {
    if (!(error instanceof Stop)) throw error;
    out.push(error.message);
  } finally {
    [console.log, console.error] = kept;
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
  assert.ok(said.includes("node tools/gates.mjs --wait slot"), `the wait the decline named:\n${said}`);
  assert.ok(said.includes(`node tools/run.mjs land-ready ${KEY}`), `and the landing after it:\n${said}`);
  assert.match(said, /no branch of .* was judged and nothing was handed back/u, said);
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
  assert.ok(said.includes("node tools/gates.mjs --wait slot"), `the wait the decline named:\n${said}`);
  assert.ok(said.includes(`node tools/run.mjs land-ready ${KEY} ${NEXT_KEY}`), `and the landing after it:\n${said}`);
  assert.equal(remote(at), base, `nothing was pushed:\n${said}`);
  placed();
});
