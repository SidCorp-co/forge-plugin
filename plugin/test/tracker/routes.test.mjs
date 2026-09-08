import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";

import { DECLARES, ROUTES, UNTYPED, answersOf, asToolCall, droppedRefusal, keyOf, mimeForName,
  noRouteRefusal, rowFor, served, undeclaredIn } from "../../src/tracker/routes.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const captures = join(here, "..", "fixtures", "rest");

const held = (name) => JSON.parse(readFileSync(join(captures, `${name}.json`), "utf8"));

/* The fixture names each route's part; a row that makes one request calls it `page` whatever the
   capture called the thing it read. */
const partsOf = (capture) => {
  const names = Object.keys(capture.rest);
  return names.length === 1 ? { page: capture.rest[names[0]] } : capture.rest;
};

const at = (held, path) => path.split(".").reduce((value, key) => value?.[key], held);

const without = (held, paths) => {
  const copy = structuredClone(held);
  for (const path of paths) {
    const keys = path.split(".");
    const parent = keys.slice(0, -1).reduce((value, key) => value?.[key], copy);
    if (parent) delete parent[keys.at(-1)];
  }
  return copy;
};

/* Where the two routes agree on the set and not on the order it arrives in, the order is not part
   of what a projection promises: every caller of these two finds a row by its own key. */
const sorted = (held, orderless) => {
  if (!orderless) return held;
  const copy = structuredClone(held);
  copy[orderless.path] = [...copy[orderless.path]].sort((one, two) =>
    String(one[orderless.by]).localeCompare(String(two[orderless.by])));
  return copy;
};

/* Every place the projected answer may differ from what the tool sent, and why. A path here that
   turns out not to differ fails: a declaration nobody re-reads is how a difference gets forgotten. */
const ARCHIVED = "the projection carries whether the row is archived and the tool's answer did not";

/* Five rows, one projection: each answers the project row the tracker serves, which is the body
   `projects-get` captured, so they are judged against it rather than each owing a capture of a
   project this suite would have to create to take one. */
const PROJECT_ROWS = ["forge_projects.create", "forge_projects.read", "forge_projects.update",
  "forge_projects.archive", "forge_projects.unarchive"];

/* The rows that answer the page as it came. A write whose answer nothing reads declares no
   projection at all, so there is no shape here to judge and the absence is what is asserted. */
const RAW_ROWS = ["forge_issues.link", "forge_issues.unlink_edge", "forge_config.pipeline",
  "forge_config.set_pipeline", "forge_config.facts", "forge_config.set_facts"];

const PAIRS = {
  "issues-get": {
    key: "forge_issues.get",
    differs: {
      descriptionSlots: "the tool answered a slots column the route does not carry, so a read asking "
        + "for it is refused by name rather than told it is empty",
      detectorKey: "the route carries the key a detector files under and the tool did not, and the "
        + "full read is the row whole",
      waitingKind: "the route carries the kind a park lands in and the tool did not",
      "relations.blocks": "the tool answered a relates edge among the blockers, and this projection "
        + "keeps that key for the edges that order a dispatch",
      "relations.relates": "a key the tool never answered at all: an edge ordering nothing was read "
        + "back under one of the two that do, where a caller counting blockers counted it",
    },
  },
  "issues-list": {
    key: "forge_issues.list",
    differs: {
      notice: "the list route sends no sentence about its own cap, and this CLI writes none in the tracker's name",
    },
  },
  "issues-search": {
    key: "forge_issues.list",
    differs: {
      notice: "the search route sends no sentence about its own cap, and this CLI writes none in the tracker's name",
    },
  },
  "comments-list": {
    key: "forge_comments.list",
    differs: {
      limit: "the comments route pages on a window of its own and never one this CLI asked for, so "
        + "what comes back is the count it served",
      total: "the route counts the thread behind the page and the tool did not, which is what a "
        + "reader walking it to the end has to reach",
    },
  },
  "knowledge-get": { key: "forge_knowledge.get", differs: {} },
  "knowledge-list": { key: "forge_knowledge.list", differs: {} },
  "config-get": {
    key: "forge_config.get",
    differs: {
      "config.categories": "no route this credential reaches carries the project's categories",
      "config.stateContext": "no route this credential reaches carries the state context",
      "config.projectFactsConfig": "no route this credential reaches carries the project-facts config",
    },
  },
  "guides-list": { key: "forge_guide.list", differs: {} },
  "guides-get": { key: "forge_guide.get", differs: {} },
  /* The archive is reversible and the verb that reverses it needs to be told which rows are in it,
     so both projections carry the column the tool's answer never had. */
  "projects-get": { key: "forge_projects.get", differs: { "project.archivedAt": ARCHIVED } },
  "projects-list": { key: "forge_projects.list", differs: { projects: ARCHIVED },
    orderless: { path: "projects", by: "id" } },
  "pm-snapshot": { key: "forge_project_pm.snapshot", differs: {} },
  "pm-runner-load": { key: "forge_project_pm.runner_load", differs: {} },
};

/* The rows with no pair: a write answers a row that a second write would not answer with again, and
   the offset lookup answers nothing the tool ever answered. Both are judged on the field names the
   projection produces from a captured body. */
const SHAPES = {
  "issues-at": { key: "forge_issues.at", keys: ["row", "total"] },
  "issues-create": { key: "forge_issues.create", keys: ["documentId", "issueId"] },
  "issues-update": { key: "forge_issues.update", keys: ["documentId", "issueId"] },
  "issues-transition": { key: "forge_issues.transition", keys: ["documentId", "status"] },
  "issues-merge": { key: "forge_issues.mark_merged", keys: ["id", "action"] },
  "issues-unmark": { key: "forge_issues.unmark", keys: ["id", "action"] },
  "comments-create": { key: "forge_comments.create", keys: ["documentId", "issueId", "body"] },
  /* One projection over two routes that answer different columns: the issue's row carries the
     uploader and the comment's does not, and both collapse to the five a citation reads. */
  "issues-attach": { key: "forge_uploads.request", keys: ["documentId", "name", "mime", "size", "url"] },
  "comments-attach": { key: "forge_uploads.request", keys: ["documentId", "name", "mime", "size", "url"] },
  "knowledge-upsert": { key: "forge_knowledge.upsert", keys: ["id", "slug"] },
  "knowledge-delete": { key: "forge_knowledge.delete", keys: ["deleted"] },
};

describe("the route table answers with the shape the tool answered with", () => {
  for (const [name, { key, differs, orderless }] of Object.entries(PAIRS)) {
    it(`${name}: the projection over the captured body equals what the tool sent`, () => {
      const capture = held(name);
      const projected = sorted(answersOf(ROUTES[key])(partsOf(capture), {}), orderless);
      const expected = sorted(capture.mcp, orderless);
      const paths = Object.keys(differs);
      for (const path of paths) {
        assert.notDeepEqual(at(projected, path), at(expected, path),
          `${name} declares ${path} as differing and it does not: drop the declaration or the reason is stale`);
      }
      assert.deepEqual(without(projected, paths), without(expected, paths));
    });
  }

  for (const [name, { key, keys }] of Object.entries(SHAPES)) {
    it(`${name}: the projection carries the names its callers read`, () => {
      const capture = held(name);
      const projected = answersOf(ROUTES[key])({ page: capture.rest.answer }, {});
      for (const wanted of keys) {
        assert.ok(Object.hasOwn(projected, wanted), `${key} answered no ${wanted}`);
      }
    });
  }
});

/* The lookup guesses an offset from the key's own number and searches from there, so it reads two
   things off this envelope: the row's key, to say whether the guess landed, and the count, which
   bounds the search and is what a refusal names. A body carrying neither would loop or lie. */
describe("the offset lookup's two reads", () => {
  it("the captured body carries the key the guess is compared against, and the count that bounds it", () => {
    const { row, total } = ROUTES["forge_issues.at"].answers({ page: held("issues-at").rest.answer }, {});
    assert.match(row.issueId, /^ISS-\d+$/u);
    assert.match(row.documentId, /^[0-9a-f-]{36}$/u);
    assert.ok(total > 1, "a total of one row would be the page's count and not the set's");
  });
});

describe("every row of the table is judged", () => {
  it("each row is paired against the tool or shape-checked", () => {
    const judged = new Set([...Object.values(PAIRS), ...Object.values(SHAPES)].map((one) => one.key));
    const unjudged = Object.keys(ROUTES)
      .filter((key) => !judged.has(key) && !PROJECT_ROWS.includes(key) && !RAW_ROWS.includes(key));
    assert.deepEqual(unjudged, ["forge_memory.search", "forge_project_pm.graph"],
      "a row with no verdict here is one whose projection nothing reads");
  });

  it("the rows answering a project row project the captured one into the same shape", () => {
    const page = held("projects-get").rest.project;
    for (const key of PROJECT_ROWS) {
      const { project } = ROUTES[key].answers({ page }, {});
      assert.equal(project.slug, "forge-plugin", key);
      assert.equal(project.archivedAt, null, `${key} drops the column the archive is read from`);
    }
  });

  it("the rows that answer the page as it came declare no projection to read it with", () => {
    for (const key of RAW_ROWS) {
      assert.equal(ROUTES[key].answers, undefined,
        `${key} projects an answer, so it owes a capture and a verdict like every other row`);
    }
  });

  /* The case AC-19-1-1's Proof names. A second endpoint is a fallback, and a fallback keeps a verb
     working while it hides the gap — so the table declaring one is the shape that fails here. */
  it("no row of the table declares a transport, every one of them being a request", () => {
    const declared = Object.entries(ROUTES)
      .filter(([, row]) => row.transport !== undefined)
      .map(([key]) => key);
    assert.deepEqual(declared, []);
    for (const row of Object.values(ROUTES)) {
      assert.equal(typeof row.requests, "function", "a row with no request builder reaches nothing");
    }
  });

  it("every capture says which route and which day it came from", () => {
    for (const file of readdirSync(captures)) {
      const capture = JSON.parse(readFileSync(join(captures, file), "utf8"));
      assert.ok(Object.keys(capture.routes ?? {}).length, `${file} names no route`);
      assert.match(String(capture.taken), /^\d{4}-\d{2}-\d{2}$/u, `${file} names no capture date`);
    }
  });
});

describe("a name the table does not serve", () => {
  it("the one capability REST does not serve names the route it wanted", () => {
    const said = noRouteRefusal("forge_knowledge.search");
    assert.match(said, /POST \/api\/projects\/:id\/knowledge\/search/u);
    assert.match(said, /forge knowledge list/u);
    assert.match(said, /forge knowledge get/u);
  });

  it("a tool nothing declares is told what it is, and not told a route that was never wanted", () => {
    const said = noRouteRefusal("forge_runners.list");
    assert.match(said, /forge -h/u, "which names where every verb is, each route being some verb's");
    assert.doesNotMatch(said, /\/api\//u);
  });

  it("an action names its own row, whether it is spelled in the name or in the arguments", () => {
    assert.equal(keyOf("forge_issues", { action: "get" }), "forge_issues.get");
    assert.equal(keyOf("forge_memory.search", {}), "forge_memory.search");
    assert.equal(rowFor("forge_issues", { action: "nonesuch" }), null);
  });
});

/* The half a projection test cannot reach: an argument the row's route never puts on the wire is a
   narrowing that vanishes, and the caller reads the whole answer as though it were the narrow one
   it asked for. `fields` was the live case — every read-back paid for the dependency and attachment
   routes it had not asked for, four times per command through the lease. */
describe("an argument a route does not send", () => {
  it("is named and refused, rather than dropped between here and the tracker", () => {
    const row = ROUTES["forge_comments.list"];
    assert.deepEqual(undeclaredIn(row, { action: "list", filters: { issue: "u-1" }, limit: 200 }), ["limit"]);
    const said = droppedRefusal("forge_comments.list", ["limit"], row);
    assert.match(said, /nothing was sent at all/u);
    assert.match(said, /This route takes filters/u, "and what it does take, so the caller can fix it");
  });

  it("aiming a project-scoped route elsewhere is every row's argument, and no route's", () => {
    assert.deepEqual(undeclaredIn(ROUTES["forge_issues.list"], { action: "list", projectId: "p-9" }), []);
  });

  it("a reader naming its fields pays for the parts those fields are on, and no others", () => {
    const whole = ROUTES["forge_issues.get"].requests({ documentId: "u-1" });
    assert.deepEqual(Object.keys(whole), ["issue", "dependencies", "attachments"]);
    const narrow = ROUTES["forge_issues.get"].requests({ documentId: "u-1", fields: ["plan"] });
    assert.deepEqual(Object.keys(narrow), ["issue"], "a plan is on the issue row and on neither of the others");
    assert.deepEqual(Object.keys(ROUTES["forge_issues.get"].requests({ documentId: "u-1", fields: ["relations"] })),
      ["issue", "dependencies"]);
  });

  /* Two routes serve the browse verb and both narrow on the same columns, so a filter the search
     route dropped would come back as a whole answer to a narrower ask than was made. */
  it("a search narrows on every filter the list route narrows on", () => {
    const asked = { limit: 200, filters: { search: "transport", status: "open", priority: "high", category: "bug" } };
    const searched = ROUTES["forge_issues.list"].requests(asked, "p-1").page.path;
    assert.match(searched, /^\/projects\/p-1\/issues\/search\?/u);
    for (const pair of ["q=transport", "status=open", "priority=high", "category=bug", "limit=200"]) {
      assert.ok(searched.includes(pair), `${pair} is not on ${searched}`);
    }
    const plain = { limit: 200, filters: { status: "open", priority: "high", category: "bug" } };
    const listed = ROUTES["forge_issues.list"].requests(plain, "p-1").page.path;
    assert.match(listed, /^\/projects\/p-1\/issues\?/u, "and the plain route is the one without a query");
    assert.ok(!listed.includes("q="), "which sends no q of its own");
  });

  /* The key this CLI reads a pair by is not a name the tracker has, wherever the tool carries its
     action in an argument: read as one it reaches the row past every check keyed on the tool. */
  it("an action-qualified key is turned back into the tool and action it stands for", () => {
    assert.deepEqual(asToolCall("forge_issues.list", { limit: 1 }),
      { name: "forge_issues", args: { limit: 1, action: "list" } });
    assert.deepEqual(asToolCall("forge_projects.list", {}), { name: "forge_projects.list", args: {} },
      "while a tool that spells its own action keeps the name the tracker knows it by");
    assert.deepEqual(asToolCall("forge_issues", { action: "list" }), { name: "forge_issues", args: { action: "list" } });
  });

  it("a part nobody asked for is absent from the answer, not answered empty", () => {
    const narrow = ROUTES["forge_issues.get"].answers({ issue: { id: "u-1", plan: "a plan" } }, {});
    assert.equal(Object.hasOwn(narrow, "relations"), false, "an empty edge set is a thing the tracker can say");
    assert.equal(Object.hasOwn(narrow, "attachments"), false);
    assert.equal(narrow.plan, "a plan");
  });
});

describe("what the table declares in the tracker's stead", () => {
  it("the knowledge enums are declared here, because the route refuses without naming a set", () => {
    assert.deepEqual(DECLARES.forge_knowledge.injection, ["always", "on_demand", "none"]);
    assert.ok(DECLARES.forge_knowledge.kind.includes("reference"));
  });

  it("every filter the browse verb takes is declared, whether the route or the walk applies it", () => {
    for (const name of ["search", "status", "priority", "category", "statusNot", "complexity"]) {
      assert.ok(DECLARES.forge_issues.filters.includes(name), `${name} is on no list`);
    }
  });
});

/* Written out here rather than read back off the table, which would be the table judging itself:
   these are the tracker's own upload tool's pairs, read off `EXT_MIME` in
   packages/core/src/mcp/tools/forge-uploads.ts at 29977155 in the sibling checkout. A name this map
   types differently is a name that went up before and is refused now, and nothing else says so. */
const TRACKER_TYPES = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".qt": "video/quicktime",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".markdown": "text/markdown",
  ".csv": "text/csv",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

describe("the type an upload's part carries", () => {
  it("is the one the tracker's own tool derives from the name, for every extension it maps", () => {
    for (const [ext, mime] of Object.entries(TRACKER_TYPES)) {
      assert.equal(mimeForName(`shot${ext}`), mime, ext);
      assert.equal(mimeForName(`SHOT${ext.toUpperCase()}`), mime, `${ext} upper-cased`);
    }
    assert.deepEqual(DECLARES.forge_uploads.extensions.slice().sort(),
      Object.keys(TRACKER_TYPES).sort(), "the printed set is the map's own keys and no other");
  });

  it("is the untyped default for a name outside that set, which the tracker refuses rather than this", () => {
    for (const name of ["gate-run.log", "archive.tar.gz", "noextension", "shot.svg", "page.html"]) {
      assert.equal(mimeForName(name), UNTYPED, name);
    }
    assert.equal(mimeForName(".txt"), "text/plain", "a name that is all extension is typed too");
  });
});

describe("the request an upload makes", () => {
  const row = ROUTES["forge_uploads.request"];
  const bytes = Buffer.from("two lines\nof it\n");

  it("is one POST to the target's own attachment route, carrying the file as a part", () => {
    const asked = { data: { target: "issue", targetId: "u-1", name: "gate.txt" }, bytes };
    const requests = row.requests(asked);
    assert.deepEqual(Object.keys(requests), ["page"], "one request and no round trip before it");
    assert.equal(requests.page.method, "POST");
    assert.equal(requests.page.path, "/issues/u-1/attachments");
    assert.deepEqual(requests.page.form.file, { name: "gate.txt", mime: "text/plain", bytes });
    const other = row.requests({ data: { target: "comment", targetId: "c-1", name: "gate.txt" }, bytes });
    assert.equal(other.page.path, "/comments/c-1/attachments");
  });

  it("is listed as both the routes it may take, a row with no target being the listing's read", () => {
    const printed = served().find((one) => one.key === "forge_uploads.request");
    assert.deepEqual(printed.requests,
      ["POST /issues/:targetId/attachments", "POST /comments/:targetId/attachments"]);
    assert.deepEqual(printed.sends, ["data", "bytes"]);
  });
});
