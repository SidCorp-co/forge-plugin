/* What the API billed for a run, over the population each figure names. Every other row the verb
   prints is `runs.test.mjs`. */
import assert from "node:assert/strict";
import test from "node:test";

import { callsIn } from "../../src/stats/corpus/transcripts.mjs";
import { profileOf, runFrom } from "../../src/stats/runs.mjs";
import { MARKER_TURN, MODELLESS, NOUGHTS, NO_USAGE, OTHER, RESPONSE, SHORT_RESPONSE, SHORT_USAGE,
  ask, corpus, transcript } from "./fixture-runs.mjs";

test("usage is counted once per response, and a record carrying none is counted as one carrying none", () => {
  assert.deepEqual(callsIn(transcript()).spent,
    { input: 10, cacheCreate: 100, cacheRead: 1200, output: 50, requests: 2, unmeasured: 18 },
    "two requests billed, and the sixteen call records and two deliberate ones that carry no usage counted apart");
  const spentIn = (...lines) => callsIn(lines.join("\n")).spent;
  const one = spentIn(...RESPONSE);
  assert.deepEqual([one.requests, one.cacheRead], [1, 1200],
    "one response written as three records is one request billed once, not three");
  const marked = spentIn(MARKER_TURN);
  assert.deepEqual([marked.requests, marked.unmeasured, marked.cacheRead], [0, 0, 0],
    "a turn no model generated is no request, and no record of one either");
  assert.deepEqual([spentIn(NOUGHTS).requests, spentIn(NOUGHTS).cacheRead], [1, 0],
    "four noughts is a measurement and not the absence of one");
  const short = spentIn(NO_USAGE, SHORT_USAGE);
  assert.deepEqual([short.requests, short.unmeasured], [0, 2],
    "no usage object, and one missing a price, are each a record carrying no measurement");
});

test("a run carrying no measurement is in no token median and in no token denominator", () => {
  const measured = runFrom("/p", "one", transcript());
  const none = runFrom("/p", "two", OTHER);
  assert.deepEqual([none.tokens.requests, none.tokens.unmeasured], [0, 1],
    "the second run's one assistant record carries no usage, so it holds no measured request");
  const held = profileOf([measured, none]).tokens;
  assert.deepEqual([held.runs, held.unmeasuredRuns, held.requests, held.unmeasured], [1, 1, 2, 19],
    "one run holds the measurements, the other is counted apart, and every record that carried none is named");
  assert.deepEqual(held.perRun, { input: 10, cacheCreate: 100, cacheRead: 1200, output: 50 },
    "the median is over the run that was billed, so the unbilled one does not halve it");
  assert.deepEqual(held.perRequest, { input: 5, cacheCreate: 50, cacheRead: 600, output: 25 },
    "and the divisor is that run's own requests, the numerator and the denominator being one population");
});

test("the token lines print the three readings, each over the population it names", () => {
  const run = ask(corpus());
  assert.equal(run.status, 0, run.stderr);
  const has = (line) => assert.ok(run.stdout.includes(line), `${line}\n--- printed ---\n${run.stdout}`);
  has("tokens          median/run 1.2k cache read, 100 cache written, 50 out, 10 in, "
    + "over 1 run(s) holding a measured request and 0 holding none");
  has("in all          1.2k cache read, 100 cache written, 50 out, 10 in, "
    + "over 2 measured request(s), and 18 record(s) carried no measurement");
  has("per request     600 cache read, 50 cache written, 25 out, 5 in");
});

test("what the API billed is read off the usage alone, whichever record of a response carries it", () => {
  const spentIn = (...lines) => callsIn(lines.join("\n")).spent;
  const first = spentIn(SHORT_RESPONSE, RESPONSE[0]);
  const second = spentIn(RESPONSE[0], SHORT_RESPONSE);
  assert.deepEqual([first.requests, first.cacheRead, first.unmeasured], [1, 1200, 1],
    "a record missing a price does not reserve the id of the response it belongs to");
  assert.deepEqual(first, second, "so the two read the same in either order");
  const modelless = spentIn(MODELLESS);
  assert.deepEqual([modelless.requests, modelless.cacheRead], [1, 3],
    "a record the host named no model on was billed, and the attribution's guard is not the usage's");
  assert.equal(spentIn(MARKER_TURN).requests, 0, "while a turn no model generated is still no request");
});
