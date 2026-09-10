/* The baseline's own write, apart from record.test.mjs because the head it stamps is the one field
   of any shape read off git rather than off a flag or the session, and the citation that rests on it
   is refused at the write where it names no source. */
import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync, spawnSync } from "node:child_process";

import { tempRoom } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempRoom("record-baseline-");
const { checked } = await import("../../../src/flow/record/record.mjs");
const { parse, render } = await import("../../../src/flow/record/page.mjs");
const { SHAPES } = await import("../../../src/flow/machine.mjs");
const { stampedNow } = await import("../../../src/flow/worklog.mjs");

const ROOT = new URL("../../../../", import.meta.url).pathname;

/* The bit is asserted because `stamped` and `derived` look identical on the page and differ on read-back, where a derived field is dropped from every stored body and reaches no check. Named on no help row, the flag is turned away by the parse, so the provenance is the write's and a caller cannot supply it. */
test("a baseline stamps the head its checkout is at, and reads it back off its own record", () => {
  const head = SHAPES.baseline.fields.find((one) => one.flag === "head");
  assert.equal(head.stamped, "head", "the bit `stampedNow` filters on");
  assert.ok(!head.derived, "and not the bit that would keep it off every read-back");
  assert.ok(head.optional, "absent off a checkout, where a stamp would be an invention");
  const at = execFileSync("git", ["-C", ROOT, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  assert.equal(stampedNow(SHAPES.baseline).head, at, "the stamp is this checkout's head, not a composed one");
  assert.ok("head" in stampedNow({ fields: [{ flag: "head", stamped: "nowhere" }] }),
    "every stamped key is present, so a value a caller typed is cleared and not left standing");
  const typed = spawnSync(new URL("../../../bin/forge", import.meta.url).pathname,
    ["record", "baseline", "ISS-43", "--gate", "g", "--result", "r", "--commit", at, "--scope", "whole",
      "--head", at], { encoding: "utf8", env: process.env });
  assert.equal(typed.status, 1);
  assert.match(typed.stderr, /No record baseline flag named --head\./u, typed.stderr);
  const back = parse(render("baseline",
    { gate: "g", result: "r", commit: at, scope: "whole", cited: "the release's gate", head: at }));
  assert.equal(back.fields.head, at, "and it survives the write and the read the entry check makes");
  assert.equal(back.fields.cited, "the release's gate");
});

/* The shape's own check rather than the spawned verb: the endpoint resolves before `checked` runs,
   so a case driving the CLI would read the refusal for an unconfigured machine instead of this one. */
const refusedBy = (got) => {
  try {
    checked("baseline", got);
    return null;
  } catch (error) {
    return error.message;
  }
};

test("a citation naming no source is refused, and one naming a source is not", () => {
  const whole = { gate: "npm run check", result: "354 pass", commit: "43b811e", scope: "whole" };
  assert.equal(refusedBy(whole), null, "a baseline that cites nothing at all is a run of its own");
  assert.equal(refusedBy({ ...whole, cited: "the release's gate" }), null, "and a named source stands");
  for (const cited of ["", "   ", "\t\n"]) {
    assert.match(refusedBy({ ...whole, cited }), /a citation naming no source is a result from nowhere/u,
      `a citation of ${JSON.stringify(cited)} is a result from nowhere and is taken`);
  }
});
