/* One verb between an agent and a status change: the entry criteria of the next status, checked
   against the issue's record and nothing else. The rule a status is earned by, stage by stage:
   `forge guide contract <status>`. */
import { flags, pullRepeated } from "../resolve/flags.mjs";
import { fail } from "../resolve/settings.mjs";
import { usageOf } from "../resolve/visibility.mjs";
import { COMMENT_PAGE, commentPage } from "../tracker/comments.mjs";
import { write } from "../tracker/rpc.mjs";
import { FIX_OWES, isFix } from "../tracker/issue-shape.mjs";
import { attachmentNames, evidenceProblem } from "../tracker/evidence.mjs";
import { partsOf, readContract, stageLine } from "../tracker/contract.mjs";
import { PARKS, SHOWS_EVIDENCE, planFlags, unwrap } from "./machine.mjs";
import { releasePolicy } from "../tracker/project-config.mjs";
import { Refused, issueOf, post, refuse, render } from "./record.mjs";
import { PARK_STATUS, SIDE, atLeast, payloadOwed, personLooks, transitionCall, viewFrom } from "./earned.mjs";
import { lookAhead, targetOf } from "./route.mjs";
import { FIELD, leaseOf, nextLine, renew } from "./lease.mjs";

/* A needs_info park owes the readings only the question shape carries. */
const ASKS_A_QUESTION = "question";
const ASKED_AT = ["open", "confirmed"];

export const USAGE = [
  usageOf("advance"),
  "The next status, its entry criteria checked against the issue's record alone, and either the",
  "transition or every missing item beside the one command that supplies it. Nothing is read from",
  "the repository: what git knew was written onto the issue at the step that knew it.",
  "",
  "  --owed                  what the next status is owed, moving nothing, and the line last left",
  "  --next <line>           the step the status it enters starts on, for whoever comes next",
  "  --to <status>           refused unless that status is the next one; a jump is not advancing",
  "  --park <kind> --why W [--evidence E]...  a park record, then the side status the kind implies",
  "  --drop --why W          park as dropped; refused once the merged mark is set",
  "",
  "Earned by, from the contract's flow table:",
  "  confirmed     a confirmation: where you looked, what it is, and the finding",
  "  clarified     a decision record, or an explicit none found",
  "  approved      the plan field with its screen and schema lines, and numbered criteria",
  "  in_progress   every blocker at least developed, and a baseline",
  "  developed     an approving review of the commit the merged mark names, and the mark",
  "  tested        a pass or a reasoned skip on every criterion, at the merged commit",
  "  released      a verification, and a release note or a withholding",
  "  closed        released",
  "  dropped       a confirmation whose finding is a disposition, or --drop --why",
  "",
  "A reopen is a person's word and the tracker's own status. From it the verb reads the person's",
  "finding and the agent's triage of it, and routes: the criterion was the wrong test, back to",
  "developed; it was not met, back to in_progress; the expectation is not in the specification, a",
  "park behind the issue that owes it. Never above the status the reopen landed on.",
  "",
  "A transition clears the line the status it left had set, because that step is over. --owed",
  "prints the line when one is set and moves nothing.",
  "",
  `A park kind: ${PARKS.join("|")}.`,
  "A parked issue resumes where its park record says it left, once a reply or its blocker clears it.",
].join("\n");

/* The project's release policy is a call, so it is made only where its answer is read: a plan
   declaring neither line owes no person whatever the project says, and pays no round to hear it. */
export const policyFor = async (plan) => (personLooks(planFlags(unwrap(plan))) ? releasePolicy() : null);

const viewOf = async (reference) => {
  const { documentId, body } = await issueOf(reference);
  const { comments, hasMore } = await commentPage(documentId);
  return viewFrom(documentId, body, comments, !hasMore, await policyFor(body.plan));
};

/* The renew before it is where the line is cleared: the transition is refused before this runs
   unless the record earns it, and a second lease write would cost three more calls. */
export const transitionTo = async (view, status, ref, note = "", next = null) => {
  await renew(view.documentId, ref, next);
  const answer = await write("forge_issues", { action: "transition", documentId: view.documentId, data: { status } });
  const held = answer?.status ?? answer?.issue?.status;
  if (held && held !== status) refuse(`The transition answered with status ${held}, not ${status}. Nothing to rely on.`);
  console.log(`${ref}  ${view.issue.status} -> ${status}${note}`);
};

/* The two writes of one park, in the order a reader of the record needs them: the typed reason
   first, then the status it sends the issue to. The crashed park a reclaim writes lands here too. */
export const parkAs = async (view, ref, kind, why, evidence = [], left = null) => {
  await post(view.documentId, render("park", { kind, why, evidence }, left ?? view.issue.status), ref);
  await transitionTo(view, PARK_STATUS[kind], ref);
};

const park = async (view, ref, kind, why, evidence) => {
  const to = PARK_STATUS[kind];
  if (!to) refuse(`--park takes one of ${Object.keys(PARK_STATUS).join(", ")}, not \`${kind}\`.`);
  if (to === "needs_info" && !ASKED_AT.includes(view.issue.status)) {
    refuse(`a question goes to the reporter, and ${ref} is ${view.issue.status}: the readings it would `
      + `offer are the triage ones. Ask from ${ASKED_AT.join(" or ")}, or park for a reviewer instead.`);
  }
  if (to === "dropped" && atLeast(view.issue.status, "developed")) {
    refuse(`${ref} is ${view.issue.status}, and dropped means no code landed. Revert first, then drop `
      + `from approved:\n  ${transitionCall(view.documentId, "approved")}`);
  }
  if (to === "dropped" && view.issue.mergedAt) {
    refuse(`${ref} was marked merged at ${view.issue.mergedAt}, and dropped means no code landed. `
      + `Revert the commit, clear the mark, then drop from approved:\n`
      + `  forge call forge_issues '{"action":"unmark","data":{"issueId":"${view.documentId}","note":"<why>"}}'`);
  }
  if (kind === ASKS_A_QUESTION) {
    const owed = payloadOwed(
      view,
      "question",
      "a needs_info park is a question: two or more readings, each with the outcome it produces",
      `forge record question ${ref} --reading "<reading -> outcome>" --reading "<reading -> outcome>"`,
    );
    if (owed.length) refuse(`${owed[0].what}. Write it first:\n  ${owed[0].command}`);
  }
  if (SHOWS_EVIDENCE.includes(kind) && !evidence.length) {
    refuse(`a ${kind} park names what the reviewer is to look at:\n`
      + `  forge advance ${ref} --park ${kind} --why "<why>" --evidence <attachment|url|sha>`);
  }
  const bad = evidence.length ? evidenceProblem(evidence, attachmentNames(view.issue, view.comments)) : null;
  if (bad) refuse(bad);
  await parkAs(view, ref, kind, why, evidence);
};

/* A named target is checked rather than obeyed: the only legal one is where the route says the
   issue goes, which for a reopen is wherever its triage decided. */
export const checkTarget = (to, next, view, ref) => {
  if (!to || to === next) return;
  if (SIDE.includes(to)) refuse(`${to} is a side status, which a park reaches: forge advance ${ref} --park <kind> --why "<why>".`);
  refuse(`${ref} is ${view.issue.status} and ${next} is next, not ${to}. A jump past a status is refused.`);
};

/* Printed under the shortfall and under "the record earns it" alike, because the point of it is
   that a run reads it before the status it belongs to is the one being asked for. */
const sayAhead = (view, ref, next) => {
  if (isFix(view.issue.description)) console.log(`\n${FIX_OWES}`);
  const said = lookAhead(view, ref);
  if (said) console.log(`\n${said}`);
  console.log(`\n${stageLine(next, partsOf(readContract()))}`);
};

export const shortfall = (ref, view, next, missing) => {
  console.log(`${ref} is ${view.issue.status}; ${next} is next and the record does not earn it.`);
  for (const one of missing) console.log(`\n  ${one.what}\n    ${one.command}`);
};

const KNOWN = ["owed", "park", "drop", "why", "to", "next"];

export const nextHeld = (view) => leaseOf(view.issue?.[FIELD])?.next ?? null;

const readFlags = (rest) => {
  const pulled = pullRepeated(rest, "--evidence", "advance");
  const given = flags(pulled.rest, "advance", ["--owed", "--drop"]);
  for (const one of Object.keys(given)) {
    if (!KNOWN.includes(one)) refuse(`advance takes no --${one}. Flags: ${KNOWN.map((two) => `--${two}`).join(" ")} --evidence`);
  }
  const evidence = pulled.values;
  const writes = Boolean(given.park) || Boolean(given.drop);
  if (given.park && given.drop) refuse("--park and --drop are two forms; a drop is the park kind `dropped`.");
  if (writes && given.owed) refuse("--owed moves nothing, and --park and --drop write a record. Ask for one.");
  if (writes && given.to) refuse("--to names the status to advance to; a park goes where its kind says.");
  if (writes && !given.why) refuse(`--${given.park ? "park" : "drop"} needs --why: a park is a message to a person.`);
  if (given.why && !writes) refuse("--why belongs to --park or --drop; nothing else here takes a reason.");
  if (evidence.length && !writes) refuse("--evidence belongs to the park record; a check reads the evidence already on the issue.");
  const asked = given.next !== undefined;
  if (asked && given.owed) refuse("--owed moves nothing and --next is a write. Ask for one.");
  if (asked && writes) refuse("a park says what it waits for in --why; the claim that resumes it sets --next.");
  return { ...given, evidence, next: nextLine(given.next) };
};

const run = async (argv) => {
  if (!argv.length || argv[0] === "-h" || argv[0] === "--help") return console.log(USAGE);
  const [ref, ...rest] = argv;
  if (ref.startsWith("--")) refuse(`advance takes the issue first. ${USAGE.split("\n")[0]}`);
  const given = readFlags(rest);
  const view = await viewOf(ref);
  const left = nextHeld(view);
  if (given.owed && left) console.log(`Next, as the last write left it: ${left}`);
  /* Judged on part of a record, an answer is a guess: the page is the whole read this tool has. */
  if (!view.whole) {
    refuse(`${ref} carries more than the ${COMMENT_PAGE} comments the tracker's list returns, and it offers no `
      + `cursor: neither what it owes nor what it earns can be read from a page. Read the thread, and `
      + `transition by hand if you decide to:\n  ${transitionCall(view.documentId, "<status>")}`);
  }
  if (given.park || given.drop) {
    return park(view, ref, given.park ?? "dropped", given.why, given.evidence);
  }
  const { next, missing, resumed, park: routed } = targetOf(view, ref);
  checkTarget(given.to, next, view, ref);
  if (missing.length) {
    shortfall(ref, view, next, missing);
    const owed = `${missing.length} item(s) owed before ${next}.`;
    /* Asked what is owed, the answer is the answer; asked to move, the same list is a refusal. */
    if (!given.owed) return fail(owed);
    console.log(`\n${owed}`);
    return sayAhead(view, ref, next);
  }
  if (given.owed) {
    console.log(`${ref} is ${view.issue.status}; ${next} is next and the record earns it. \`forge advance ${ref}\` moves it.`);
    return sayAhead(view, ref, next);
  }
  /* The triage that puts the expectation outside the specification writes its park here, because a
     park is a record and a status and the route decided both from the triage the record holds. */
  if (routed) return parkAs(view, ref, routed.kind, routed.why, [], routed.left);
  return transitionTo(view, next, ref, resumed ? "  (resumed where its park left it)" : "", given.next ?? null);
};

export const advance = async (argv) => {
  try {
    await run(argv);
  } catch (error) {
    if (error instanceof Refused) fail(error.message);
    throw error;
  }
};
advance.answersHelp = true;
