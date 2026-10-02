import assert from "node:assert/strict";
import test from "node:test";

import { BY_PERSON, projectRows, releaseFrom, releaseOwedOf, waitsForPerson }
  from "../../src/tracker/project-config.mjs";

/* No landing key of the project's, so the route is the policy's own. */
const NONE = { value: null, from: null };

/* Every row reporting a policy this CLI cannot read says what waits in the words the two derivations
   the flow spends on it answer: a row naming only the look's park while the close was refused too is
   how two runs under one contract read opposite rungs off it (ISS-1827). */
test("each row reporting an unread policy names the close beside the look's park, in one clause", () => {
  const WAITS = "a user-facing change parks for a person's look before awaiting_release, and every "
    + "change's close is a person's";
  const of = (config) => releaseFrom({ baseBranch: "master", ...config });
  const rowOf = (policy, label, level) => projectRows({ policy, deploy: null, landing: NONE })
    .find((row) => row.label === label && (!level || row.level === level));
  const shapes = [
    ["no model", of({ pipelineConfig: { autoProdDeploy: false } }), "release model"],
    ["an unknown model", of({ releaseModel: "hand-carried", pipelineConfig: { autoProdDeploy: false } }),
      "release model"],
    ["a promotion with no live branch", of({ releaseModel: "promote", pipelineConfig: { autoProdDeploy: false } }),
      "live branch"],
    ["no project", null, "release policy"],
    ["an automatic deploy under no model", of({ pipelineConfig: { autoProdDeploy: true } }), "release policy",
      "miss"],
  ];
  for (const [shape, policy, label, level] of shapes) {
    assert.equal(waitsForPerson(policy), true, `the look's park waits for a person under ${shape}`);
    assert.equal(releaseOwedOf(policy)?.by, BY_PERSON, `and the close is a person's under ${shape}`);
    const row = rowOf(policy, label, level);
    assert.ok(row?.detail.includes(WAITS), `the ${label} row under ${shape} scopes the wait narrower: ${row?.detail}`);
    assert.doesNotMatch(row.detail, /the park before awaiting_release stands/u, shape);
  }
});
