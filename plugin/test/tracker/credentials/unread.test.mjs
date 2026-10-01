/* An unread field and an empty one are two claims, and a judging run decides whether to look on the
   difference: a row missing the bindings printed `none` for a project holding ten logins (ISS-2050). */
import assert from "node:assert/strict";
import test from "node:test";

import {
  bindingsOf,
  heldLabels,
  projectRows,
  releaseFrom,
} from "../../../src/tracker/project-config.mjs";

const POLICY = releaseFrom({ baseBranch: "staging", liveBranch: "master", releaseModel: "promote",
  releaseStrategy: "fast-forward", pipelineConfig: { autoProdDeploy: false } });
const NONE = { value: null, from: null };
const rowsOf = (deploy, credentials = false) => projectRows({ policy: POLICY, deploy, credentials, landing: NONE });
const row = (rows, label) => rows.find((one) => one.label === label);

const LOGINS = Array.from({ length: 10 }, (_, at) => ({
  label: `role ${at}`, username: `qa${at}@example.test`, password: `correct-horse-battery-${at}`,
}));

test("a row without the bindings key is a reading that did not happen, and null is a project with none", () => {
  const missing = bindingsOf({ slug: "anhome" });
  assert.match(missing.refused, /carried no deploy bindings at all/u, "absent is unread, never empty");
  assert.deepEqual([missing.urls, missing.withheld], [[], []], "and still the shape every walker reads");
  assert.equal(bindingsOf({ slug: "anhome", environments: null }).refused, undefined,
    "null is the tracker's own word for a project that configured none");
  assert.equal(bindingsOf({ environments: { testCredentials: LOGINS } }).withheld.length, 30);
});

test("the report says the credentials were not read where the row carried no bindings", () => {
  const rows = rowsOf(bindingsOf({ slug: "anhome" }));
  const credentials = row(rows, "test credentials");
  assert.equal(credentials.level, "note", "a reading that did not happen is no settled fact");
  assert.match(credentials.detail, /^not read — the project record carried no deploy bindings/u);
  assert.equal(rows.filter((one) => /^none/u.test(one.detail)).length, 0, "and nothing says none");
});

test("the report says the credentials were not read where the reading was refused, with its reason", () => {
  const rows = rowsOf({ urls: [], withheld: [], refused: "Forge answered 503\nno available server" });
  assert.equal(row(rows, "test credentials").detail, "not read — Forge answered 503",
    "the transport's own sentence, first line only");
  assert.equal(row(rows, "staging deploy").level, "note");
});

test("a project whose bindings are null still reads none, which is earned by a key present and empty", () => {
  const rows = rowsOf(bindingsOf({ environments: null }));
  assert.equal(row(rows, "test credentials").detail, "none");
  assert.equal(row(rows, "test credentials").level, "ok");
});

test("held credentials are counted, each label named once with how many carry it, and no value printed", () => {
  const rows = rowsOf(bindingsOf({ environments: { testCredentials: LOGINS } }));
  const out = rows.map((one) => `${one.label}: ${one.detail}`).join("\n");
  assert.match(row(rows, "test credentials").detail, /^30 value\(s\) held, forge doctor --credentials {2}← /u);
  assert.equal(row(rows, "held, not printed").detail,
    "test credentials · label ×10, test credentials · username ×10, test credentials · password ×10");
  assert.doesNotMatch(out, /qa\d@example\.test|correct-horse-battery|role \d/u,
    "neither a login nor its display name reaches the report without the flag");
});

test("a label carried once is named bare", () => {
  assert.equal(heldLabels([{ label: "a" }, { label: "b" }, { label: "a" }]), "a ×2, b");
  assert.equal(heldLabels([]), "");
});
