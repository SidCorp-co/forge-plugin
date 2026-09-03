/* This plugin's disposition of the tracker's own guides. The tracker serves the lifecycle rules of
   its pipeline runner, and no session under this plugin is that runner: five of the twelve state a
   rule the contract has replaced, so a passthrough hands every agent two contracts on its first
   read. The disposition is code and not configuration because it is this plugin's reading of the
   tracker, and a project cannot rightly turn a contradiction back on. docs/FORGE-CLI.md carries
   what the stale rules cost; `forge guide contract` prints what holds instead. */

/* `superseded` is withheld from the list and answers with its replacement; `partly` prints the
   tracker's body under a first line naming the half that does not apply. A slug in no row is the
   tracker's and passes through untouched. */
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
    slug: "issue-dependencies-and-decompose",
    disposition: "partly",
    why: "the blocks edge and the merged_at signal are the tracker's and stand; the decompose half is the runner's",
    replaced: [
      {
        says: "decompose children, their parent's approval and the kickoff the system owns",
        instead: "a split here is a filing: siblings at `open`, each naming the others in the same"
          + " write, and their own edges decide the order",
      },
    ],
    by: ["forge new", "forge dep"],
  },
];

/* The tracker's list as it stood when each row above was written against the body it serves. It is
   a record for comparing, never a list this CLI answers a guide from: `forge doctor` reads the live
   list and reports where the two have diverged, and the test refuses a table row this record lacks,
   so a guide the tracker retires takes its row out in the same change that notices. */
export const REVIEWED_AT = "2026-09-03";
export const REVIEWED = [
  "agent-setup",
  "attachments-and-uploads",
  "conformance-and-verify",
  "deploy-safety",
  "integration-epodsystem",
  "issue-dependencies-and-decompose",
  "memory-and-knowledge",
  "pipeline-and-issue-lifecycle",
  "project-settings-and-test-credentials",
  "update-pipeline-reconcile",
  "what-is-an-issue",
  "writing-an-issue",
];

const rowFor = (table, slug) => table.find((row) => row.slug === slug) ?? null;

export const dispositionOf = (slug, table = GUIDE_TABLE) => rowFor(table, slug);

export const supersededSlugs = (table = GUIDE_TABLE) =>
  new Set(table.filter((row) => row.disposition === "superseded").map((row) => row.slug));

/** The slugs the verb stands behind, in the order the tracker gave them. */
export const visibleGuides = (slugs, table = GUIDE_TABLE) => {
  const hidden = supersededSlugs(table);
  return slugs.filter((slug) => !hidden.has(slug));
};

const routes = (row) => {
  const reads = row.by.filter((ref) => !ref.startsWith("forge "));
  const verbs = row.by.filter((ref) => ref.startsWith("forge "));
  const parts = [];
  if (reads.length) parts.push(`read ${reads.join(" and ")} in the forge-plugin checkout`);
  if (verbs.length) parts.push(`run ${verbs.map((ref) => `\`${ref}\``).join(" and ")}`);
  return parts.length ? parts.join(", and ") : null;
};

export const replacementLine = (row) => {
  const where = routes(row);
  return `${row.slug}: superseded — ${row.why}.`
    + `${where ? ` Instead ${where}.` : " Nothing here replaces it: it is not this plugin's."}`
    + ` \`forge guide ${row.slug} --tracker\` prints the tracker's text and the rules it replaces.`;
};

const rule = ({ says, instead }) => `it says ${says}; instead ${instead}`;

export const caveatLine = (row) =>
  `${row.slug}: kept as the tracker's, except — ${row.replaced.map(rule).join(". Also ")}.`
  + ` For that half ${routes(row)}.`;

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

export const withheldLine = (count) =>
  `\n${count} guide(s) the contract supersedes are not listed. \`forge guide <slug>\` says what`
  + " replaced each; add --tracker for the tracker's own text.";

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
  const hidden = supersededSlugs(table);
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
    leaked: listed.filter((slug) => hidden.has(slug)),
    unresolved,
  };
}
