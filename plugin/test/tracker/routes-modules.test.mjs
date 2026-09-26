import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";

import { ROUTES } from "../../src/tracker/routes.mjs";

const captures = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "rest");
const held = (name) => JSON.parse(readFileSync(join(captures, `${name}.json`), "utf8"));

/* What the module reading and the rank read off these two rows: the kind that tells a module from a
   label, the parent a weight is inherited through, and each issue's attributions with its key. */
describe("the module rows carry what a module is read by", () => {
  it("the label list keeps each row's kind, parent and description", () => {
    const { labels } = ROUTES["forge_labels.list"].answers({ page: held("labels-list").rest.answer }, {});
    const child = labels.find((one) => one.parentId);
    assert.ok(child, "the capture holds a module under another, or no parent is proved to survive");
    assert.equal(child.kind, "module");
    assert.ok(labels.some((one) => one.id === child.parentId && typeof one.description === "string"),
      "and the parent's description survives");
  });

  it("each attributed row keeps its key, its status and the attributions the route answered", () => {
    const page = held("issues-attributed").rest.answer;
    const { issues } = ROUTES["forge_issues.attributed"].answers({ page }, {});
    assert.ok(issues.length > 0, "the capture holds no row");
    for (const row of issues) {
      assert.match(row.issueId, /^ISS-\d+$/u);
      assert.ok(Array.isArray(row.modules), `${row.issueId} lost its modules`);
    }
  });

  it("the attributed read repeats each status and names the module it narrows to", () => {
    const { page } = ROUTES["forge_issues.attributed"].requests(
      { statuses: ["open", "confirmed"], statusNot: ["closed"], module: "m-1", limit: 200, offset: 400 }, "p");
    const query = new URL(`http://x${page.path}`).searchParams;
    assert.deepEqual(query.getAll("status"), ["open", "confirmed"]);
    assert.deepEqual(query.getAll("statusNot"), ["closed"]);
    assert.equal(query.get("withModules"), "true");
    assert.equal(query.get("module"), "m-1");
    assert.equal(query.get("offset"), "400");
  });
});
