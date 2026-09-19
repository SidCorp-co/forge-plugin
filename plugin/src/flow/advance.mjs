/* The move and the check it runs: the entry criteria of the next status, checked against the issue's
   record and nothing else. Two callers — this verb, and a record write through `movedByRecord`.
   The rule a status is earned by, stage by stage: `forge guide contract <status>`. */
import { exclusive, firstLine, flags, pullRepeated, wantsHelp } from "../resolve/flags.mjs";
import { fail } from "../resolve/settings.mjs";
import { usageOf } from "../resolve/visibility.mjs";
import { commentPage, countedShort, creditAfter, cutIn } from "../tracker/comments.mjs";
import { declaredValue, statusKind, write } from "../tracker/rest.mjs";
import { lengthOf } from "../tracker/field-write.mjs";
import { UNREAD, afterRefused, correctionFor, whyChecked } from "./override.mjs";
import { attachmentNames, evidenceProblem } from "../tracker/evidence.mjs";
import { partsOf, readContract, stageLine } from "../guides/contract.mjs";
import { CLOSES_FROM, PARKS, SHOWS_EVIDENCE } from "./machine.mjs";
import { citedClauses } from "../spec/checked.mjs";
import { Refused, refuse } from "../refusal.mjs";
import { issueOf, post } from "./record/record.mjs";
import { render } from "./record/page.mjs";
import { ANSWERED_BY_COMMENT, ORDER, PARK_STATUS, SIDE, answersByComment, atLeast, fixReport, namedIn, payloadOwed, rungFieldsOf, sameLanding, setForm, viewFrom } from "./earned.mjs";
import { scopeFrom } from "./record/plan-scope.mjs";
import { rungOf } from "../ladder.mjs";
import { CITED, laneLines } from "../guides/phases.mjs";
import { undoForm } from "./record/merged.mjs";
import { REOPEN, baselineAhead, credentialAhead, deployFor, lookAhead, owedBlock, owedIn, owedSaid, policyFor, reopenProblem, targetOf } from "./route.mjs";
import { FIELD, anothersHold, leaseOf, nextLine, renew } from "./lease.mjs";

/* A needs_info park owes the readings only the question shape carries. */
const ASKS_A_QUESTION = "question";
const ASKED_AT = ["open", "confirmed"];

export const USAGE = [
  usageOf("advance"),
  "The next status, its entry criteria checked against the issue's record alone, and either the",
  "transition or every missing item beside the one command that supplies it. What git knew is never",
  "asked again: it was written onto the issue at the step that knew it. What the project is, is read",
  "where it is needed — the release policy, and whether it keeps a requirements tree the issue owes",
  "a clause of.",
  "",
  "  --owed                  what the next status is owed, moving nothing, and the line last left",
  "  --next <line>           the step the status it enters starts on, for whoever comes next",
  "  --to <status>           refused unless that status is the next one; a jump is not advancing",
  "  --park <kind> --why W [--needs N] [--evidence E]...  a park record, then the side status the",
  "                          kind implies",
  "  --drop --why W          park as dropped; refused once the merged mark is set",
  `  --reopen --why W        the tracker's \`${REOPEN}\`, where a finding blocks the change: a person's`,
  "                          word or this run's own. The finding and the triage under it are what",
  "                          route where the work goes back to, and no correction is written for it",
  "  --set <status> --why W [--needs N]  the status outright, no entry check read; the reply says",
  "                          so and a correction goes on the record naming the status and the reason",
  "",
  `Only a move to ${ANSWERED_BY_COMMENT} takes --needs, which is what would settle the question and what`,
  "the tracker mints the answer box from; --why is why the work stopped. Neither is ever written from",
  "the other. A question park given no --needs carries the readings its question record already holds.",
  "",
  `A park kind: ${PARKS.join("|")}.`,
  "What each status is earned by, rung by rung: `forge advance <ref> --owed` for this issue, and",
  "`forge guide contract <status>` for the rule.",
].join("\n");

/* A plain advance from the rung `closed` is entered from, whose whole entry criterion is that status, so the page is not worth the call. A park or a drop from it is another transition: its kind, its evidence and the question a needs_info park owes are all judged against the record, so those read the page. */
const readsTheRecord = (body, given) =>
  !given.set && (body.status !== CLOSES_FROM || Boolean(given.park) || Boolean(given.drop)
    || Boolean(given.reopen));

const viewOf = async (reference, given) => {
  const { documentId, body } = await issueOf(reference);
  const cited = () => citedClauses(body);
  if (!readsTheRecord(body, given)) return viewFrom(documentId, body, [], null, null, cited);
  const page = await commentPage(documentId);
  /* Only the rehearsal prints the line, so only the rehearsal reads it; and neither read feeds the other. */
  const [deploy, release] = await Promise.all([
    given.owed ? deployFor(body.plan, body.status) : null,
    policyFor(body.plan, body.status),
  ]);
  /* Off `cut`, which sizes the issue: a count nobody here can account for is said and sizes nothing. */
  return {
    ...viewFrom(documentId, body, page.comments, cutIn(page), release, cited, deploy),
    counted: countedShort(page),
  };
};

/* The renew before it is where the line is cleared: the transition is refused before this runs unless the record earns it, and a second lease write would cost three more calls. `said` is what a park adds to the payload; a plain advance sends the status alone and nothing else.
   `soft` is the caller with a record up already, which is one fact and not two: the renewal its own write made a call earlier is not made twice, and the tracker's refusal comes back to it rather than exiting the process, because a second renewal is a second place to exit and exiting there would leave that record claiming a move nothing attempted. */
export const transitionTo = async (view, status, ref, { note = "", next = null, said = null, soft = false, say = console.log, heard = null } = {}) => {
  if (!soft) await renew(view.documentId, ref, next);
  /* Asked softly whoever the caller is, so the refusal is worded here rather than printed bare by the transport: a refusal that makes a claim about this issue's status is read as true by a run that has nothing beside it to compare, and both statuses it could be compared against are values this call is already holding (ISS-1422). */
  const answer = await write("forge_issues",
    { action: "transition", documentId: view.documentId, data: { status, ...(said ?? {}) } }, undefined, true);
  /* Soft is for the caller that has already written something: it words its own refusal around the record it left behind, so nothing is framed for it here. */
  if (answer?.refused) {
    if (soft) return answer.refused;
    /* A dropped write is not a rejected one, and only the transport knows which it was: told the issue is still where it was, a run would act on a move that may have landed. */
    if (afterRefused(answer.refused).unknown) {
      refuse(`${ref} read ${view.issue.status} and was asked for ${status}, and the move neither `
        + `landed nor failed cleanly. What came back:\n${answer.refused}\nRead the status before `
        + `writing anything else:\n  forge issue ${ref} --fields status`);
    }
    refuse(`${ref} is ${view.issue.status} and the move to ${status} was refused, so nothing was `
      + `written. What refused it:\n${answer.refused}`);
  }
  /* The write landed, so what comes back is the tracker's answer and not a failure to detect: the
     branch above is what catches one that did not take. Outside the landing it still refuses. */
  const held = answer?.status ?? answer?.issue?.status;
  if (held && !sameLanding(held, status)) {
    refuse(`The transition answered with status ${held}, not ${status}. Nothing to rely on.`
      + (soft
        ? `\nThe record above it claims ${status} and this issue holds ${held}. Say on the record `
          + `that it did not move:\n  forge record correction ${ref} --moved "the record above `
          + `claims ${status}, which the move answered ${held}" --why <w>`
        : ""));
  }
  heard?.(answer);
  const landed = held ?? status;
  const spelt = landed === status ? "" : `  (asked for ${status}, which this tracker spells ${landed})`;
  scopeFrom(landed, ref, namedIn(view));
  say(`${ref}  ${view.issue.status} -> ${landed}${note}${spelt}`);
  return null;
};

/* Every park kind landing in `waiting` asks a person to decide, so the kind the tracker demands is
   derived; one that waited on a thing would need a row of its own. */
const WAITING = "waiting";
const waitsFor = (status) => (status === WAITING ? { waitingKind: "needs_decision" } : {});

/* The one field of this payload the tracker mints an answer box from, where `reason` is why the work stopped: neither is ever written from the other, and a text over the endpoint's cap is refused here rather than sent to take the status write down with it — docs/cli/advance-what-it-sends.md. */
const NEEDS_CAP = 2000;
const ASKS = "Which of these readings is the one to take?";

const needsProblem = (text) => {
  if (!text) return "is blank after trim, and a question with no text is an answer box asking nothing";
  const held = lengthOf(text);
  return held > NEEDS_CAP
    ? `is ${held} code points and the transition body takes ${NEEDS_CAP}, which refuses the whole call `
      + "and the status write with it"
    : null;
};

/* The readings are what `--park question` is already refused without, so the question that travels is built from them rather than asked for twice; the stem is a constant and never the park's own reason. */
const asksFor = (view, asked, ref) => {
  if (asked) return { needs: asked };
  const held = view.latest?.question?.record.fields.reading ?? [];
  if (!held.length) return {};
  const text = [ASKS, ...held.map((one) => `- ${one}`)].join("\n");
  const bad = needsProblem(text);
  if (bad) {
    refuse(`the readings on this issue's question record come to a text that ${bad}. Nothing was sent. `
      + `Say what would settle it in fewer words than the readings take:\n`
      + `  forge advance ${ref} --park ${ASKS_A_QUESTION} --why "<why>" --needs "<what would settle it>"`);
  }
  return { needs: text };
};

/* The two writes of one park: the typed `why` travels with the move, which the tracker refuses
   without one (ISS-157), and the status goes first so a refused move leaves no record to disagree
   with it — except where it lands where a comment is read as an answer, which is
   `answersByComment` and is docs/cli/advance-what-it-sends.md. What that order costs, said by the
   one route both writers of it spend: a move refused after the record went up leaves a page
   reading as a status the issue does not hold, and the transition's own refusal says nothing about
   the record above it. */
const movedAfterRecord = async (view, ref, status, move) => {
  /* The record's write renewed the lease, so the move does not renew it again — but a handoff between the two is still a handoff, and the move must not be the write that learns it. Asked rather than asserted, and asked softly, because a read that exits here reports a transport and never the record standing above it. */
  const held = await anothersHold(view.documentId, ref);
  if (held) {
    refuse(`the record for ${status} went up and the move was not attempted. ${held.said}\n`
      + (held.unknown
        ? `Whether ${ref} is still this run's could not be read, so nothing was sent to the status. `
          + `Read the lease and make the move, or say on the record that it did not happen:\n  ${setForm(ref, status)}\n`
        : `${ref} changed hands between the two writes, so no write of yours may set its status. `
          + `Take the issue back and move it, or say on the record that it did not happen:\n  forge claim ${ref} --take\n`)
      + `  forge record correction ${ref} --moved "the record above claims ${status}, which was not `
      + `attempted" --why <w>`);
  }
  const refused = await move(true);
  if (!refused) return;
  /* A dropped write is not a rejected one: the transport says so itself, and a message naming the old status either way would send a run to correct a move that may have landed. */
  if (afterRefused(refused).unknown) {
    refuse(`the record for ${status} went up and the move neither landed nor failed cleanly. ${refused}\n`
      + `Read ${ref}'s status before writing anything else — the record above claims ${status}, and `
      + `whether the issue holds it is what decides which of these two is owed:\n`
      + `  forge issue ${ref} --fields status\n  ${setForm(ref, status)}`);
  }
  refuse(`${ref} is still ${view.issue.status}: the record for ${status} went up and the move was `
    + `refused. ${refused}\nThe page above now reads as a status this issue does not hold. `
    + `Move it with the command that was refused, or say on the record that it did not move:\n`
    + `  ${setForm(ref, status)}\n  forge record correction ${ref} `
    + `--moved "the record above claims ${status}, which the move was refused" --why <w>`);
};

/* A move into a side status, with the announcement the tracker writes for it credited in the same breath, for the reason `markMerged` states. It asks softly because it has a record up already, which is the one fact `transitionTo` reads that flag for. */
const moveTo = async (view, ref, status, { note = "", said, credit, heard = null }, soft = false) => {
  const refused = await transitionTo(view, status, ref, { note, said, soft, heard });
  if (refused) return refused;
  await creditAfter(credit, [{ ref, documentId: view.documentId }]);
  return null;
};

export const parkAs = async (view, ref, kind, why, evidence = [], { left = null, asked = null } = {}) => {
  const status = PARK_STATUS[kind];
  /* Built before the record goes up: at this status the record is the first write, and a refusal after it leaves a comment claiming a move nothing attempted. */
  const said = { reason: why, ...waitsFor(status), ...(status === ANSWERED_BY_COMMENT ? asksFor(view, asked, ref) : {}) };
  const body = render("park", { kind, why, evidence }, left ?? view.issue.status);
  const move = (soft = false) =>
    moveTo(view, ref, status, { said, credit: "the park's transition" }, soft);
  if (answersByComment(status)) {
    await post(view.documentId, body, { ref });
    await movedAfterRecord(view, ref, status, move);
    return;
  }
  await move();
  try {
    await post(view.documentId, body, { ref, renewed: true });
  }
  catch (error) {
    /* A record written now would stamp the side status as the one it left. The body goes back on
       stdin: a quoted argument would end on the apostrophes and newlines it holds. */
    refuse(`${ref} moved to ${status} and its park record did not go up: ${error.message}\n`
      + `Nothing on the page now says where it left, and \`forge record park\` would stamp `
      + `${status} as that status. Put this body up as it stands:\n\n`
      + `forge comment ${view.documentId} - <<'FORGE_PARK_RECORD'\n${body}\nFORGE_PARK_RECORD`);
  }
};

const park = async (view, ref, kind, why, evidence, asked = null) => {
  const to = PARK_STATUS[kind];
  if (!to) refuse(`--park takes one of ${Object.keys(PARK_STATUS).join(", ")}, not \`${kind}\`.`);
  if (to === ANSWERED_BY_COMMENT && !ASKED_AT.includes(view.issue.status)) {
    refuse(`a question goes to the reporter, and ${ref} is ${view.issue.status}: the readings it would `
      + `offer are the triage ones. Ask from ${ASKED_AT.join(" or ")}, or park for a reviewer instead.`);
  }
  if (to === "dropped" && atLeast(view.issue.status, "developed")) {
    refuse(`${ref} is ${view.issue.status}, and dropped means no code landed. Revert first, then drop `
      + `from approved:\n  ${setForm(ref, "approved")}`);
  }
  if (to === "dropped" && view.issue.mergedAt) {
    refuse(`${ref} was marked merged at ${view.issue.mergedAt}, and dropped means no code landed. `
      + `Revert the commit, clear the mark, then drop from approved:\n  ${undoForm(ref)}`);
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
  await parkAs(view, ref, kind, why, evidence, { asked });
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
  const report = fixReport(view, ref);
  if (report) console.log(`\n${report}`);
  console.log("");
  for (const line of laneLines({ status: view.issue.status, fields: rungFieldsOf(view) })) console.log(line);
  const cheaper = baselineAhead(view, ref);
  if (cheaper) console.log(`\n${cheaper}`);
  const shortly = credentialAhead(view, ref);
  if (shortly) console.log(`\n${shortly}`);
  const said = lookAhead(view, ref);
  if (said) console.log(`\n${said}`);
  console.log(`\n${stageLine(next, partsOf(readContract()))}`);
};

/* Every entry criterion is a presence check, so a shortfall off a read that stopped short is only ever longer than the true one:
   judged rather than refused (ISS-131), and naming no end, the envelope never saying which rows the read missed (ISS-697).
   The two reads part on what a second record would do, so one sentence cannot advise both (ISS-841): a walk that ended short holds a prefix
   and a record written into it lands past the end that walk never reached, while rows the tracker called whole are the rows the next read hands back. Each is written whole rather than opening on a shared clause, they part immediately after the one they would share and a prefix ending in the words its continuation opens with is a repeat neither line shows on its own (ISS-1045). */
const cutSays = (said, ref) =>
  `${said} What the rows read earn, they earn, and anything they say is owed may be a record past `
  + "that prefix, so this shortfall is a ceiling and not a count. Once the thread, read where it is "
  + `whole, shows the record that earns the status, \`forge advance ${ref} --set <status> `
  + `--why "<why>"\` puts that status on with no entry check read and a correction saying so.`;
const countSays = (said) =>
  `${said} What the rows read earn, they earn, and anything they say is owed on rows the tracker `
  + "called whole, so write it again for this status: a record written now is in the rows the next "
  + "read hands back.";

export const shortfall = (ref, view, held) => {
  for (const line of owedBlock(view, ref, held)) console.log(line);
};

const pageFor = async (documentId, held) =>
  held ?? await commentPage(documentId).then((page) => ({ comments: page.comments, cut: cutIn(page) }));

/* A reading that may fail without the record losing anything, which is the whole of ISS-285. */
const owedAfter = async (documentId, issue, ref, page) => {
  try {
    const said = await owedSaid(documentId, issue, page.comments, ref, page.cut);
    if (said) console.error(said);
  } catch (error) {
    console.error(`what this write now owes could not be read: ${error.message}`);
  }
};

/** The move a record write earns, in that write's own call: this file's own target and entry check
 *  over the record just made, and only where a kind written is one the rung cites — else the status
 *  is moved by whatever write followed the one that earned it. Linear path only, a park and a triage
 *  being routes `owedIn` drops; stderr throughout, stdout being the record. */
export const movedByRecord = async (documentId, issue, ref, kinds, held = null) => {
  const page = await pageFor(documentId, held);
  const view = viewFrom(documentId, issue, page.comments, page.cut,
    await policyFor(issue.plan, issue.status), () => citedClauses(issue));
  const linear = ORDER.includes(issue.status);
  const { next, missing } = linear ? owedIn(view, ref) : { next: null, missing: [] };
  const cited = Boolean(next) && (CITED[next] ?? []).some((kind) => kinds.includes(kind));
  const moves = cited && !missing.length;
  if (moves) {
    await movedAfterRecord(view, ref, next, (soft) =>
      transitionTo(view, next, ref, { soft, say: console.error }));
  }
  await owedAfter(documentId, moves ? { ...issue, status: next } : issue, ref, page);
  /* The effective rung of the view this already built, for the phase part the caller prints. */
  return { moved: moves ? next : null, rung: rungOf(rungFieldsOf(view)) };
};

/* An ordinary outcome and so no override; the reading is spent before the status moves, not after. */
const reopenTo = async (view, ref, why) => {
  const bad = reopenProblem(view, ref);
  if (bad) refuse(bad);
  let count;
  await moveTo(view, ref, REOPEN, {
    said: { reason: whyChecked("advance --reopen", why) },
    credit: "the reopen transition",
    heard: (answer) => { count = (answer?.issue ?? answer)?.reopenCount; },
  });
  /* Off the tracker's own answer and never worked out here: each look is stamped with the reopen it
     belongs to, so a shortfall read against the count this call arrived with answers for the look
     before and says the record already earns the fall. No count in the answer, no guess. */
  if (count === undefined || count === null) {
    return console.log(`\nWhat this reopen owes is read against the count the tracker keeps of them, `
      + `and its answer to this move carried none:\n  forge advance ${ref} --owed`);
  }
  const held = { ...view, issue: { ...view.issue, status: REOPEN, reopenCount: count } };
  return shortfall(ref, held, owedIn(held, ref));
};

/* The status set with nothing earning it, judged against what `declaredValue` declares and against nothing else, with the reply and the correction saying no check read it. A side status is reached with the payload the tracker demands of one, so `--set` writes what a park writes and skips only the entry checks. */
const setStatus = async (view, ref, status, why, asked) => {
  /* Declaring a name is what would otherwise let it through, `declaredValue` being the only check a set passes, so the kind beside the name in that same table is what refuses — and each refusal names where the caller goes instead of what it may not write (ISS-1022, consult 8736c3 F1; ISS-1043). */
  const kind = statusKind(status);
  if (kind?.replacedBy) {
    refuse(`\`${status}\` is no step of the flow: \`${kind.replacedBy}\` is the rung that took it over, `
      + `and it asks for more than \`${status}\` did, so nothing was sent. Setting the rung that `
      + `replaced it writes a status no entry check read:\n  ${setForm(ref, kind.replacedBy)}`);
  }
  if (kind?.writtenByNobody) {
    refuse(`\`${status}\` is ${kind.writtenByNobody}, so no run of this CLI writes it and nothing was `
      + `sent. The rung a run reaches is \`${CLOSES_FROM}\`, which its record earns: forge advance ${ref}`);
  }
  const said = whyChecked("advance --set", why);
  const near = declaredValue("forge_issues", "status", status);
  if (near) refuse(`${near} That set is what the route table declares this tracker takes. Nothing was sent.`);
  const moved = `the status set to \`${status}\` by \`forge advance --set\`, from `
    + `\`${view.issue.status}\`, with no entry check read`;
  const move = async (soft = false) => {
    const refused = await moveTo(view, ref, status,
      { note: "  (set, unearned)", said: { reason: said, ...waitsFor(status), ...(asked ? { needs: asked } : {}) }, credit: "the set transition" }, soft);
    if (refused) return refused;
    console.log(UNREAD);
    return null;
  };
  if (answersByComment(status)) {
    await correctionFor(view.documentId, ref, moved, said, { done: false });
    return movedAfterRecord(view, ref, status, move);
  }
  await move();
  return correctionFor(view.documentId, ref, moved, said);
};

export const nextHeld = (view) => leaseOf(view.issue?.[FIELD])?.next ?? null;

/* Both names are in argv, so a --needs the tracker would mint nothing from is turned away in the parse — before an endpoint is resolved and before a credential is spent — rather than dropped on the way to a payload. */
const needsChecked = (given, ref) => {
  if (given.needs === undefined) return null;
  if (given.park !== ASKS_A_QUESTION && given.set !== ANSWERED_BY_COMMENT) {
    refuse(`--needs is what would settle the question, and only a move to ${ANSWERED_BY_COMMENT} mints `
      + `the answer box that carries it. The two calls that reach it:\n`
      + `  forge advance ${ref} --park ${ASKS_A_QUESTION} --why "<why>" --needs "<what would settle it>"\n`
      + `  ${setForm(ref, ANSWERED_BY_COMMENT)} --needs "<what would settle it>"`);
  }
  const text = given.needs.trim();
  const bad = needsProblem(text);
  if (bad) refuse(`--needs ${bad}. Nothing was sent.`);
  return text;
};

const readFlags = (rest, ref) => {
  const pulled = pullRepeated(rest, "--evidence", "advance", { usage: USAGE });
  const given = flags(pulled.rest, "advance", ["--owed", "--drop", "--reopen"], { usage: USAGE });
  const evidence = pulled.values;
  const [wrote] = exclusive(given, ["park", "drop", "set", "reopen"], "advance",
    "forms: a drop is the park kind `dropped`, --reopen is the one status a finding earns, and --set names the status outright; a park goes where its kind says");
  const writes = wrote !== undefined;
  if (writes && given.owed) refuse("--owed moves nothing, and --park, --drop and --set write. Ask for one.");
  if (writes && given.to) refuse("--to names the status to advance to; --set and a park each say where they go.");
  if (writes && !given.why) refuse(`--${wrote} needs --why: `
    + "the reason is what the record carries about it.");
  if (given.why && !writes) refuse("--why belongs to --park, --drop or --set; nothing else here takes a reason.");
  if (evidence.length && !writes) refuse("--evidence belongs to the park record; a check reads the evidence already on the issue.");
  const asked = given.next !== undefined;
  if (asked && given.owed) refuse("--owed moves nothing and --next is a write. Ask for one.");
  if (asked && writes) refuse("a park says what it waits for in --why; the claim that resumes it sets --next.");
  return { ...given, evidence, needs: needsChecked(given, ref), next: nextLine(given.next) };
};

const run = async (argv, readAs) => {
  if (!argv.length || wantsHelp(argv)) return console.log(USAGE);
  const [ref, ...rest] = argv;
  if (ref.startsWith("--")) refuse(`advance takes the issue first. ${firstLine(USAGE)}`);
  const given = readFlags(rest, ref);
  const view = await viewOf(ref, given);
  const left = nextHeld(view);
  if (given.owed && left) console.log(`Next, as the last write left it: ${left}`);
  if (!view.whole) console.log(cutSays(view.cut, ref));
  if (view.counted) console.log(countSays(view.counted));
  if (given.set) return setStatus(view, ref, given.set, given.why, given.needs);
  if (given.reopen) return reopenTo(view, ref, given.why);
  if (given.park || given.drop) {
    return park(view, ref, given.park ?? "dropped", given.why, given.evidence, given.needs);
  }
  const { next, missing, resumed, park: routed } = targetOf(view, ref);
  checkTarget(given.to, next, view, ref);
  if (missing.length) {
    shortfall(ref, view, { next, missing });
    /* Asked what is owed, the answer is the answer; asked to move, the same list is a refusal. */
    if (!given.owed) return fail(`${missing.length} item(s) owed before ${next}.`);
    return sayAhead(view, ref, next);
  }
  if (given.owed) {
    for (const line of owedBlock(view, ref, { next, missing })) console.log(line);
    return sayAhead(view, ref, next);
  }
  /* The triage that puts the expectation outside the specification writes its park here, because a
     park is a record and a status and the route decided both from the triage the record holds. */
  if (routed) return parkAs(view, ref, routed.kind, routed.why, [], { left: routed.left });
  /* Both notes, where a form resumed a park: what moved it and what was typed to move it are two
     facts, and dropping either leaves the line answering a question nobody asked. */
  const note = `${resumed ? "  (resumed where its park left it)" : ""}`
    + `${readAs ? `  (read as ${readAs} ${ref})` : ""}`;
  return transitionTo(view, next, ref, { note, next: given.next ?? null });
};

export const advance = async (argv, { readAs = null } = {}) => {
  try {
    await run(argv, readAs);
  } catch (error) {
    if (error instanceof Refused) fail(error.message);
    throw error;
  }
};
advance.answersHelp = true;
