import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";

import { DECLARES, ISSUE_PARTS, ROUTES, answersOf, asToolCall, keyOf, partsAmong, rowFor, served }
  from "../../src/tracker/routes.mjs";
import { UNTYPED, mimeForName } from "../../src/wire/upload-mimes.mjs";
import { droppedRefusal, noRouteRefusal, undeclaredIn } from "../../src/tracker/declared/no-route.mjs";
import { CHOSEN, staleDeclarations } from "../../src/tracker/declared/name-join.mjs";

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

/* The deploy bindings on a project that configured none: the tool answers the empty binding whole
   and the route answers the column as it stands, which is null. The projection carries the row's own
   answer rather than the tool's expansion, so a caller can tell a project that configured nothing
   from one whose reading did not happen. */
const EMPTY_BINDINGS = "the tool expands a null column into the empty binding and the route answers "
  + "the column as the row holds it";

/* Five rows, one projection: each answers the project row the tracker serves, which is the body
   `projects-get` captured, so they are judged against it rather than each owing a capture of a
   project this suite would have to create to take one. */
const PROJECT_ROWS = ["forge_projects.create", "forge_projects.read", "forge_projects.update",
  "forge_projects.archive", "forge_projects.unarchive"];

/* The rows that answer the page as it came. A write whose answer nothing reads declares no
   projection at all, so there is no shape here to judge and the absence is what is asserted. */
const RAW_ROWS = ["forge_issues.link", "forge_issues.unlink_edge", "forge_config.pipeline",
  "forge_config.set_pipeline", "forge_config.facts", "forge_config.set_facts",
  /* A label's delete answers 204 and nothing: `forge doctor modules` reads the list back instead. */
  "forge_labels.delete",
  /* The deployment platform's own words, which this CLI does not own and does not rename: a
     projection over them would be this file's guess at a shape the tracker is free to grow. */
  "forge_coolify.list", "forge_coolify.targets", "forge_coolify.status",
  "forge_coolify.rollback_images", "forge_coolify.deploy", "forge_coolify.cancel"];

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
      truncated: "the tool said a second time, in a key of its own, what hasMore beside it already said; the reader that spent it was deleted and none replaced it (ISS-584)",
      truncatedBy: "the tool named the cap that bound the page, which is the limit the caller passed and already holds (ISS-584)",
    },
  },
  "issues-search": {
    key: "forge_issues.list",
    differs: {
      notice: "the search route sends no sentence about its own cap, and this CLI writes none in the tracker's name",
      truncated: "the search row answers through the same projection and drops the pair with it (ISS-584)",
      truncatedBy: "the search row answers through the same projection and drops the pair with it (ISS-584)",
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
    },
  },
  "guides-list": { key: "forge_guide.list", differs: {} },
  "guides-get": { key: "forge_guide.get", differs: {} },
  /* The archive is reversible and the verb that reverses it needs to be told which rows are in it,
     so both projections carry the column the tool's answer never had. */
  "projects-get": { key: "forge_projects.get",
    differs: { "project.archivedAt": ARCHIVED, "project.environments": EMPTY_BINDINGS } },
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
  /* The reverse read's own row. No pair: the MCP surface never had this action, so there is no
     answer to compare with, and what is pinned is that the three fields a citation may sit in and
     the field the search matched all survive the projection. */
  "issues-citing": { key: "forge_issues.citing",
    keys: ["issues", "returned", "limit", "hasMore"] },
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
  /* A module is a label whose kind says so: the reading prints its parent and its description. */
  "labels-create": { key: "forge_labels.create", keys: ["id", "name", "kind", "parentId", "description"] },
  "labels-update": { key: "forge_labels.update", keys: ["id", "name", "kind", "parentId", "description"] },
  "labels-list": { key: "forge_labels.list", keys: ["labels"] }, "issues-attributed": { key: "forge_issues.attributed", keys: ["issues", "returned", "limit", "hasMore"] },
  /* The status history, a project's and one issue's: the events and the cursor a walk moves by. */
  "issues-activity": { key: "forge_issues.activity", keys: ["events", "nextBefore"] },
  "issues-issue-activity": { key: "forge_issues.issue_activity", keys: ["events", "nextBefore"] },
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

/* The three rows that page answer a cut page the same way: the window is `hasMore` and the cap is
   the limit the caller passed, so a second key for either is a byte no reader spends (ISS-584). */
describe("a cut page says it was cut and says it once", () => {
  const CUT = { items: [], returned: 2, limit: 2, hasMore: true, nextCursor: "c2" };
  const rows = [["forge_issues.list", "issues"], ["forge_issues.citing", "issues"],
    ["forge_comments.list", "comments"]];

  for (const [key, held] of rows) {
    it(`${key} answers hasMore and neither truncated nor truncatedBy`, () => {
      const answer = ROUTES[key].answers({ page: CUT }, {});
      assert.equal(answer.hasMore, true, "the one reading of completeness every caller uses");
      assert.equal(Object.hasOwn(answer, "truncated"), false, "a second way to say hasMore");
      assert.equal(Object.hasOwn(answer, "truncatedBy"), false, "the limit the caller passed in");
      assert.ok(Object.hasOwn(answer, held), `${key} answered no ${held}`);
    });
  }
});

/* The three write rows answer through one reader, and what it leaves out is two things at once: the
   columns the read path already drops, and every field this same call sent and got back as sent. */
describe("a write answers what the caller could not already know", () => {
  const row = held("issues-create").rest.answer;
  const sent = { title: row.title, description: row.description, status: row.status,
    priority: "urgent", plan: "a plan the tracker did not store" };
  const answer = ROUTES["forge_issues.create"].answers({ page: row }, { data: sent });

  it("the tracker's search index and its identity columns never reach the caller", () => {
    for (const name of ["identSearch", "createdById", "metadata", "source", "releaseBatchRunId"]) {
      assert.equal(Object.hasOwn(answer, name), false, `${name} reached the caller`);
    }
  });

  it("a column the read path drops goes whether or not the call sent a value for it", () => {
    assert.ok(Object.hasOwn(row, "identSearch"), "the capture carries no dropped column to judge");
    assert.equal(Object.hasOwn(sent, "identSearch"), false, "and the call sent none for it");
    assert.equal(Object.hasOwn(answer, "identSearch"), false);
  });

  it("a field the call sent and got back as sent is not handed to the process that sent it", () => {
    for (const name of ["title", "description", "status"]) {
      assert.equal(row[name], sent[name], `the capture disagrees with the call about ${name}`);
      assert.equal(Object.hasOwn(answer, name), false, `${name} was read back to its own writer`);
    }
  });

  it("a value the tracker did not store as sent stays, that being what the caller cannot derive", () => {
    assert.notEqual(row.priority, sent.priority, "the capture agrees with the call about priority");
    assert.equal(answer.priority, row.priority);
    assert.notEqual(row.plan, sent.plan, "the capture agrees with the call about the plan");
    assert.equal(Object.hasOwn(answer, "plan"), true, "a field the tracker ignored reads as ignored");
  });

  it("a field the call never sent stays", () => {
    assert.equal(answer.createdAt, row.createdAt);
  });

  it("the two ids are derived above the filter, both their sources being dropped columns", () => {
    assert.equal(answer.documentId, row.id);
    assert.equal(answer.issueId, row.displayId);
  });

  it("the update and the transition answer through the create's own reader", () => {
    for (const key of ["forge_issues.update", "forge_issues.transition"]) {
      assert.equal(ROUTES[key].answers, ROUTES["forge_issues.create"].answers,
        `${key} answers through a reader of its own, which is a second list`);
    }
  });

  it("a status the tracker answered other than the one asked for is what survives", () => {
    const moved = ROUTES["forge_issues.transition"]
      .answers({ page: { ...row, status: "developed" } }, { data: { status: "testing" } });
    assert.equal(moved.status, "developed", "the guard that reads it back has nothing to read");
    const landed = ROUTES["forge_issues.transition"]
      .answers({ page: { ...row, status: "testing" } }, { data: { status: "testing" } });
    assert.equal(Object.hasOwn(landed, "status"), false, "a move that landed as asked says nothing");
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

  /* What the retired column read wrong: a default substituted here answered the same for a project
     that configured nothing and one that configured a full staging deployment, and no verb of this
     CLI could tell the two apart (ISS-1965). */
  it("the deploy bindings travel as the row holds them, and the row's own secrets do not", () => {
    const page = held("projects-get").rest.project;
    const bindings = { live: null, limits: null,
      preview: { url: "https://beta.example.test" }, testCredentials: [] };
    for (const key of [...PROJECT_ROWS, "forge_projects.get"]) {
      const answer = (row) => ROUTES[key].answers({ page: row }, {}).project;
      assert.equal(answer(page).environments, null, `${key} invents no binding where the row holds none`);
      assert.deepEqual(answer({ ...page, environments: bindings }).environments, bindings, key);
      assert.equal(answer(without(page, ["environments"])).environments, undefined,
        `${key} substitutes no shape for a key the row does not carry at all`);
      for (const secret of ["webhookSecret", "apiKey"]) {
        assert.equal(Object.hasOwn(answer({ ...page, [secret]: "held" }), secret), false,
          `${key} carries the row's ${secret} to a caller`);
      }
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

/* The name half of what `differs` above declares of a value, under that table's own rule. The
   reading that produces a name is the shaper's own — `plugin/src/tracker/declared/name-join.mjs`. The two
   directions themselves are a verb and not a step, this capture being sixteen days old at the time
   of writing and no schedule reaching that: a check comparing a shaper against a capture taken from
   the same wire moves with it or not at all. Spent here is whether each declaration is still true of
   the row on disk, which is a reading of this repository and needs no credential. */
describe("a name a project-row shaper chose not to read is declared, and the declaration is checked", () => {
  const taken = () => JSON.parse(readFileSync(join(captures, "projects-get.json"), "utf8"));

  it("every declaration is true of the capture, and the capture carries no undeclared drop", () => {
    const capture = taken();
    assert.deepEqual(staleDeclarations(capture.rest.project, capture.taken), []);
  });

  it("a declared drop the shaper asks for fails, as the value table's own rule does", () => {
    const capture = taken();
    const said = staleDeclarations(capture.rest.project, capture.taken,
      { "forge_projects.get": { slug: "a reason for a name the shaper reads on every call" } });
    assert.equal(said.length, 1);
    assert.match(said[0], /declares slug as a chosen drop and the shaper asks the row for it/u);
    assert.match(said[0], /drop the declaration/u, "which is the one thing to do about it");
  });

  it("a declaration the capture cannot prove names the day the capture was taken", () => {
    const capture = taken();
    const said = staleDeclarations(capture.rest.project, capture.taken,
      { "forge_config.get": { nosuchColumn: "a reason for a name no row has ever carried" } });
    assert.equal(said.length, 1);
    assert.match(said[0], new RegExp(`carries no such column`, "u"));
    assert.ok(said[0].includes(capture.taken),
      `the finding names no capture date, so a rule read off a stale capture reads as a rule about today: ${said[0]}`);
    assert.match(said[0], /re-take plugin\/test\/fixtures\/rest\/projects-get\.json/u,
      "and which capture, by path");
    assert.match(said[0], /credential columns deleted before the body reaches disk/u,
      "and the one rule a run re-taking it may not forget");
  });

  /* The two the row carries and no reading of it may name. They are on neither list because they are
     struck before either direction is read, so there is nothing left for a reason to explain — and
     this capture was scrubbed of both before it reached disk, which is why nothing here can prove
     their absence from a declaration by reading the row. */
  it("neither credential column is declared, on either shaper", () => {
    for (const held of Object.values(CHOSEN)) {
      for (const name of ["webhookSecret", "apiKey"]) {
        assert.equal(Object.hasOwn(held, name), false, name);
      }
    }
    const capture = taken();
    for (const name of ["webhookSecret", "apiKey"]) {
      assert.equal(Object.hasOwn(capture.rest.project, name), false,
        `${name} is on the capture: scrub it before it reaches disk`);
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
    const narrow = ROUTES["forge_issues.get"].requests({ documentId: "u-1", fields: [] });
    assert.deepEqual(Object.keys(narrow), ["issue"], "a list naming neither part asks for the row alone");
    assert.deepEqual(Object.keys(ROUTES["forge_issues.get"].requests({ documentId: "u-1", fields: ["relations"] })),
      ["issue", "dependencies"]);
    assert.deepEqual(Object.keys(ROUTES["forge_issues.get"].requests({ documentId: "u-1", fields: ["attachments"] })),
      ["issue", "attachments"]);
  });
});

/* One level in from the argument nothing sends: `fields` is sent, and the route reads two of its
   values and answers whole for every other — so a caller naming a column of the row was told nothing
   and got the row it would have got anyway, at eight of the twelve call sites (ISS-588). */
describe("a value a route cannot honour", () => {
  it("is refused by the same check and named with the values the route does take", () => {
    const row = ROUTES["forge_issues.get"];
    const found = undeclaredIn(row, { action: "get", documentId: "u-1", fields: ["relations", "plan"] });
    assert.deepEqual(found, ["fields: plan"],
      "the value the route reads rides, and the one it would have dropped is what comes back");
    const said = droppedRefusal("forge_issues.get", found, row);
    assert.match(said, /nothing was sent at all/u);
    assert.match(said, /fields only relations or attachments/u, "and what it does take, so the caller can fix it");
  });

  it("is every value of the list, so one refusal answers for all of them", () => {
    assert.deepEqual(undeclaredIn(ROUTES["forge_issues.get"], { fields: ["plan", "description"] }),
      ["fields: plan, description"]);
  });

  it("is no value at all where the list names the parts, or neither of them", () => {
    assert.deepEqual(undeclaredIn(ROUTES["forge_issues.get"], { fields: ISSUE_PARTS }), []);
    assert.deepEqual(undeclaredIn(ROUTES["forge_issues.get"], { fields: [] }), []);
    assert.deepEqual(undeclaredIn(ROUTES["forge_issues.get"], { documentId: "u-1" }), []);
  });

  it("is no row's question but the one that declares a legal set", () => {
    assert.deepEqual(undeclaredIn(ROUTES["forge_issues.list"], { limit: 200, filters: { search: "x" } }), []);
  });

  /* The caller that holds names of its own asks the route for the parts among them and projects the
     rest off the answer itself, so the refusal above is never what its reader meets. */
  it("is what a caller's own names are filtered down to before they are sent", () => {
    assert.deepEqual(partsAmong(["relations", "plan", "status"]), ["relations"]);
    assert.deepEqual(partsAmong(["status", "plan"]), []);
    assert.deepEqual(partsAmong(null), []);
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

/* The half a fixture at the tool boundary cannot see: `needs` reaches the transition's `data` and the
   body that leaves the machine is built here, where a pass-through is the whole of the row (ISS-1396). */
describe("the request a transition makes", () => {
  const row = ROUTES["forge_issues.transition"];

  it("carries every field beside the status, and the status only as toStatus", () => {
    const asked = { documentId: "u-1", data: { status: "needs_info", reason: "why it stopped", needs: "what settles it" } };
    const sent = row.requests(asked).page;
    assert.equal(sent.method, "POST");
    assert.equal(sent.path, "/issues/u-1/transition");
    assert.deepEqual(sent.body, { toStatus: "needs_info", reason: "why it stopped", needs: "what settles it" });
  });

  it("leaves out a field the caller did not set, so an absent needs is an absent key", () => {
    const sent = row.requests({ documentId: "u-1", data: { status: "waiting", reason: "why it stopped" } }).page;
    assert.deepEqual(Object.keys(sent.body).sort(), ["reason", "toStatus"]);
  });
});
