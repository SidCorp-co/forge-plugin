/* ISS-629: an open row whose code already landed was the top pick with nothing on it. The mark is
   caller-asserted, so it is shown on the row as a fact and moves neither the place nor the score. */
import assert from "node:assert/strict";
import test from "node:test";

import { issue, rankRoom } from "./room.mjs";

const { load, ran, close } = await rankRoom();
test.after(close);

const MERGED = "2026-09-06T19:09:19.786Z";

test("a merge mark is printed on the candidate and moves neither its place nor its score", async () => {
  const backlog = (mergedAt) => [
    issue("ISS-1", { priority: "critical", status: "reopen", reopenCount: 2, mergedAt }),
    issue("ISS-2", { priority: "low" }),
  ];
  load(backlog(null));
  const plain = JSON.parse((await ran(["next", "--json"])).stdout).candidates;
  load(backlog(MERGED));
  const marked = JSON.parse((await ran(["next", "--json"])).stdout).candidates;
  assert.deepEqual(marked.map((one) => [one.issueId, one.score]), plain.map((one) => [one.issueId, one.score]),
    "the mark keeps the order and every score as they were without it");
  assert.equal(marked[0].mergedAt, MERGED, "the json carries the stamp as the tracker holds it");
  assert.equal(marked[1].mergedAt, null, "and null where none is set");
  const run = await ran(["next"]);
  assert.equal(run.status, 0, run.stderr);
  const [head, line] = run.stdout.split("\n").filter((one) => /^ISS-1\b/u.test(one) || /^ {2}merged /u.test(one));
  assert.match(head, /^ISS-1\b.* merged /u, "the signals column says merged");
  assert.match(line, /^ {2}merged merge mark set 2026-09-06T19:09Z, \d+ day\(s\) ago, while the status reads reopen and the issue has been reopened 2 time\(s\)$/u);
  assert.doesNotMatch(run.stdout.split("\n").filter((one) => /^ISS-2\b/u.test(one)).join("\n"), /merged/u,
    "an unmarked candidate carries no merge signal");
  assert.equal((run.stdout.match(/^ {2}merged /gmu) ?? []).length, 1, "and no merge line of its own");
});

test("a batch member with a merge mark says so on its own line and in the json", async () => {
  load(
    ["ISS-1", "ISS-2", "ISS-3"].map((key) => issue(key, { complexity: "s", priority: "high",
      mergedAt: key === "ISS-2" ? MERGED : null })),
    { semantic: [["ISS-2", 0.91], ["ISS-3", 0.9]] },
  );
  const run = await ran(["next", "--count", "1"]);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /^ {2}\+ ISS-2 .* · merge mark set 2026-09-06T19:09Z, \d+ day\(s\) ago$/mu);
  assert.doesNotMatch(run.stdout, /^ {2}\+ ISS-3 .*merge mark/mu, "an unmarked member says nothing of one");
  const [head] = JSON.parse((await ran(["next", "--count", "1", "--json"])).stdout).candidates;
  assert.deepEqual(head.batch.map((one) => [one.issueId, one.mergedAt]), [["ISS-2", MERGED], ["ISS-3", null]]);
});
