/* A thread holding no typed record is two conditions — nothing was written, and nothing was done —
   and the row tells them apart: a merged mark or a branch on it is work no record describes. A
   brief that printed nothing for both read a change serving in production as untouched (ISS-607). */
import assert from "node:assert/strict";
import test from "node:test";

import { standsInNoTree, tempHome } from "../../fixtures.mjs";

const HOME = tempHome("resume-row");
process.env.XDG_CONFIG_HOME = HOME.path;
standsInNoTree("resume-row");
const { render } = await import("../../../src/flow/record/page.mjs");
const { viewFrom } = await import("../../../src/flow/earned.mjs");
const { briefOf } = await import("../../../src/flow/brief.mjs");
const { records } = await import("../../../src/flow/resume.mjs");

const RELEASES_ITSELF = { staging: "master", model: "publish", said: "publish", live: null,
  strategy: null, autoProd: true };
const SHA = "abc1234def5678abc1234def5678abc1234def56";
const WORKLOG = { branch: "iss-920-from-the-worklog", head: SHA, at: "2026-09-03T02:10:00.000Z" };
const LANDING = { state: "ready", branch: "iss-920-from-the-checkpoint", head: SHA };

const briefFor = (extra = {}, comments = []) => briefOf(viewFrom("the-uuid", {
  status: "in_progress", plan: null, acceptanceCriteria: null, relations: { blockedBy: [] }, ...extra,
}, comments, null, RELEASES_ITSELF), "ISS-920");

const context = (fields) => ({ sessionContext: fields });

test("an empty thread over a merged mark names the mark, its minute and its commit", () => {
  const one = briefFor({ mergedAt: "2026-09-06T11:17:03.403Z", mergedCommitSha: SHA });
  assert.deepEqual(one.row, { merged: { at: "2026-09-06T11:17:03.403Z", commit: SHA }, branch: null });
  assert.deepEqual(records(one), [
    "none typed, and the row carries a merged mark at 2026-09-06T11:17 on abc1234: work was done that no record describes",
  ]);
  const bare = briefFor({ mergedAt: "2026-09-06T11:17:03.403Z" });
  assert.deepEqual(bare.row, { merged: { at: "2026-09-06T11:17:03.403Z", commit: null }, branch: null },
    "a mark stamped with no commit keeps the key, null, so a tool reads one shape");
  assert.deepEqual(records(bare), [
    "none typed, and the row carries a merged mark at 2026-09-06T11:17: work was done that no record describes",
  ]);
});

test("an empty thread over a branch names it and the field it was read off, the worklog first", () => {
  const sources = [
    [{ worklog: WORKLOG }, { name: WORKLOG.branch, from: "the worklog" }],
    [{ landing: LANDING }, { name: LANDING.branch, from: "the landing checkpoint" }],
    [{ branch: "iss-920-from-core" }, { name: "iss-920-from-core", from: "sessionContext.branch" }],
    [{ worklog: WORKLOG, landing: LANDING, branch: "iss-920-from-core" }, { name: WORKLOG.branch, from: "the worklog" }],
    [{ landing: LANDING, branch: "iss-920-from-core" }, { name: LANDING.branch, from: "the landing checkpoint" }],
  ];
  for (const [fields, branch] of sources) {
    const one = briefFor(context(fields));
    assert.deepEqual(one.row, { merged: null, branch }, JSON.stringify(fields));
    assert.deepEqual(records(one), [
      `none typed, and the row carries the branch \`${branch.name}\`, from ${branch.from}: work was done that no record describes`,
    ], JSON.stringify(fields));
  }
  const both = briefFor({ mergedAt: "2026-09-06T11:17:03.403Z", ...context({ branch: "iss-920-from-core" }) });
  assert.deepEqual(records(both), [
    "none typed, and the row carries a merged mark at 2026-09-06T11:17 and the branch `iss-920-from-core`, "
    + "from sessionContext.branch: work was done that no record describes",
  ]);
});

test("an empty thread over a row carrying neither says so, rather than printing nothing", () => {
  const one = briefFor(context({ branch: "   " }));
  assert.deepEqual(one.row, { merged: null, branch: null });
  assert.deepEqual(records(one), ["none typed, and the row carries neither a merged mark nor a branch"]);
});

test("--json carries the row as the object the screen reads, and a typed thread keeps its lines", () => {
  const typed = [{ createdAt: "2026-09-03T02:01:00.000Z", authorId: "agent",
    body: render("confirmation", { where: "src/one.mjs", is: "the claim holds", finding: "holds" }) }];
  const one = briefFor({ mergedAt: "2026-09-06T11:17:03.403Z", ...context({ worklog: WORKLOG }) }, typed);
  assert.deepEqual(JSON.parse(JSON.stringify(one)).row,
    { merged: { at: "2026-09-06T11:17:03.403Z", commit: null }, branch: { name: WORKLOG.branch, from: "the worklog" } });
  assert.deepEqual(records(one), ["confirmation  the claim holds  (2026-09-03T02:01)"],
    "a thread holding a typed record prints its headlines and no row line");
});
