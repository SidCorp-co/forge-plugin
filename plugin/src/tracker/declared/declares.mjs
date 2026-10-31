/* What this CLI declares in the tracker's stead, route by route: the values a field takes, the caps
   a write is measured against, the filters the browse verb applies and the collections an upload
   targets. Apart from `../routes.mjs`, which builds the requests: this is the table and that is the
   transport's use of it. */

import { HELD, LEGACY_STATUSES } from "./issue-machine.mjs";

/* Every filter the browse verb takes, by what applies it: the list route narrows on `wire`, `route`
   is served by a route of its own, and the walk applies `here` to the rows it is holding. */
export const FILTERS = {
  search: "route",
  status: "wire",
  priority: "wire",
  category: "wire",
  statusNot: "here",
  complexity: "here",
  createdAfter: "here",
  createdBefore: "here",
  updatedAfter: "here",
};

/* The words a release note's short title holds at most, core's `RELEASE_NOTE_TITLE_WORDS_MAX`
   (`@forge/contracts/release-notes`, REQ-40 BC-6): a bound no code-point cap can carry, so it is
   declared beside the caps rather than among them. Its characters are the `title` half of the
   `releaseNotes` cap below, core's `RELEASE_NOTE_TITLE_CHARS_MAX`. */
export const NOTE_TITLE_WORDS = 10;

/* Kept apart from every declared set so none offers one; read only where a caller or an old history
   still names one. */
export const RETIRED_STATUS = Object.entries(LEGACY_STATUSES).map(([name, replacedBy]) => ({ name, replacedBy }));

/* Strict: a target outside this map builds no path, and its one caller refuses one before asking. */
export const COLLECTIONS = { issue: "issues", comment: "comments" };

/* Only what the route serves is declared, as the values the route takes — or, where a value carries
   more than its own name, as rows that answer with one. A name on neither list is refused rather
   than ignored. The reader that spends a row beside its name is `statusKind` in `rest.mjs`. */
export const DECLARES = {
  forge_issues: {
    filters: Object.keys(FILTERS),
    priority: ["critical", "high", "medium", "low", "none"],
    /* A bare `in_progress` names every place inside it, which a browse filter takes and a set does
       not, a set having to say which step it writes. */
    status: [
      { name: "draft" },
      { name: "open", step: true },
      { name: "reopen" },
      { name: "in_progress", heldAt: Object.values(HELD) },
      { name: HELD.plan, step: true },
      { name: "approved", step: true },
      { name: HELD.build, step: true },
      { name: HELD.test, step: true },
      { name: HELD.release, step: true },
      { name: "awaiting_release", step: true },
      { name: "closed" },
      { name: "on_hold" },
      { name: "needs_info" },
      { name: "dropped", landsNothing: true },
    ],
    caps: {
      title: { self: 500, halves: {} },
      description: { self: 100000, halves: {} },
      category: { self: 100, halves: {} },
      detectorKey: { self: 120, halves: {} },
      acceptanceCriteria: { self: 100000, halves: {} },
      plan: { self: 200000, halves: {} },
      releaseNotes: { self: null, halves: { section: null, title: 80, userFacing: 500, technical: 500 } },
      note: { self: 2000, halves: {} },
      taskTitle: { self: 500, halves: {} },
      taskDescription: { self: 50000, halves: {} },
      reason: { self: 10000, halves: {} },
    },
  },
  /* The body's cap, as the tracker's refusal of a longer one prints it: a record measured against it
     before its evidence goes up is refused while nothing it sends can be taken back (ISS-489). */
  forge_comments: {
    caps: {
      body: { self: 10000, halves: {} },
      /* What core screens one field of a `forge-record` block at, counted in code points as it counts
         them (core's `FORGE_RECORD_FIELD_BUDGET`): a record carrying a longer
         value is refused whole with `field-budget`, so `forge record` measures each value against it
         before anything is sent. */
      recordField: { self: 400, halves: {} },
    },
  },
  forge_knowledge: {
    kind: ["overview", "scenario", "workflow", "rule", "guide", "reference", "glossary"],
    injection: ["always", "on_demand", "none"],
    confidence: ["verified", "inferred", "deprecated"],
    authoredBy: ["human", "agent", "imported"],
  },
  /* The ask route's own bounds, as its schema states them: a choice question holds at most ten
     options and the prompt at most 8000 characters, counted as the route counts a string. Read by
     `flow/park/asked.mjs`, so a question over one is refused while nothing of the call is up. An
     option's label is a reading, which `recordField` above already holds under the route's 500. */
  forge_questions: {
    caps: {
      prompt: { self: 8000, halves: {} },
      options: { self: 10, halves: {} },
    },
  },
  /* The set of types an upload may carry is the tracker's, read off its refusal, and never kept here. */
  forge_uploads: {
    targets: Object.keys(COLLECTIONS),
  },
};

/** What the table declares in the tracker's stead: the values of one field's set, or `[]` where it declares none.
 *  A row carrying more than its own name answers with the name, so what a declared set holds is the values whatever each row says beside them; a declared field that is not a list at all — `caps` — passes through as it is. This is the one unwrap of a row, and `table` is there so a synthetic declaration is read by the same one.
 *  The set is this CLI's and goes stale when the tracker grows a value, which is what the caller's sentence around it has to say. */
export const declaredFor = (tool, field, table = DECLARES) => {
  const held = table[tool]?.[field] ?? [];
  return Array.isArray(held) ? held.map((one) => one?.name ?? one) : held;
};
