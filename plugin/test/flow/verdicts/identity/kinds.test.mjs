/* A verdict names what it judged by one identity, and ISS-19 lets the writer reach two forge-core
   takes that it could not before: a contract version and a storefront draft. The grammar is core's
   own, so these cases pin the shapes core accepts and refuses, the block fields the write emits, and
   the door's storefront-draft payload for a probe verdict. */
import assert from "node:assert/strict";
import test from "node:test";

import { tempHome } from "../../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("verdict-identity-kinds").path;
const { verdictIdentityProblem } = await import("../../../../src/flow/machine/identity.mjs");
const { render } = await import("../../../../src/flow/record/page.mjs");
const { verdictDoorPrepared } = await import("../../../../src/flow/record/verdict/door.mjs");
const { checked } = await import("../../../../src/flow/record/record.mjs");

const SHA = "c8c35500000000000000000000000000000000ab";

test("a contract version alone is an identity, naming no commit", () => {
  assert.equal(verdictIdentityProblem({ verdict: "pass", contract: "forge-plugin/issues@1.4.0" }), null);
});

test("the verdict check accepts a contract verdict naming no --commit, where before it refused", () => {
  assert.doesNotThrow(() => checked("verdict",
    { criterion: "1", verdict: "pass", contract: "forge-plugin/issues@1.4.0", evidence: ["judged.txt"] }));
});

test("a storefront draft runtime with its environment is an identity", () => {
  assert.equal(verdictIdentityProblem({ verdict: "pass", runtime: "catalog-sync@draft:v12", environment: "preview" }), null);
});

test("a draft runtime without an environment is refused, naming --environment", () => {
  const said = verdictIdentityProblem({ verdict: "pass", runtime: "catalog-sync@draft:v12" });
  assert.match(String(said), /--environment/u);
});

test("an environment without a draft runtime is refused", () => {
  const said = verdictIdentityProblem({ verdict: "pass", commit: SHA, environment: "preview" });
  assert.match(String(said), /--environment names the environment a storefront draft/u);
});

test("a contract that is not <project>/<contract>@<version> is refused with the shape", () => {
  const said = verdictIdentityProblem({ verdict: "pass", contract: "Bad/thing@1" });
  assert.match(String(said), /--contract takes a contract version/u);
});

test("two identity families named together are refused as one too many", () => {
  assert.match(String(verdictIdentityProblem({ verdict: "pass", commit: SHA, contract: "p/c@1" })), /one identity/u);
  assert.match(String(verdictIdentityProblem({ verdict: "pass", commit: SHA, runtime: "wf@draft:v1", environment: "preview" })), /one identity/u);
});

test("a commit alone is still an identity, as it was before ISS-19", () => {
  assert.equal(verdictIdentityProblem({ verdict: "pass", commit: SHA }), null);
});

test("the write emits a contract block line core parses", () => {
  const body = render("verdict", [{ criterion: "1", verdict: "pass", contract: "forge-plugin/issues@1.4.0", evidence: ["judged.txt"] }]);
  assert.match(body, /^contract: forge-plugin\/issues@1\.4\.0$/mu);
});

test("the write emits the draft runtime and its environment as block lines", () => {
  const body = render("verdict", [{ criterion: "1", verdict: "pass", runtime: "catalog-sync@draft:v12", environment: "preview", evidence: ["judged.txt"] }]);
  assert.match(body, /^runtime: catalog-sync@draft:v12$/mu);
  assert.match(body, /^environment: preview$/mu);
});

test("the door records a draft-runtime probe verdict as a storefront_draft identity", () => {
  const probe = JSON.stringify({ kind: "request", request: { method: "GET", path: "/catalog", as: "anonymous" }, expect: { status: 200 } });
  const { drafts } = verdictDoorPrepared(
    [{ criterion: "1", verdict: "pass", runtime: "catalog-sync@draft:v12", environment: "preview", probe, evidence: ["shot.webm"] }],
    { reference: "ISS-19", classes: null, run: null },
  );
  assert.equal(drafts.length, 1);
  assert.deepEqual(drafts[0].payload.identity, {
    kind: "storefront_draft", workflowId: "catalog-sync", draftVersion: "v12", environment: "preview",
  });
});
