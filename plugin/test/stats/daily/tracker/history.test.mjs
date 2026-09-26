/* The reads the closes reader and the owner-wait reader share, against a tracker rather than a mock
   of one: the case is how many requests reached it when both walk the same day. The fixture serves
   no activity route, so each walk ends on its first page, which is all the count needs. */
import assert from "node:assert/strict";
import test, { after } from "node:test";

import { fakeTracker, projectRecord } from "../../../fixtures.mjs";
import { OWN } from "../../../fixtures/own-project.mjs";
import { TRACKER, walkBack } from "../../../../src/stats/daily/tracker/history.mjs";
import { useProject } from "../../../../src/resolve/settings.mjs";

const state = {};
const tracker = await fakeTracker(state);
after(() => tracker.close());

/* The readers resolve the endpoint at call time, so the fixture's home is in reach before any call. */
process.env.XDG_CONFIG_HOME = tracker.env.XDG_CONFIG_HOME;
projectRecord(process.cwd(), tracker.env.XDG_CONFIG_HOME, { slug: OWN.slug });

const activityAsked = () => (state.calls ?? []).filter((one) => /\/activity/u.test(one.path ?? "")).length;

test("17. a page of a project's activity two readers walk is asked of the tracker once", async () => {
  useProject({ slug: OWN.slug, from: "the case" });
  const from = Date.parse("2026-09-20T00:00:00Z");
  const to = Date.parse("2026-09-21T00:00:00Z");
  const first = await walkBack(TRACKER.activity, from, to, TRACKER.limit);
  const asked = activityAsked();
  assert.equal(asked, 1, JSON.stringify(state.calls));
  const second = await walkBack(TRACKER.activity, from, to, TRACKER.limit);
  assert.deepEqual(second, first);
  assert.equal(activityAsked(), asked, "the second walk asked the same cursors and reached no route");
  await walkBack(TRACKER.activity, from, to + 1, TRACKER.limit);
  assert.equal(activityAsked(), asked + 1, "another cursor is another request");
});
