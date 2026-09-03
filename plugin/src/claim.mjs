/* The pick: the lease a run takes before it writes anything, the reclaim of one a dead run left
   behind, and the park a status that keeps crashing earns. docs/FORGE-CLI.md. */
import { flags } from "./resolve/flags.mjs";
import { fail } from "./resolve/settings.mjs";
import { usageOf } from "./resolve/visibility.mjs";
import { documentIdOf } from "./issues.mjs";
import { scoped } from "./rpc.mjs";
import { commentPage, parse } from "./record.mjs";
import { parkAs, transitionTo } from "./advance.mjs";
import {
  ADVISORY,
  MINUTES,
  RECLAIMS_BEFORE_PARK,
  claimRefusal,
  claimed,
  describe,
  historyLine,
  leaseOf,
  nextLine,
  parkAnswers,
  parksAsCrashed,
  reclaimsOf,
  sessionOf,
  setLease,
  stateOf,
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
  return last?.record.fields.Kind === "crashed"
    ? { left: last.record.fields["Status left"], at: last.at }
    : null;
};

/* A park is a transition, so it clears the line it follows, or this third write would put back what
   the transition just took away. A line this claim asked for survives it: the person resuming reads
   it, and writing it, printing it and taking it away again would be the input dropped. */
export const parkWrite = (lease, next = null) =>
  ({ holder: lease.holder, at: new Date().toISOString(), minutes: lease.minutes, next: next ?? null });

/* The line taken over from is not the line taken on: printing the incoming one as the last
   holder's would say the dead run left a note its successor wrote. */
export const nextLines = (how, left, taken) => [
  how === "reclaim" && left ? `Next, left by the run before: ${left}` : null,
  taken && taken !== left ? `Next: ${taken}` : null,
].filter(Boolean);

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
  if (!argv.length || argv[0] === "-h" || argv[0] === "--help") return console.log(USAGE);
  const [ref, ...rest] = argv;
  if (ref.startsWith("--")) fail(`claim takes the issue first. ${usageOf("claim")}`);
  const given = flags(rest, "claim");
  const takes = ["minutes", "next"];
  for (const one of Object.keys(given)) {
    if (!takes.includes(one)) fail(`claim takes no --${one}. Flags: ${takes.map((two) => `--${two}`).join(" ")}`);
  }
  const asked = minutesFrom(given.minutes);
  const line = nextLine(given.next);
  const documentId = await documentIdOf(ref);
  const issue = await scoped("forge_issues", { action: "get", documentId });
  const context = issue?.sessionContext ?? null;
  const lease = leaseOf(context);
  const holder = sessionOf();
  const state = stateOf(lease, holder);
  if (state === "live") fail(claimRefusal(ref, lease));
  const left = lease?.next ?? null;
  const how = { free: "claim", expired: "reclaim", mine: null, lapsed: null }[state];
  const minutes = asked ?? (lease && lease.holder === holder ? lease.minutes : MINUTES);
  const next = claimed(context, { holder, at: new Date().toISOString(), minutes, next: line, how, status: issue.status });
  await setLease(documentId, next, ref);
  const taken = leaseOf(next);
  console.log(`${ref}  ${how ?? "renewed"}: ${describe(taken)}`);
  for (const one of nextLines(how, left, taken.next)) console.log(one);
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
