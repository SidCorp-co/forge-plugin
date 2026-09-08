/* The landing, from the tree the fold works in: the checkpoints and pushed branches it is given as
   one candidate onto one pinned base that moved nothing of any change out, gated, versioned and
   pushed once. It repairs no conflict and re-judges nothing. docs/cli/the-checkpoint.md. */
import { join, resolve } from "node:path";

import { gitOut, loud, REMOTE, stop, Stop } from "../checkout.mjs";
import { INSTALLS, LANDS, PUSHES, runLanding, waitMs } from "./land.mjs";
import { follows, installs, shortly } from "./install.mjs";
import { above, forgetBump, versionAbove } from "./version.mjs";
import { versionAt } from "./landing.mjs";
import {
  candidateOf, carries, dropRoom, landedAlready, linked, mergedTree, movedBy, NOT_KNOWN, pushed,
  remoteHead, roomFor,
} from "./land-ready/candidate.mjs";
import {
  asked, caughtUp, DEVELOPED, intendedOf, keysOf, markStep, notReconciled, OWED_TO_QA, perMember,
  releaseOf, saveOn, statusStep, TESTED, viewOf, voidSaid,
} from "./land-ready/member.mjs";
import { sessionOf } from "../../plugin/src/resolve/config.mjs";
import { documentIdOf } from "../../plugin/src/tracker/issues.mjs";
import { pluginCopy } from "../../plugin/src/tools/plugin-copy.mjs";
import { parkAs } from "../../plugin/src/flow/advance.mjs";
import {
  LANDING_BUILDER_OWED, LANDING_CANDIDATE, LANDING_DONE, LANDING_JUDGED, LANDING_QA_OWED,
  LANDING_READY, LANDING_RECONCILED, landingOf, landingVoided, takeLease,
} from "../../plugin/src/flow/lease.mjs";
import { INDEPENDENT } from "../../plugin/src/flow/qa/verdicts.mjs";
import { judgementOf, landingRoute, releasePolicy } from "../../plugin/src/tracker/project-config.mjs";
import { landingScope } from "../../plugin/src/resolve/settings.mjs";
import { scoped } from "../../plugin/src/tracker/rest.mjs";

/* The route this task branches on, off the project's record. docs/cli/the-checkpoint.md. */
const BEFORE_MERGE = "before-merge";
const AFTER_MERGE = "after-merge";

/* Rebuilt twice with the base moving under each pin is a fold racing something else, and a third
   pass would spend another whole gate to say so. */
const TRIES = 2;

/* The steps by name rather than by number, because the resume table below points at them and a
   reordering that shifted an index would resume into the wrong step and say nothing. */
const ORDER = ["pin", "merge", "candidate", "gate", "version", "judge", "push", "install", "mark", "status"];

/* Where a second run picks up, per state, the step it starts at reading whether the write it guards
   already landed: `push` asks the remote for the intended sha, `install` asks the install record,
   `mark` asks the issue for its mark, `status` asks the status. `owedAt` reads the one state this
   table cannot answer alone; a state whose turn is not the lander's never reaches here. */
const OWED = {
  ready: "pin",
  candidate: "pin",
  reconciled: "pin",
  judged: "pin",
  promoting: "push",
  promoted: "install",
  installed: "mark",
  marked: "status",
};

/* `judged` sits either side of a promotion, told apart by the sha only `pushStep` writes and a void clears: the-checkpoint.md. */
const owedAt = (landing) =>
  (landing.state === LANDING_JUDGED && landing.intended ? "status" : OWED[landing.state] ?? "");

/* What a set may hold, and the reason one machine can drive a list: all three of these states owe
   the pin, so a set starts at the first step and replays no member into a step it is past. What each
   of the three fields below would mean in a set: the-checkpoint.md. */
const IN_A_SET = new Set([LANDING_READY, LANDING_CANDIDATE, LANDING_RECONCILED]);

const setMember = (landing) =>
  IN_A_SET.has(landing.state) && !landing.intended && !landing.moved && !landing.deployment;

/* Every step reads where it is off the checkpoint rather than trusting what the step before it left
   in memory, because a second process resumes into four of them. `at` is the set's side of that
   reading: its members, the pin, the candidate the chain came to and what this attempt built. */
const pinStep = async (one) => {
  const { at, ctx: { base, root } } = one;
  const nameless = at.members.find((member) => !member.landing.branch);
  if (nameless) stop(`the checkpoint on ${nameless.key} names no branch, so there is nothing to land.`);
  loud("git", ["fetch", REMOTE, ...at.members.map((member) => member.landing.branch), base], root,
    "Check the remote is reachable.");
  at.pin = remoteHead(root, base);
  console.log(`  ${base} is pinned at ${shortly(at.pin)}`);
  await perMember(at, async (member) => {
    const { key, documentId, landing } = member;
    if (!gitOut(["rev-parse", "--verify", `${landing.head}^{commit}`], root)) {
      stop(`${key} was judged at ${shortly(landing.head)}, a commit this checkout cannot read even after `
        + `fetching ${landing.branch}. The build's own tree holds it — push that branch again.`);
    }
    console.log(`  ${landing.branch} was judged at ${shortly(landing.head)}`);
    if (landing.state === LANDING_READY) {
      await saveOn(member, { state: LANDING_CANDIDATE, pinned: at.pin });
      return;
    }
    if (landing.pinned === at.pin) {
      console.log("  the pin this landing held is still the branch head");
      return;
    }
    /* A state the table offers before a promotion is reachable after one too, on the reading `owedAt` makes, so the release is asked about before anything is voided: rebuilt from a fresh pin, a checkpoint past its push would land the same change a second time. */
    const on = landing.intended ? landedAlready(root, base, landing.intended) : null;
    if (on && !on.known) stop(NOT_KNOWN(key, base, on.now, landing.intended));
    if (on?.landed) {
      stop(`${key} holds the release ${shortly(landing.intended)}, which ${base} carries at `
        + `${shortly(on.now)}: this checkpoint reads \`${landing.state}\` and is past its own push, so `
        + `there is no candidate to rebuild and nothing here to land again. What is left of it is the `
        + `reading of that release:\n    forge resume ${key}`);
    }
    const said = await voidSaid(documentId, landing);
    console.log(`  the pin this landing held was ${shortly(landing.pinned)} and ${base} is now `
      + `${shortly(at.pin)}, so the candidate and every reading taken at it are void.${said}`);
    await saveOn(member, landingVoided(at.pin));
  });
};

/* Against the pin and not against the branches beside it: a conflict here is the base's own, which
   is what a park as blocked claims. The chain's own conflicts are the candidate step's. */
const mergeStep = async (one) => {
  const { at, ctx: { base, root } } = one;
  await perMember(at, async (member) => {
    const { key, documentId, landing } = member;
    /* Kept on the member: the candidate step reads the same merge rather than writing it twice. */
    member.merged = mergedTree(root, at.pin, landing.head);
    const { conflicts } = member.merged;
    if (!conflicts.length) {
      console.log(`  ${landing.branch} merges clean onto ${shortly(at.pin)}`);
      return;
    }
    const why = `${landing.branch} does not merge onto ${base} at ${shortly(at.pin)}: `
      + `${conflicts.join(", ")} conflict. The landing repairs no conflict — the run that built `
      + `the branch rebases it, re-reviews the rebased head and writes the checkpoint again.`;
    const view = await asked(() => viewOf(documentId));
    await asked(() => parkAs(view, key, "blocked", why, conflicts));
    stop(`${key} is parked as blocked and nothing of it was edited, pushed or installed.`);
  });
};

// The turn a moved base hands back, at the sha a later landing of that branch alone builds again.
const handedBack = async (member, alone, moved) => {
  const { key, landing } = member;
  if (landing.reconciled === alone) {
    return console.log(`  the landing moved ${moved.join(", ")}, reconciled at ${shortly(alone)}`);
  }
  /* Past `candidate` already, and reconciled against something else: the handoff has happened
     once and what came back does not answer for this candidate, so nothing here writes over it. */
  if (landing.state !== LANDING_CANDIDATE) stop(notReconciled(key, landing, alone, moved));
  await saveOn(member, { state: LANDING_BUILDER_OWED, candidate: alone, moved: moved.join(", ") });
  return stop(`the landing moved ${moved.join(", ")}, so this change's own paths are not what was judged `
    + `and the branch goes back to the run that built it. Nothing of ${key} is pushed, deployed or `
    + `installed until the checkpoint reads \`${LANDING_RECONCILED}\` at ${shortly(alone)}:\n`
    + `    forge claim ${key} --take\n`
    + `    ... rebased onto that candidate, then: forge claim ${key} --reconciled ${alone}`);
};

/* The reconciliation the landing can make itself, and the one it cannot: a merge that left a
   change's own paths alone is reconciled here, and one that moved any of them is that builder's.
   Which candidate each of them is taken at, and why a member only a sibling moved leaves the set
   rather than going back to anybody: the-checkpoint.md. */
const chainStep = async (one) => {
  const { at, ctx: { root } } = one;
  const held = [];
  at.candidate = at.pin;
  await perMember(at, async (member) => {
    const { landing } = member;
    const merged = member.merged ?? mergedTree(root, at.pin, landing.head);
    const alone = candidateOf(root, merged.tree, at.pin, landing.head);
    const moved = movedBy(root, landing.head, alone, landing.files);
    if (moved.length) {
      await handedBack(member, alone, moved);
      at.candidate = alone;
      held.push(member);
      return;
    }
    const link = held.length ? linked(root, at.candidate, landing.head) : { conflicts: [], commit: alone };
    member.again = true;
    if (link.conflicts.length) {
      stop(`${landing.branch} does not merge onto the candidate the branches before it make: `
        + `${link.conflicts.join(", ")} conflict. It is landed after them, against the base this `
        + `landing leaves, where a conflict is the base's own and parks it.`);
    }
    const mine = movedBy(root, landing.head, link.commit, landing.files);
    const theirs = held.flatMap((kept) => movedBy(root, kept.landing.head, link.commit, kept.landing.files));
    if (mine.length || theirs.length) {
      stop(`the candidate this set makes moves ${[...mine, ...theirs].join(", ")}, which is not the `
        + `base's doing: ${landing.branch} and a branch beside it write the same paths. It is landed `
        + `after them, against the base this landing leaves, where the move is the base's and its own `
        + `builder is asked about it.`);
    }
    member.again = false;
    console.log(`  the landing moved nothing of the change on ${landing.branch}`);
    at.candidate = link.commit;
    held.push(member);
  });
  console.log(`  candidate ${shortly(at.candidate)} over `
    + `${at.members.reduce((all, member) => all + member.landing.files.length, 0)} file(s) of `
    + `${at.members.length} change(s)`);
  /* A plain loop from here, where the two above drop a member and go on: the candidate holds this
     member's head already, so a drop now would ship its change with nothing recorded of it. */
  for (const member of at.members) {
    const { key, documentId, landing } = member;
    if (landing.state === LANDING_CANDIDATE) {
      await saveOn(member, { state: LANDING_RECONCILED, candidate: at.candidate, reconciled: at.candidate });
      continue;
    }
    if (landing.reconciled === at.candidate) continue;
    /* A reading of another candidate: a builder's is refused, that one being work somebody did and
       none of this landing's to write over, and the landing's own is void — the membership of the
       set is what moved under it — and made again below, as a moved pin's is. */
    if (landing.moved) stop(notReconciled(key, landing, at.candidate));
    const said = await voidSaid(documentId, landing);
    console.log(`  ${key} was reconciled at ${shortly(landing.reconciled)} and this landing built `
      + `${shortly(at.candidate)}: the set that reading was taken in is not this one, so it is `
      + `void.${said}`);
    await saveOn(member, landingVoided(at.pin));
    await saveOn(member, { state: LANDING_RECONCILED, candidate: at.candidate, reconciled: at.candidate });
  }
};

/* Held back rather than refused: what waits on the judgement is the push and not the candidate. A
   set never reaches the turn below, the formation making none where it sits. */
const judgeStep = async (one) => {
  const { at, ctx: { route, judgement } } = one;
  if (judgement !== INDEPENDENT || route !== BEFORE_MERGE) {
    return console.log(`  no judge's turn sits here: this project lands ${route} and its judgement `
      + `between developed and tested is ${judgement}`);
  }
  const [member] = at.members;
  const { key, documentId, landing } = member;
  if (landing.state === LANDING_JUDGED) {
    if (landing.deployment === at.candidate) {
      return console.log(`  judged at ${shortly(at.candidate)}, the candidate this landing built`);
    }
    const said = await voidSaid(documentId, landing);
    await saveOn(member, landingVoided(at.pin));
    at.rebuild = true;
    return stop(`the turn came back judged at ${shortly(landing.deployment)} and this landing built `
      + `${shortly(at.candidate)}, so what was judged is not what would be promoted.${said} The `
      + `candidate is rebuilt and the judgement asked for again.`);
  }
  await saveOn(member, { state: LANDING_QA_OWED, deployment: at.candidate });
  return stop(OWED_TO_QA(key, member.landing, "the candidate"));
};

const pushStep = async (one) => {
  const { at, ctx: { base, root } } = one;
  for (const member of at.members) {
    if (member.landing.state !== "promoting") {
      await saveOn(member, { state: "promoting", intended: at.intended, release: at.release });
    }
  }
  /* Asked of the remote, never of the tracking ref: a resume aimed at this step fetched nothing,
     and the ref it would read can name a head another landing pushed past. */
  const pin = at.pin ?? at.members[0].landing.pinned;
  const intended = intendedOf(at);
  const named = keysOf(at);
  const rebuilt = async (now, why) => {
    for (const member of at.members) await saveOn(member, landingVoided(now));
    at.rebuild = true;
    stop(why);
  };
  const first = landedAlready(root, base, intended);
  if (!first.known) stop(NOT_KNOWN(named, base, first.now, intended));
  if (first.landed) {
    console.log(`  ${base} is at ${shortly(first.now)} and carries ${shortly(intended)}: this `
      + `release landed and the save after it did not`);
  } else if (first.now !== pin) {
    await rebuilt(first.now, `${base} is at ${shortly(first.now)} and this landing pinned ${shortly(pin)}: `
      + `another landing pushed while this one built. The candidate is rebuilt from the new head, and `
      + `the review and QA readings taken at the old one are void.`);
  } else if (!pushed(root, base, pin, intended)) {
    /* Asked again rather than assumed: a push the remote took and the client did not hear about
       reads as a rejection here, and voiding then would release the same change twice. */
    const again = landedAlready(root, base, intended);
    if (!again.known) stop(NOT_KNOWN(named, base, again.now, intended));
    if (!again.landed) {
      await rebuilt(again.now, `the push was rejected against the pin ${shortly(pin)}, so ${base} moved `
        + `between the read a moment ago and the push itself. The candidate is rebuilt from the new head.`);
    }
    console.log(`  the push reported a failure and ${base} carries ${shortly(intended)} anyway, `
      + `so it landed and nothing is pushed again`);
  }
  if (at.room) forgetBump(at.room);
  for (const member of at.members) await saveOn(member, { state: "promoted" });
  console.log(`  ${base} is at ${shortly(intended)}, release ${releaseOf(at)}`);
};

const installStep = async (one) => {
  const { at, ctx: { base, root, self, market, plugin } } = one;
  const intended = intendedOf(at);
  const release = releaseOf(at);
  const named = keysOf(at);
  const on = landedAlready(root, base, intended);
  if (!on.known) stop(NOT_KNOWN(named, base, on.now, intended));
  if (!on.landed) {
    stop(`${named} is past its push and ${base} is at ${shortly(on.now)}, which does not carry `
      + `${shortly(intended)}. This release is not on the branch, so nothing of it is `
      + `installed: read what moved that branch before anything here runs again.`);
  }
  /* The branch is past this release, so installing this tree would put a copy in the cache below the
     branch — the one thing an install may not do. That is a reason to skip it and no reason to call
     it done: the record is what says a copy carrying this release is installed, and the branch's own
     ancestry says nothing about it. A plain `land` moves that branch and installs nothing. */
  if (on.now !== intended) {
    const copy = pluginCopy(join(root, "plugin"));
    if (!copy?.installed || above(release, copy.installed)) {
      stop(`${base} is at ${shortly(on.now)}, past this release at ${shortly(intended)}, and `
        + `the newest install record holds ${copy?.installed ?? "nothing for this plugin"} — below `
        + `the ${release} this landing made. Installing this tree would put an older copy in `
        + `the cache and saying it is installed would certify a copy nobody has. Install the branch `
        + `head, then run this landing again for the mark and the statuses it still owes.`);
    }
    console.log(`  ${base} is at ${shortly(on.now)}, past this release at ${shortly(intended)}, `
      + `and ${copy.name} ${copy.installed} is installed over it: the install is not owed and what is `
      + `left of this landing is`);
  } else {
    at.room ??= roomFor(root, intended);
    follows(root, base, at.room);
    const copy = pluginCopy(join(at.room, "plugin"));
    if (copy && copy.installed === release && !copy.stale) {
      console.log(`  ${copy.name} ${copy.installed} is installed already, so this install is owed nothing`);
    } else {
      /* One cache is what every release on this machine installs into, and this span moves the marketplace registration through the candidate's own worktree, so where it is entered and not left the branch after this one is not landed: the refusal says what to put back, and a landing that shipped over it would bury the reading of it. */
      at.installing = true;
      installs({ tree: at.room, root, base, market, plugin, self });
      at.installing = false;
    }
  }
  for (const member of at.members) await saveOn(member, { state: "installed" });
};

/* Spent on the combination and on no subset of it: what the branches are landed as instead, and the
   runs that bounds, is the-checkpoint.md's. */
const gateStep = (one) => {
  const { at, ctx: { root } } = one;
  at.room = roomFor(root, at.candidate);
  const many = at.members.length > 1;
  try {
    loud("npm", ["run", "check"], at.room, many
      ? `The candidate is the merge of ${at.members.length} branches, so a failure here is the `
        + `combination and no one branch of it.`
      : "The candidate is the merge, so a failure here is the branch against what landed since. "
        + "It goes back to the run that built it, rebased.");
  } catch (error) {
    if (!(error instanceof Stop) || !many) throw error;
    at.split = true;
    stop(`${keysOf(at)} are green apart and red together, and the gate says nothing about which of `
      + `them the combination is. No subset is searched for: every reading taken at this candidate is `
      + `void and each branch is landed alone, against the base as it moves, so the one that fails `
      + `there fails on its own account and the failing step goes back to whoever built it.`);
  }
};

/* The table the resume points into, one row per name in ORDER. */
const landingSteps = (one) => {
  const { base, market, plugin } = one.ctx;
  const branches = one.at.members.map((member) => member.landing.branch).join(", ");
  return [
    [`pin ${REMOTE}/${base} and the branch head(s)`, () => pinStep(one), LANDS],
    [`merge ${branches} onto the pin`, () => mergeStep(one)],
    ["the candidate, and what the landing moved", () => chainStep(one)],
    ["the gate over the candidate", () => gateStep(one)],
    ["a version above the pin", () => {
      versionAbove(one.at.room, base, null, one.at.pin);
      one.at.release = versionAt(one.at.room, "HEAD");
      one.at.intended = gitOut(["rev-parse", "HEAD"], one.at.room);
    }],
    ["the judge's turn, where the project judges before the merge", () => judgeStep(one)],
    [`push to ${REMOTE}/${base}, the pin its expected old value`, () => pushStep(one), PUSHES],
    [`install ${plugin}@${market} from the tree that shipped`, () => installStep(one), INSTALLS],
    ["the merged mark", () => markStep(one)],
    ["the statuses the record earns", () => statusStep(one)],
  ];
};

/* The reads and the take, before any step and outside the lock: every refusal here is one branch's own, nothing of the machine or the tree having moved yet, which is what lets the run go on to the key after it. From the first step onwards a refusal may be the whole run's. */
/* Apart from the take: a key this task may not take is still a record it may read. */
const readOf = async (key) => {
  const documentId = await asked(() => documentIdOf(key));
  const issue = await asked(() => scoped("forge_issues",
    { action: "get", documentId, fields: ["sessionContext", "status"] }));
  return { documentId, context: issue?.sessionContext ?? null, status: issue?.status ?? null };
};

const taken = async (key, { documentId, context, status }) => {
  const landing = landingOf(context);
  if (!landing) {
    stop(`${key} carries no landing checkpoint, so there is no ready branch to land. A build writes `
      + `one where it ends:\n    forge claim ${key} --pushed --ready`);
  }
  /* Before the take, not after it: a take is a write, and a state this task cannot carry is one it
     has no business holding the lease for — least of all `builder-owed`, whose turn is a run this
     task is not and whose live lease the take may replace. */
  const from = ORDER.indexOf(owedAt(landing));
  if (from < 0) {
    stop(`the landing checkpoint on ${key} reads \`${landing.state}\`, which is not a step this task `
      + `owes: read where it is, and land it when the state names the lander's turn.\n`
      + `    forge resume ${key}`);
  }
  await asked(() => takeLease(documentId, key, context, {
    holder: sessionOf(), line: `landing ${landing.branch}`, status,
  }));
  return { documentId, landing, from };
};

/* One candidate, the branches on it, and the rebuild a moved base earns them. The lock is the ship's,
   taken at the pin and dropped after the install, so a `ship` or a `land` on this checkout waits for
   the whole span. What comes back is the members this landing did not land and another is owed. */
const landSet = async (taking, ctx, from) => {
  let members = taking;
  for (let attempt = 1; attempt <= TRIES; attempt += 1) {
    const at = { members, dropped: [], pin: null, room: null, candidate: null };
    const steps = landingSteps({ at, ctx });
    const order = [...steps.keys()].filter((one) => one >= (attempt > 1 ? 0 : from));
    try {
      const whole = await runLanding(steps, order, ctx.root, {
        ms: ctx.ms,
        held: (one) => Boolean(steps[one][2]),
        again: () => `The checkpoint says where this landing is, so no step number is owed: `
          + `${ctx.self} land-ready ${taking.map((one) => one.key).join(" ")}`,
      });
      if (whole) {
        console.log(`\n${keysOf(at)} landed as ${releaseOf(at)}.`);
        return at.dropped.filter((one) => one.again);
      }
      if (at.installing) {
        stop(`the install of ${keysOf(at)} was entered and not finished, so what the plugin cache and `
          + `the marketplace registration hold is what that refusal says. Read it and put back what it `
          + `names before any other branch lands: this run stops here rather than shipping over it.`);
      }
      if (at.split) {
        for (const member of at.members) await saveOn(member, landingVoided(at.pin));
        return [...at.members, ...at.dropped.filter((one) => one.again)];
      }
      if (!at.rebuild) return at.dropped.filter((one) => one.again);
      members = at.members;
    } finally {
      dropRoom(ctx.root, at.room);
    }
  }
  return stop(`${taking.map((one) => one.key).join(" ")} was rebuilt ${TRIES} times and ${ctx.base} `
    + `moved under each pin. Something else is landing on this branch — land it again once that has `
    + `stopped: ${ctx.self} land-ready ${taking.map((one) => one.key).join(" ")}`);
};

/* The set a death inside the promoting loop broke, read back off the ancestry rather than off a
   field no record holds: a member the pushed release already carries was on that candidate, and a
   candidate of its own would spend a gate and a version on a change the base has. the-checkpoint.md. */
const PAST_INSTALL = new Set(["installed", "marked", LANDING_QA_OWED, LANDING_JUDGED, LANDING_DONE]);

const carriedOn = async (holder, rest, ctx) => {
  const issue = await asked(() => scoped("forge_issues",
    { action: "get", documentId: holder.documentId, fields: ["sessionContext"] }));
  const { intended, release, state } = landingOf(issue?.sessionContext ?? null) ?? {};
  if (!intended || !release) return [];
  /* Asked of the remote and of that state: a release built and not pushed is readable here for as
     long as its objects last, and an install nothing ran is not a step to write on another record. */
  const on = landedAlready(ctx.root, ctx.base, intended);
  if (!on.known || !on.landed) return [];
  const carried = rest.filter((one) => one.landing.state === LANDING_RECONCILED
    && carries(ctx.root, intended, one.landing.head));
  for (const one of carried) {
    console.log(`\n=== ${one.key}, on the release ${release} ${holder.key} pushed`);
    if (!PAST_INSTALL.has(state)) {
      console.error(`  ${ctx.base} carries ${shortly(intended)} and the checkpoint on ${holder.key} `
        + `reads \`${state}\`, so that release is not installed yet. Nothing of ${one.key} is written `
        + `against a release nobody has installed, and no candidate of its own is built for a change `
        + `${ctx.base} carries: finish that landing, and this one is read off it.\n`
        + `    ${ctx.self} land-ready ${holder.key}`);
      process.exitCode = 1;
      continue;
    }
    console.log(`  ${shortly(intended)} carries ${shortly(one.landing.head)} and is installed, so `
      + `this change is on ${ctx.base} already: what is owed of it is the reading of that release, `
      + `and no second release of the same change`);
    await caughtUp(one, intended, release);
    await landSet([one], ctx, ORDER.indexOf("mark"));
  }
  return carried;
};

const NO_SET = (route) =>
  `\nno candidate is made of these branches together: this project lands ${route} and asks an `
  + `independent judge between ${DEVELOPED} and ${TESTED}, so the candidate a turn is handed over is `
  + `a fact about the set it was built from, and a set half of which came back judged is one nothing `
  + `rebuilds. They are landed one at a time.`;

/** The verb: one finite task, the branches in the order they were named, as one candidate where the
 *  checkpoints allow it. A parked or handed-back branch is not the end of the run, because the branch
 *  after it is somebody else's release. */
export const landReady = async ({ flags, words }, ctx) => {
  if (!words.length) {
    stop(`land-ready takes the issues whose branches are ready, in the order they land:\n`
      + `    ${ctx.self} land-ready ISS-45`);
  }
  const tree = process.cwd();
  if (resolve(tree) !== resolve(ctx.root)) {
    stop(`land-ready is the checkout's verb and this is ${tree}, a worktree of ${ctx.root}. It builds `
      + `each candidate in a tree of its own and touches no run's: land from ${ctx.root}.`);
  }
  const ms = waitMs(flags);
  /* Read once and carried: a project answering neither line is said, never defaulted. A null is not refused — it is both a failed read and a project holding no config, and the second must still land, so a failed read downgrades an independent judge to the builder (ISS-699 owns that conflation). */
  const policy = await asked(() => releasePolicy());
  const route = landingRoute(policy, landingScope()).value;
  const judgement = judgementOf(policy);
  if (judgement === INDEPENDENT && route !== BEFORE_MERGE && route !== AFTER_MERGE) {
    stop(`this project asks for an independent judge between developed and tested and says nothing `
      + `about where the merge sits, so nothing here knows whether the judgement comes before the `
      + `push or after it. Set the branches on the project's record, or the \`landing\` key in `
      + `.forge.json, and land again: forge doctor`);
  }
  console.log(`\nlanding ${route}, judgement ${judgement}`);
  const held = [];
  const read = [];
  for (const key of words) {
    let one = null;
    try {
      one = await readOf(key);
      held.push({ key, ...await taken(key, one) });
    } catch (error) {
      if (!(error instanceof Stop)) throw error;
      console.error(`${key} is not this landing's to take and nothing of it has moved: ${error.message}`);
      if (one) read.push({ key, documentId: one.documentId });
      process.exitCode = 1;
    }
  }
  const full = { ...ctx, ms, route, judgement };
  const alone = async (one) => {
    console.log(`\n=== ${one.key}`);
    await landSet([one], full, one.from);
  };
  /* Ordered rather than taken as typed: a checkpoint holding a release this landing meant to push is
     finished first, a landing pushing past it voiding a release whose gate is already paid for. */
  const carried = [];
  for (const one of held.filter((member) => member.landing.intended)) {
    await alone(one);
    carried.push(...await carriedOn(one, held, full));
  }
  /* Read and never taken: a key past the lander's turn still names the release that carried another. */
  for (const one of read) carried.push(...await carriedOn(one, held, full));
  const rest = held.filter((member) => !member.landing.intended && !carried.includes(member));
  const judged = judgement === INDEPENDENT && route === BEFORE_MERGE;
  const eligible = judged ? [] : rest.filter((member) => setMember(member.landing));
  const set = eligible.length > 1 ? eligible : [];
  let over = [];
  if (set.length) {
    console.log(`\n=== ${set.map((one) => one.key).join(" ")}, as one candidate`);
    console.log(`  ${set.length + 1} gate run(s) at most: one for the candidate, and one for each `
      + `branch where it is red and they are landed alone — and one more of any of them where `
      + `${ctx.base} moves under a pin`);
    over = await landSet(set, full, 0);
  } else if (judged && rest.length > 1) {
    console.log(NO_SET(route));
  }
  const left = [...rest.filter((one) => !set.includes(one)), ...over];
  for (const key of words) {
    const one = left.find((member) => member.key === key);
    if (one) await alone({ ...one, from: ORDER.indexOf(owedAt(one.landing)) });
  }
};
