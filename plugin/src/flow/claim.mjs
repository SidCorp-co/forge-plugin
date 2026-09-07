/* The pick: the lease a run takes before it writes anything, the reclaim of one a dead run left
   behind, and the park a status that keeps crashing earns. docs/cli/claim.md. */
import { flags, pullRepeated, wantsHelp } from "../resolve/flags.mjs";
import { sessionOf, sessionSourced } from "../resolve/config.mjs";
import { fail } from "../resolve/settings.mjs";
import { usageOf } from "../resolve/visibility.mjs";
import { documentIdOf } from "../tracker/issues.mjs";
import { scoped } from "../tracker/rpc.mjs";
import { commentPage } from "../tracker/comments.mjs";
import { parse } from "./record.mjs";
import { parkAs, transitionTo } from "./advance.mjs";
import { OPEN_KEPT, patchFrom, worklogFor } from "./worklog.mjs";
import {
  ADVISORY,
  LANDING_READY,
  MINUTES,
  RECLAIMS_BEFORE_PARK,
  SHARED_HOLDER,
  claimRefusal,
  claimed,
  describe,
  historyLine,
  landingLine,
  landingOf,
  leaseOf,
  nextLine,
  parkAnswers,
  parksAsCrashed,
  reclaimsOf,
  setLease,
  sharedHolder,
  stateOf,
  takeRefusal,
} from "./lease.mjs";

const MAX_MINUTES = 24 * 60;
const PARKS_IN = "on_hold";

export const USAGE = [
  usageOf("claim"),
  "The lease on an issue, in the session field the issue already has: a holder, a renew time, a",
  "duration and the claims before this one. Every payload write the CLI makes renews it, and a read",
  "needs none. Nothing else about a run is remembered anywhere.",
  "",
  `  --minutes <n>   how long the lease runs from now, instead of ${MINUTES}`,
  "  --next <line>   one line, the step whoever comes next starts on; a transition clears it",
  "  --pushed        the branch, head, base and files touched, read from git at this moment",
  "  --review        the last codex consult, its findings and what it owes, read from the log now",
  `  --open <line>   a scratch decision or a dead end, appended; past ${OPEN_KEPT} the oldest is dropped`,
  "  --ready         with --pushed: the landing checkpoint, in state `ready`, from that capture",
  "  --take          the lease at whatever state the checkpoint names your turn",
  "",
  "Those three write the worklog beside the lease, which is what `forge resume` reads first. Neither",
  "capture is automatic: a write made from another checkout would name that one as this issue's.",
  "",
  "The checkpoint is what a build that stops at ready-to-land leaves for whoever lands it: the",
  "builder's session, the branch, the judged head, the base and the files, and a state naming whose",
  "turn it is. `--take` is the only route that may take a lease which is still live, and only where",
  "the state names the taker: the lander at `ready` and at every state of the landing itself, the",
  "named builder or a successor at `builder-owed`, the QA run at `qa-owed`. Any other take is",
  "refused naming the state it read.",
  "",
  "The lease names the agent type and the process id beside the session, so a refusal says what",
  "held the issue and not only which uuid. A claim that takes over prints the line the last holder",
  "left, and passes nothing of its own on unless --next says so.",
  "",
  "A live lease held by another run refuses the claim, naming that run and its renew time. One past",
  "its duration is reclaimable by any run, and the run that held it is refused as stale when it",
  `writes again. The reclaim after ${RECLAIMS_BEFORE_PARK} of one status parks the issue for a person instead, kind`,
  "crashed, with the claim history as its reason.",
  "",
  ADVISORY,
].join("\n");

const minutesFrom = (raw) => {
  if (raw === undefined) return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > MAX_MINUTES) {
    fail(`--minutes takes an integer from 1 to ${MAX_MINUTES}, not \`${raw}\`.`);
  }
  return value;
};

/* The crashed park the record ends with: the status it left and when it was written, or nothing. */
const crashedPark = (comments) => {
  const parks = comments
    .map((one) => ({ at: one.createdAt ?? "", record: parse(one.body ?? "") }))
    .filter((one) => one.record?.kind === "park");
  const last = parks.at(-1);
  return last?.record.fields.kind === "crashed"
    ? { left: last.record.fields.left, at: last.at }
    : null;
};

/* A park is a transition, so it clears the line it follows, or this third write would put back what
   the transition just took away. A line this claim asked for survives it: the person resuming reads
   it, and writing it, printing it and taking it away again would be the input dropped. */
export const parkWrite = (lease, next = null) =>
  ({ holder: lease.holder, at: new Date().toISOString(), minutes: lease.minutes, next: next ?? null });

/* The line taken over from is not the line taken on: printing the incoming one as the last
   holder's would say the dead run left a note its successor wrote. A take is a handoff too. */
const HANDOFF = new Set(["reclaim", "take"]);

export const nextLines = (how, left, taken) => [
  HANDOFF.has(how) && left ? `Next, left by the run before: ${left}` : null,
  taken && taken !== left ? `Next: ${taken}` : null,
].filter(Boolean);

/* Off the same capture the worklog took, so the head the checkpoint calls judged is the head the
   review was taken at. The paths and not the count: what the lander compares with what the landing
   moved is a list, and a capture that read no diff is a checkpoint nobody can land. */
export const readyCheckpoint = (ref, holder, patch, landing) => {
  if (!patch?.head || !patch.base) {
    fail(`claim --ready writes the checkpoint off the capture --pushed makes, and this one captured `
      + `nothing — the line above says why. Capture at the push, before the merge:\n`
      + `  forge claim ${ref} --pushed --ready`);
  }
  if (landing && landing.state !== LANDING_READY) {
    fail(`the landing checkpoint on ${ref} reads \`${landing.state}\`, which is past the build, so `
      + `--ready would write the landing's own reading away. Read where it is:\n  forge resume ${ref}`);
  }
  return {
    state: LANDING_READY,
    builder: holder,
    branch: patch.branch,
    head: patch.head,
    base: patch.base,
    files: String(patch.touched ?? "").split(", ").filter(Boolean),
    at: patch.at,
  };
};

/* The turn is read before anything is written, because this is the one claim that may take a live
   lease: a take the state does not name is refused and no field is touched. */
const takeTurn = async (documentId, ref, issue, context, { holder, minutes, line, patch, source }) => {
  const landing = landingOf(context);
  const refused = takeRefusal(ref, landing, holder, leaseOf(context), { source });
  if (refused) fail(refused);
  const left = leaseOf(context)?.next ?? null;
  const next = claimed(context, {
    holder, at: new Date().toISOString(), minutes, next: line, worklog: worklogFor(context, patch),
    how: "take", status: issue.status,
  });
  await setLease(documentId, next, ref);
  const taken = leaseOf(next);
  console.log(`${ref}  take: ${describe(taken)}`);
  console.log(landingLine(landing));
  for (const one of nextLines("take", left, taken.next)) console.log(one);
  return taken;
};

/* The acknowledgement is the third write, and a run can die before it: on an issue already parked,
   the record names the status it left and the history it answered is answered from there. */
const answerPark = async (documentId, ref, context, line) => {
  const lease = leaseOf(context);
  const { comments } = await commentPage(documentId);
  const park = crashedPark(comments);
  if (!park || !parkAnswers(lease, park.left, park.at)) return false;
  await setLease(documentId, claimed(context, { ...parkWrite(lease, line), how: "parked", status: park.left }), ref);
  console.log(`${ref} is parked as crashed for what it did at ${park.left}, and its history now says so.`);
  return true;
};

/* Three writes for one park, and the last says the park was answered: a run that dies between them
   leaves the park owed, so the record is written again only where it did not land. */
const parkCrashed = async (documentId, ref, issue, context, line) => {
  const status = issue.status;
  const lease = leaseOf(context);
  const why = `${reclaimsOf(lease, status)} reclaims of ${status}, so the status and not the run is `
    + `where this dies. Claims at ${status}: ${historyLine(lease, status)}`;
  const view = { documentId, issue };
  const { comments } = await commentPage(documentId);
  const written = crashedPark(comments);
  const stands = written?.left === status && parkAnswers(lease, status, written.at);
  if (stands) await transitionTo(view, PARKS_IN, ref);
  else await parkAs(view, ref, "crashed", why);
  await setLease(documentId, claimed(context, { ...parkWrite(lease, line), how: "parked", status }), ref);
  console.log(`${ref} kept crashing at ${status}. The lease is yours and the issue is a person's.`);
};

export const claim = async (argv) => {
  if (!argv.length || wantsHelp(argv)) return console.log(USAGE);
  const [ref, ...rest] = argv;
  if (ref.startsWith("--")) fail(`claim takes the issue first. ${usageOf("claim")}`);
  const pulled = pullRepeated(rest, "--open", "claim");
  const given = flags(pulled.rest, "claim", ["--pushed", "--review", "--ready", "--take"]);
  const takes = ["minutes", "next", "pushed", "review", "ready", "take"];
  for (const one of Object.keys(given)) {
    if (!takes.includes(one)) fail(`claim takes no --${one}. Flags: ${takes.map((two) => `--${two}`).join(" ")} --open`);
  }
  if (given.ready && given.take) {
    fail(`claim takes --ready or --take and not both: one ends a build and the other picks up the `
      + `turn a checkpoint names. To end this build:\n  forge claim ${ref} --pushed --ready`);
  }
  if (given.ready && !given.pushed) {
    fail(`claim --ready writes the checkpoint off the capture --pushed makes, so the two are typed `
      + `together:\n  forge claim ${ref} --pushed --ready`);
  }
  const asked = minutesFrom(given.minutes);
  const line = nextLine(given.next);
  const patch = patchFrom({ pushed: given.pushed, review: given.review, open: pulled.values });
  const documentId = await documentIdOf(ref);
  const issue = await scoped("forge_issues", { action: "get", documentId, fields: ["sessionContext", "status"] });
  const context = issue?.sessionContext ?? null;
  const lease = leaseOf(context);
  const mine = sessionSourced();
  const holder = sessionOf();
  const state = stateOf(lease, holder);
  const minutes = asked ?? (lease && lease.holder === holder ? lease.minutes : MINUTES);
  if (given.take) {
    const took = await takeTurn(documentId, ref, issue, context,
      { holder, minutes, line, patch, source: mine.id === holder ? mine.source : null });
    if (sharedHolder(took, mine)) console.log(SHARED_HOLDER);
    return console.log(ADVISORY);
  }
  if (state === "live") fail(claimRefusal(ref, lease));
  const left = lease?.next ?? null;
  const how = { free: "claim", expired: "reclaim", mine: null, lapsed: null }[state];
  const checkpoint = given.ready ? readyCheckpoint(ref, holder, patch, landingOf(context)) : null;
  const next = claimed(context, {
    holder, at: new Date().toISOString(), minutes, next: line, worklog: worklogFor(context, patch), how, status: issue.status,
    landing: checkpoint ?? undefined,
  });
  await setLease(documentId, next, ref);
  const taken = leaseOf(next);
  console.log(`${ref}  ${how ?? "renewed"}: ${describe(taken)}`);
  if (checkpoint) console.log(`${landingLine(checkpoint)} — taken from here by \`forge claim ${ref} --take\`.`);
  for (const one of nextLines(how, left, taken.next)) console.log(one);
  /* Beside the lease it is about, and above every route out of here: a claim that answers a park
     returns below, and the run would take the lease without being told what it matched on. */
  if (sharedHolder(taken, mine)) console.log(SHARED_HOLDER);
  /* Decided after the write, so what decides is the history this claim has just added to. */
  if (issue.status === PARKS_IN) {
    if (await answerPark(documentId, ref, next, line)) return undefined;
  } else if (parksAsCrashed(taken, issue.status)) {
    return parkCrashed(documentId, ref, issue, next, line);
  }
  if (how === "reclaim") {
    console.log(`Reclaim ${reclaimsOf(taken, issue.status)} of ${issue.status}: `
      + `the one after ${RECLAIMS_BEFORE_PARK} parks the issue as crashed.`);
  }
  return console.log(ADVISORY);
};
claim.answersHelp = true;
