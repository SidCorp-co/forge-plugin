/* This plugin's disposition of the tracker's own guides. The tracker serves the lifecycle rules of
   its pipeline runner, and no session under this plugin is that runner: five of the twelve state a
   rule the contract has replaced and two more are the runner's in half, so a passthrough hands every
   agent two contracts on its first read. The disposition is code and not configuration because it is this plugin's reading of the
   tracker, and a project cannot rightly turn a contradiction back on. docs/cli/the-guides.md
   carries what the stale rules cost; `forge guide contract` prints what holds instead. */

import { LISTING_ROW as CONTRACT_ROW, SLUG as CONTRACT_SLUG, contractAnswer } from "./contract.mjs";
import { skillGuideAnswer, skillGuideSlugs, skillListingRow } from "./skill-guides.mjs";

/* The guides this copy answers off its own disk, listed rather than reached by the verb comparing a
   slug against one constant of its own; a slug absent from it is the tracker's, answered `null`. */
const LOCAL = [
  { slug: CONTRACT_SLUG, row: CONTRACT_ROW, answer: contractAnswer },
  ...skillGuideSlugs().map((slug) => ({ slug, row: skillListingRow(slug), answer: skillGuideAnswer(slug) })),
];
export const LOCAL_SLUGS = LOCAL.map((one) => one.slug);
export const LOCAL_ROWS = LOCAL.map((one) => one.row);
export const localGuide = (slug) => LOCAL.find((one) => one.slug === slug)?.answer ?? null;

/* Having a row is what withholds the guide, whichever disposition the row carries: neither a page
   the contract replaced nor a page half of which is the runner's is one an agent can follow whole,
   and naming a stale guide is how an agent comes to weigh two sources. A slug in no row is the
   tracker's and passes through untouched.

   So the disposition no longer decides visibility, and what it still decides is one thing:
   `supersededSlugs`, which `forge doctor` alone calls, keeps meaning `superseded` exactly, because
   the overlap measure asks whether a project's own file restates a guide's authority — a different
   question from whether this verb serves the page. What `--tracker` prints is decided by the rules
   the row enumerates, not by its disposition. */
export const GUIDE_TABLE = [
  {
    slug: "pipeline-and-issue-lifecycle",
    disposition: "superseded",
    why: "it is the tracker's own pipeline runner, whose steps set the statuses this contract earns",
    replaced: [
      {
        says: "any status may move to any status, and the ladder is a happy path rather than a constraint",
        instead: "every status is earned by the payload the contract names, and `forge advance` refuses a jump",
      },
      {
        says: "`developed` is set by hand with `sessionContext.branch`, to enter at the review gate",
        instead: "`developed` is earned by an approving review of the head that landed and by the merged"
          + " mark, and `sessionContext` is the lease this CLI writes",
      },
      {
        says: "`reopen` is a bounce for a regression or a failed check",
        instead: "a regression is a new issue, and `reopen` is a person's word that owes their finding"
          + " and a triage of it before anything falls",
      },
      {
        says: "`plan` and `acceptanceCriteria` are written by the clarify and plan steps",
        instead: "the agent writes both at `approved`, through `forge plan` and `forge record criteria`",
      },
      {
        says: "the recommended discard for non-work is `closed` plus `unmark`, a paragraph after the"
          + " one saying `dropped` is for anything discarded",
        instead: "nothing landing earns `dropped`, which stamps no mark and needs no undo",
      },
    ],
    by: ["forge guide contract", "forge advance --owed"],
  },
  {
    slug: "writing-an-issue",
    disposition: "superseded",
    why: "it prescribes a body shape the filing lint refuses",
    replaced: [
      {
        says: "six blocks chosen from three shapes: an opening blockquote, a who-it-hurts table, one"
          + " diagram, what-to-do, decisions, evidence",
        instead: "an outcome, a rule or an invariant, and an out-of-scope, matched by heading, which is"
          + " what `forge new` reads a body against and what the tracker's own `forge_issues`"
          + " description asks a description to be",
      },
    ],
    by: ["forge new", "forge hooks --how issue-shape"],
  },
  {
    slug: "what-is-an-issue",
    disposition: "superseded",
    why: "its routing forbids the filing this flow runs on, and closes what nothing landed for",
    replaced: [
      {
        says: "filing a new issue is never the route for a residual",
        instead: "a defect found while building is a new issue, related or blocking, and"
          + " `forge new --into` posts a finding on an issue already open",
      },
      {
        says: "non-work leaves by `closed` plus `unmark`",
        instead: "nothing landing earns `dropped`, which is reachable only before `developed` and stamps"
          + " no mark, so `closed` stays what code that landed earns",
      },
    ],
    by: ["forge new", "forge guide contract"],
  },
  {
    slug: "agent-setup",
    disposition: "superseded",
    why: "it orients an agent inside the runner, in verbs and stages this CLI does not have",
    replaced: [
      {
        says: "recall first, through `forge_memory_search`",
        instead: "no verb here calls it, and what a run is owed is on the issue's own record, which"
          + " `forge resume` re-mints",
      },
      {
        says: "`draft` versus `open` decides whether a runner slot is burned",
        instead: "nothing here dispatches: an issue is worked by the run that takes its lease",
      },
      {
        says: "`plan-by-hand` is a red flag, because a staged project's clarify step or an autonomous"
          + " driver's planning phase writes those fields",
        instead: "the agent writes them itself, at `approved`, and a status with no payload is unearned",
      },
    ],
    by: ["forge resume", "forge guide contract"],
  },
  {
    slug: "update-pipeline-reconcile",
    disposition: "superseded",
    why: "it is the field dictionary for the Master agent and its verifiers, a stage no session here runs",
    replaced: [],
    by: [],
  },
  {
    slug: "memory-and-knowledge",
    disposition: "partly",
    why: "the three tiers are the tracker's and stand; the verbs its recall discipline names are not wrapped here",
    replaced: [
      {
        says: "recall, write and confirm through `forge_memory.search`, `forge_memory.write` and"
          + " `forge_memory.feedback`",
        instead: "this CLI has no memory verb: those three are reachable only through `forge call`, and"
          + " what one run owes the next is on the issue's record rather than in memory",
      },
    ],
    by: ["forge call", "forge resume"],
  },
  {
    slug: "issue-dependencies",
    disposition: "partly",
    why: "the relation kinds and the merged_at signal are the tracker's and stand; the runner's half"
      + " is what it says about filing — a note at `draft` rather than `open`, and an edge set in a"
      + " second call as a race",
    replaced: [
      {
        says: "a note is created at `draft` and never at `open`, because `open` auto-triages and"
          + " spawns a pipeline run, burning a runner slot",
        instead: "`draft` is the reporter's status before `open` and `advance` never enters it;"
          + " nothing here dispatches, so `open` costs no slot, and what would have been that note"
          + " is a finding on an issue already open through `forge new --into`",
      },
      {
        says: "filing the issue and setting its blocks edge in a second call is a red flag, because"
          + " it can dispatch in the gap between the two",
        instead: "nothing here dispatches, so the gap holds nothing back; `--with` on the filing"
          + " writes a `relates` edge and never a `blocks` one, and a `blocks` edge is set by a write"
          + " not every credential carries, which `forge doctor` reports",
      },
    ],
    by: ["forge new"],
  },
];

/* The tracker's list as it stood when each row above was written against the body it serves. It is
   a record for comparing, never a list this CLI answers a guide from: `forge doctor` reads the live
   list and reports where the two have diverged, and the test refuses a table row this record lacks,
   so a guide the tracker retires takes its row out in the same change that notices. */
export const REVIEWED_AT = "2026-09-04";
export const REVIEWED = [
  "agent-setup",
  "attachments-and-uploads",
  "conformance-and-verify",
  "deploy-safety",
  "integration-epodsystem",
  "issue-dependencies",
  "memory-and-knowledge",
  "pipeline-and-issue-lifecycle",
  "project-settings-and-test-credentials",
  "update-pipeline-reconcile",
  "what-is-an-issue",
  "writing-an-issue",
];

const rowFor = (table, slug) => table.find((row) => row.slug === slug) ?? null;

export const dispositionOf = (slug, table = GUIDE_TABLE) => rowFor(table, slug);

/** `superseded` exactly, which is not what the verb withholds — see the note above the table. */
export const supersededSlugs = (table = GUIDE_TABLE) =>
  new Set(table.filter((row) => row.disposition === "superseded").map((row) => row.slug));

/** Every slug this plugin holds a disposition about, and so the set the verb refuses to serve. */
export const heldSlugs = (table = GUIDE_TABLE) => new Set(table.map((row) => row.slug));

/** The slugs the verb stands behind, in the order the tracker gave them. */
export const visibleGuides = (slugs, table = GUIDE_TABLE) => {
  const held = heldSlugs(table);
  return slugs.filter((slug) => !held.has(slug));
};

const routes = (row) => {
  const reads = row.by.filter((ref) => !ref.startsWith("forge "));
  const verbs = row.by.filter((ref) => ref.startsWith("forge "));
  const parts = [];
  if (reads.length) parts.push(`read ${reads.join(" and ")} in the forge-plugin checkout`);
  if (verbs.length) parts.push(`run ${verbs.map((ref) => `\`${ref}\``).join(" and ")}`);
  return parts.length ? parts.join(", and ") : null;
};

/** The first line `--tracker` prints, and the rules under it, so a reader comparing the two can. */
export const trackerHeader = (row) => {
  if (!row) return ["This is the tracker's own guide, and this plugin holds no disposition about it."];
  const where = routes(row);
  const opening = row.replaced.length
    ? `This is the tracker's own guide. The contract replaces ${row.replaced.length} of its rules`
      + `${where ? `, and instead ${where}` : ""}:`
    : `This is the tracker's own guide, and the contract replaces no rule of it: ${row.why}.`;
  return [opening, ...row.replaced.map(({ says, instead }) => `  - it says ${says}\n    instead ${instead}`)];
};

/* Pure over its inputs, so a case can hand it a table that fails each assertion: a closed-over
   table is a checker nobody can watch fire. An absent resolver leaves every reference unresolved
   rather than unchecked, because a check that passes on nothing looks exactly like a clean tree.
   A path is resolved inside the installed copy and never inside the checkout: a route naming a
   file only this tree carries is where every row here pointed before ISS-78. */
export function reviewGuideTable({
  table = GUIDE_TABLE,
  served = [],
  recorded = REVIEWED,
  listed = [],
  verbs = new Set(),
  resolves = () => false,
}) {
  const serving = new Set(served);
  const known = new Set(recorded);
  const held = heldSlugs(table);
  const unresolved = [];
  for (const row of table) {
    for (const ref of row.by) {
      const verb = ref.startsWith("forge ") ? ref.split(" ")[1] : null;
      const ok = verb ? verbs.has(verb) : resolves(ref);
      if (!ok) unresolved.push({ slug: row.slug, ref });
    }
  }
  return {
    retired: table.filter((row) => !serving.has(row.slug)).map((row) => row.slug),
    unreviewed: served.filter((slug) => !known.has(slug)),
    leaked: listed.filter((slug) => held.has(slug)),
    unresolved,
  };
}
