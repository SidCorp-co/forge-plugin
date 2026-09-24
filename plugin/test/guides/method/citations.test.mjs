/* What the served method costs a run in calls before it does anything: how an issue is read, and how
   often a reference is sent for. Each case reads every part of every shipped flow as it sits on disk,
   every fenced branch included, because a citation a branch hides from one project is still a call
   another project is asked to make (ISS-1105). */
import assert from "node:assert/strict";
import test from "node:test";

import { flat, tempHome } from "../../fixtures.mjs";

process.env.XDG_CONFIG_HOME = tempHome("method-citations").path;
const { FLOW_SLUGS } = await import("../../../src/guides/flow.mjs");
const { guideParts, referencesOf } = await import("../../../src/guides/skill-guides.mjs");

const PLUGIN = new URL("../../../", import.meta.url).pathname;
const SLUG = "issue-flow";

/* Flattened, since a citation wrapped at the line limit is the same call as one that is not. */
const CITED = /`forge guide ([a-z][a-z0-9-]*) ([a-z<][a-z0-9_<>-]*)`/gu;

const labelOf = (text) => {
  const heading = /^## (.+)$/mu.exec(text)?.[1] ?? "";
  const phase = /^Phase (\d+)/u.exec(heading)?.[1];
  if (phase !== undefined) return `Phase ${phase}`;
  return /^The five rules/u.test(heading) ? "Rule" : heading;
};

const partsOf = (flow) => (guideParts(SLUG, PLUGIN, flow) ?? []).map(({ name, text }) => ({
  name, label: labelOf(text), text: flat(text), cited: [...flat(text).matchAll(CITED)].map((hit) => `${hit[1]} ${hit[2]}`),
}));

const REFERENCE_PART = "Reference material";

/* The foot table's rows for this skill's own references, keyed by reference: what the `At` cell
   names, read as phase numbers and whether a rule is named. */
const rowsOf = (parts) => {
  const table = parts.find((one) => one.label === REFERENCE_PART);
  assert.ok(table, "the method ends with its reference table");
  return [...table.text.matchAll(/\| `forge guide issue-flow ([a-z-]+)` \| ([^|]+) \|/gu)]
    .map(([, reference, at]) => {
      const phases = [...at.replace(/Rule \d+/gu, "").matchAll(/Phases? ([\d, and]+)/gu)]
        .flatMap(([, list]) => list.match(/\d+/gu) ?? []);
      return { reference, phases, rule: /Rule \d+/u.test(at) };
    });
};

const names = (row, label) => (label === "Rule" ? row.rule : row.phases.some((n) => label === `Phase ${n}`));

for (const flow of FLOW_SLUGS) {
  const parts = partsOf(flow);
  const phase = (n) => parts.find((one) => one.label === `Phase ${n}`);

  test(`${flow}: Phase 1 reads an issue whole in two named calls, and names the narrower one and its case`, () => {
    const read = phase(1).text;
    assert.match(read, /Read \*\*everything the issue carries\*\*[^.]*in two calls: `forge issue ISS-nn` prints the body/u,
      "the read is named as two calls, the issue verb first");
    assert.match(read, /`forge comment ISS-nn` the thread whole/u, "and the thread is the second of them");
    assert.match(read, /only where a body is too large to carry, and `forge issue ISS-nn --fields a,b` is that read/u,
      "the narrower read is named with the one case that earns it");
    for (const part of parts) {
      assert.doesNotMatch(part.text, /narrowest calls/u, `${part.name} still asks for the narrowest calls`);
    }
  });

  test(`${flow}: no part routes through the contract's table of contents`, () => {
    for (const part of parts) {
      assert.doesNotMatch(part.text, /`forge guide contract`/u, `${part.name} sends a reader to the contract's bare listing`);
      assert.doesNotMatch(part.text, /table of contents/u, `${part.name} names a table of contents as a route`);
    }
  });

  test(`${flow}: no part cites one reference twice`, () => {
    for (const part of parts) {
      const twice = part.cited.filter((one, at) => part.cited.indexOf(one) !== at);
      assert.deepEqual(twice, [], `${part.name} cites ${twice.join(", ")} more than once`);
    }
  });

  test(`${flow}: a reference is cited by its command only where the table's row for it names`, () => {
    const rows = rowsOf(parts);
    const shipped = referencesOf(SLUG, PLUGIN, flow);
    assert.deepEqual(rows.map((row) => row.reference).sort(), [...shipped].sort(),
      "the table keeps one row per reference, and a row for every one");
    for (const part of parts.filter((one) => one.label !== REFERENCE_PART)) {
      for (const reference of part.cited.filter((one) => one.startsWith(`${SLUG} `)).map((one) => one.split(" ")[1])) {
        const row = rows.find((one) => one.reference === reference);
        assert.ok(row && names(row, part.label),
          `${part.name} (${part.label}) cites \`forge guide ${SLUG} ${reference}\`, which its row does not name there`);
      }
    }
  });

  test(`${flow}: the approved part of the contract is cited in Phase 3 alone`, () => {
    const citing = parts.filter((one) => one.cited.includes("contract approved")).map((one) => one.label);
    assert.deepEqual(citing, ["Phase 3"], "the phase that enters approved is the one that reads it");
  });
}
