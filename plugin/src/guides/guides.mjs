/* This plugin's disposition of the tracker's own guides: a page is served unless a rule of it is one
   this CLI's own mechanics refuse, and then the row names that rule and what holds instead. The
   disposition is code and not configuration because it is this plugin's reading of the tracker.
   docs/cli/the-guides.md carries what a stale rule costs. */

import { once } from "../resolve/config.mjs";
import { skillWithheld } from "../resolve/visibility.mjs";
import { SLUG as CONTRACT_SLUG, contractAnswer, listingRow } from "./contract.mjs";
import { skillGuideAnswer, skillGuideRows } from "./skill-guides.mjs";

/* The guides this copy answers off its own disk, listed rather than reached by the verb comparing a
   slug against one constant of its own; a slug absent from it is the tracker's, answered `null`.
   Built on the first call that asks: the rows are read off `plugin/guides/`, 51 filesystem calls every verb paid at import while two of them read the answer (ISS-762). */
const LOCAL = once(() => [
  { slug: CONTRACT_SLUG, row: listingRow(), answer: contractAnswer },
  ...skillGuideRows().map(({ slug, row }) => ({ slug, row, answer: skillGuideAnswer(slug) })),
]);
const offered = () => LOCAL().filter((one) => !skillWithheld(one.slug));
export const localSlugs = () => offered().map((one) => one.slug);
export const localListing = () => offered().map(({ slug, row }) => ({ slug, row }));
export const localGuide = (slug) => LOCAL().find((one) => one.slug === slug)?.answer ?? null;
export const CORE_METHODS = ["issue-flow", "dispatch", "qa"];
export const coreFirstFor = (slug) => CORE_METHODS.includes(slug) && localGuide(slug) !== null;

/* A row is the read, and the disposition decides whether the page is served: neither a page the
   contract replaced nor a page part of which is the runner's is one an agent can follow whole, and
   naming a stale guide is how an agent comes to weigh two sources. A page the read cleared is served
   under a row saying so — `stands`, which withholds nothing — because a read that found nothing to
   replace and a read nobody made must not leave the table in the same state, and the clause behind
   the verdict has nowhere else to live. Which slug has been read is `REVIEWED` and never this table,
   and a page on that list may carry no row.

   `supersededSlugs`, which `forge doctor` alone calls, keeps meaning `superseded` exactly, because
   the overlap measure asks whether a project's own file restates a guide's authority — a different
   question from whether this verb serves the page. What `--tracker` prints is decided by the rules
   the row enumerates and by whether the row withholds, never by the word alone. */
export const GUIDE_TABLE = [
  {
    slug: "pipeline-and-issue-lifecycle",
    disposition: "stands",
    why: "its statuses, guards and parks are the ones `forge advance` moves through, and a failed"
      + " check going to `reopen` is what `forge advance --reopen` sends",
    replaced: [],
    by: [],
  },
  {
    slug: "writing-an-issue",
    disposition: "superseded",
    why: "it prescribes a body shape the filing lint refuses",
    replaced: [
      {
        says: "six blocks chosen from three shapes: an opening blockquote, a who-it-hurts table, one"
          + " diagram, what-to-do, decisions, evidence",
        instead: "the sections `forge new -h` names for the filing's category, matched by heading,"
          + " which is what `forge new` reads a body against and refuses a filing without",
      },
    ],
    by: ["forge new", "forge hooks --how issue-shape"],
  },
  {
    slug: "what-is-an-issue",
    disposition: "stands",
    why: "the four gates, the two lanes, residuals given an owner and non-work leaving by `dropped`"
      + " are how this CLI files and drops",
    replaced: [],
    by: [],
  },
  {
    slug: "agent-setup",
    disposition: "stands",
    why: "recall first, `draft` against `open` and the routes for each kind of write hold for a run"
      + " under this plugin too",
    replaced: [],
    by: [],
  },
  {
    slug: "memory-and-knowledge",
    disposition: "stands",
    why: "memory, knowledge and the verify-at-recall loop are named by their REST routes, which a run"
      + " reaches as it reaches any other",
    replaced: [],
    by: [],
  },
  {
    slug: "issue-dependencies",
    disposition: "stands",
    why: "the relation kinds, what releases a `blocks` edge and the create-then-block race hold,"
      + " a master dispatching from `open`",
    replaced: [],
    by: [],
  },
  {
    slug: "answering-as-the-assistant",
    disposition: "stands",
    why: "investigating before answering, owning a request and routing a report or a wish to Feedback"
      + " are this flow's too, and none of its rules is one this CLI refuses",
    replaced: [],
    by: [],
  },
  {
    slug: "records-and-comments",
    disposition: "partly",
    why: "an attachment for a log, the knowledge store for the project's prose and a transition that"
      + " writes rather than narrates are the tracker's own and stand; what it rules about a run's own"
      + " records is written against a store this flow does not write to",
    warns: {
      opens: "a `forge-record` fence is not comment content",
      closes: "The store each kind belongs in: guide `records-and-comments`",
    },
    replaced: [
      {
        says: "a `forge-record` fence in a comment body means a record was serialised instead of stored",
        instead: "that fence is the one shape this CLI owns for a typed payload, and the only thing"
          + " `forge advance` reads a status off",
      },
      {
        says: "a run's own record — a review, a decision, a baseline, a correction, a finding — goes"
          + " to the issue's events route as a typed record event",
        instead: "each of those is a kind `forge record` writes whole in one typed comment, and a"
          + " record sent to another store earns no status here",
      },
    ],
    by: ["forge record", "forge advance"],
  },
  {
    slug: "module-taxonomy-migration",
    disposition: "partly",
    why: "the dry run, the two idempotency keys, creating the modules with a plain label promoted"
      + " rather than duplicated, and leaving a conflict to a person are the tracker's and stand; its"
      + " Pass 2 attributes each issue by a write that takes no lease, across every tagged issue of a"
      + " project, so a run holding one of them loses its label change with nothing refused",
    replaced: [
      {
        says: "Pass 2 attributes an issue by sending `PATCH /api/issues/:id` its whole `labels` set,"
          + " a write that takes no lease",
        instead: "`forge issue <ref> --set module=<name> --why <w>` sends that set under this run's own"
          + " lease, so it is refused while another run's live lease holds the issue, and it keeps every"
          + " other label the issue carries",
      },
    ],
    by: ["forge issue"],
  },
];

/* The tracker's list as it stood when each row above was written against the body it serves. It is
   a record for comparing, never a list this CLI answers a guide from: `forge doctor` reads the live
   list and reports where the two have diverged, and the test refuses a table row this record lacks,
   so a guide the tracker retires takes its row out in the same change that notices. */
export const REVIEWED_AT = "2026-11-07";
export const REVIEWED = [
  "agent-setup",
  "answering-as-the-assistant",
  "attachments-and-uploads",
  "conformance-and-verify",
  "deploy-safety",
  "dispatch",
  "issue-dependencies",
  "issue-flow",
  "memory-and-knowledge",
  "module-taxonomy-migration",
  "pipeline-and-issue-lifecycle",
  "project-settings-and-test-credentials",
  "qa",
  "records-and-comments",
  "what-is-an-issue",
  "writing-an-issue",
];

const rowFor = (table, slug) => table.find((row) => row.slug === slug) ?? null;

/* A splice inside an intact frame is the one case here that does not fail safe: the line still
   matches and the spliced statement goes down with it. Saying otherwise would be false — a reworded
   frame matches nothing and the warning simply comes back. It is given up for two reasons. Each
   subject the tracker declines arrives as its own entry in the answer, so a splice would be the
   tracker abandoning its own composition; and naming the sentences instead leaves every kind of
   record nobody has met warning on every write, which is the defect this answers (G-13). */
const shaped = (text, { opens, closes }) => text.startsWith(opens) && text.endsWith(closes);

/** Which page of this table answers one line of a warning the tracker hung on a write, and `null`
 *  where none does. The line has to open and close at that page's frame, and what a caller might
 *  have had to act on is what arrives outside it: a statement before the opener or after the
 *  citation leaves the line unrecognised and it is said whole, the answered part of it included.
 *  What it cannot separate is a statement the tracker splices *between* those two clauses. */
export const warningAnswered = (said, table = GUIDE_TABLE) => {
  const text = String(said ?? "").trim();
  return table.find((one) => one.warns && shaped(text, one.warns))?.slug ?? null;
};

export const dispositionOf = (slug, table = GUIDE_TABLE) => rowFor(table, slug);

/** `superseded` exactly, which is not what the verb withholds — see the note above the table. */
export const supersededSlugs = (table = GUIDE_TABLE) =>
  new Set(table.filter((row) => row.disposition === "superseded").map((row) => row.slug));

/** Whether a row takes the page out of the verb's hands, which every disposition but `stands` does. */
export const withholds = (row) => Boolean(row) && row.disposition !== "stands";

/** The slugs the verb refuses to serve, which is the rows that withhold and not every row. */
export const heldSlugs = (table = GUIDE_TABLE) =>
  new Set(table.filter((row) => withholds(row)).map((row) => row.slug));

/** The slugs the verb stands behind, in the order the tracker gave them, a withheld skill's name among what they are not: the verb refuses that word whatever would have answered it, and a listing offering what the verb refuses is the contradiction one surface exists to prevent. */
export const visibleGuides = (slugs, table = GUIDE_TABLE) => {
  const held = heldSlugs(table);
  return slugs.filter((slug) => !held.has(slug) && !skillWithheld(slug));
};

const routes = (row) => {
  const reads = row.by.filter((ref) => !ref.startsWith("forge "));
  const verbs = row.by.filter((ref) => ref.startsWith("forge "));
  const parts = [];
  if (reads.length) parts.push(`read ${reads.join(" and ")} in the forge-plugin checkout`);
  if (verbs.length) parts.push(`run ${verbs.map((ref) => `\`${ref}\``).join(" and ")}`);
  return parts.length ? parts.join(", and ") : null;
};

/* Said under the rules it asserts and nowhere else: the transport withholds that warning on every
   write, so the one page that says this plugin replaced those rules is the one page that owes the
   reader what it therefore stops saying. */
const WITHHELD_WARNING = "  The tracker attaches the rules above to a write that carries a record,"
  + " as one warning. This copy withholds it there rather than answering it again on every record.";

/** The first line `--tracker` prints, and the rules under it, so a reader comparing the two can. */
export const trackerHeader = (row) => {
  if (!row) return ["This is the tracker's own guide, and this plugin holds no disposition about it."];
  const where = routes(row);
  const opening = !withholds(row)
    ? `This is the tracker's own guide and this plugin stands behind it: ${row.why}.`
    : row.replaced.length
      ? `This is the tracker's own guide. The contract replaces ${row.replaced.length} of its rules`
        + `${where ? `, and instead ${where}` : ""}:`
      : `This is the tracker's own guide, and no rule of it is the contract's to replace: ${row.why}.`;
  return [
    opening,
    ...row.replaced.map(({ says, instead }) => `  - it says ${says}\n    instead ${instead}`),
    ...(row.warns ? [WITHHELD_WARNING] : []),
  ];
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
