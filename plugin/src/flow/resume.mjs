/* One command that re-mints an issue's context. ISS-26's shell died mid-review and its successor
   read the run's state out of a file written outside the repository, because nothing typed could
   hold it. This writes nothing, takes no lease, and reads only the record (ISS-44). */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { flags } from "../resolve/flags.mjs";
import { fail } from "../resolve/settings.mjs";
import { usageOf } from "../resolve/visibility.mjs";
import { COMMENT_PAGE, Refused, commentPage, issueOf } from "./record.mjs";
import { viewFrom } from "./earned.mjs";
import { shortfall } from "./advance.mjs";
import { worklogLines } from "./worklog.mjs";
import { briefOf } from "./brief.mjs";

export const USAGE = [
  usageOf("resume"),
  "The whole context of one issue on one screen, re-minted from the record and the worklog beside",
  "its lease: the status and the phase it owes, the plan, every criterion with its verdict mark, the",
  "last confirmation, decision and correction, the worklog, the parks and blockers, the command the",
  "next status is owed, and where the method for that phase is written.",
  "",
  "  --json    the same assembled object, for a tool rather than a reader",
  "",
  "It writes nothing and needs no lease, so anyone may read any issue. It lists the issue's comments,",
  "which is a read of them: a write refused for want of one is unblocked by having run this.",
  "",
  "A fact a successor needed and did not find here belongs on the record or in the worklog, never in",
  "this verb: `forge claim <ref> --pushed --review --open \"<line>\"` and `--next` are where it goes.",
].join("\n");

/* Resolved from this module rather than named: `skills/` sits beside `src/` in the installed plugin
   and under `plugin/` in the checkout, so one relative URL is right in both and a literal is not. */
const methodPath = (reference) => {
  if (!reference) return null;
  const path = fileURLToPath(new URL(`../../${reference}`, import.meta.url));
  return existsSync(path) ? path : reference;
};

const PLAN_LINES = 12;

/* Bounded, because a brief is one screen and a plan is a document: the pointer is the whole of it,
   and a resuming run that needs more than the shape asks for it by name. */
const planLines = (brief, ref) => {
  const lines = (brief.plan ?? "").split("\n").filter((one) => one.trim());
  if (lines.length <= PLAN_LINES) return lines;
  return [...lines.slice(0, PLAN_LINES), `… ${lines.length - PLAN_LINES} more: forge issue ${ref} --fields plan`];
};

const block = (heading, lines) => {
  if (!lines.length) return;
  console.log(`\n${heading}`);
  for (const line of lines) console.log(`  ${line}`);
};

const held = (brief) => {
  const one = brief.lease;
  if (!one) return [];
  return [`${one.state}: session ${one.holder} (${one.agent}, pid ${one.pid}), renewed `
    + `${one.renewedAt.slice(0, 16)} for ${one.minutes} minute(s), ${one.claims} claim(s) on the record`];
};

/* The kind as the tracker gave it: only a `blocks` edge gates dispatch, and the shortfall below
   reads the whole list, so a reader has to be able to see which of the two an edge is. */
const edgeSaid = (one) => {
  if (one.kind !== "blocks") return `a ${one.kind} edge does not gate dispatch`;
  return one.gates ? "gating this issue now" : "satisfied";
};

const parks = (brief) => [
  ...(brief.park ? [`parked: ${brief.park.said}  (${brief.park.at})`] : []),
  ...brief.blockers.map((one) => `${one.kind} ${one.ref}, which is ${one.status} — ${edgeSaid(one)}`),
];

/* The one owed list, printed by the same function `advance --owed` prints it with: a second copy
   would drift, and this is the line a resuming run acts on. */
const owed = (brief, view, ref) => {
  console.log("");
  if (brief.owed.refused) console.log(brief.owed.refused);
  else if (brief.owed.missing.length) shortfall(ref, view, brief.owed.next, brief.owed.missing);
  else if (brief.owed.next) {
    console.log(`${ref} is ${brief.status}; ${brief.owed.next} is next and the record earns it.`);
    console.log(`  forge advance ${ref}${brief.owed.resumed ? "   (it resumes where its park left it)" : ""}`);
  } else console.log(`${ref} is ${brief.status}; nothing advances from it.`);
};

const print = (brief, view, ref) => {
  console.log(`${ref}  ${brief.status}${brief.phase ? `  —  phase owed: ${brief.phase}` : ""}`);
  block("Lease", held(brief));
  block("Plan", planLines(brief, ref));
  block("Criteria", brief.criteria.map((one) => `${one.mark.padEnd(10)} ${one.number}. ${one.text}`));
  block("Record", Object.entries(brief.latest).map(([kind, one]) => `${kind.padEnd(13)} ${one.said}  (${one.at})`));
  block("Worklog", worklogLines(brief.worklog, brief.next));
  block("Parks and blockers", parks(brief));
  owed(brief, view, ref);
  const method = methodPath(brief.reference);
  if (method) console.log(`\nThe method for this phase: ${method}`);
  console.log(`\nRead: ${brief.comments.length} comment(s) on this issue`
    + `${brief.comments.length ? `, latest ${brief.comments.at(-1).at}` : ""}.`);
  if (!brief.whole) console.log(`More than ${COMMENT_PAGE} comments match and the list stops there: this brief read the first ${COMMENT_PAGE}.`);
};

const run = async (argv) => {
  if (!argv.length || argv[0] === "-h" || argv[0] === "--help") return console.log(USAGE);
  const [ref, ...rest] = argv;
  if (ref.startsWith("--")) fail(`resume takes the issue first. ${usageOf("resume")}`);
  const given = flags(rest, "resume", ["--json"]);
  for (const one of Object.keys(given)) if (one !== "json") fail(`resume takes no --${one}. Flags: --json`);
  const { documentId, body } = await issueOf(ref);
  const { comments, hasMore } = await commentPage(documentId);
  const view = viewFrom(documentId, body, comments, !hasMore);
  const brief = briefOf(view, ref);
  return given.json ? console.log(JSON.stringify(brief, null, 2)) : print(brief, view, ref);
};

export const resume = async (argv) => {
  try {
    await run(argv);
  } catch (error) {
    if (error instanceof Refused) fail(error.message);
    throw error;
  }
};
resume.answersHelp = true;
