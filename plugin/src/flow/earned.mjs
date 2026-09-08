/* What an issue's record earns: the contract's flow table, one entry check per status, and the
   record read whole into one object. The verb that spends this is advance.mjs; nothing here
   writes, fetches or reads the repository. What it checks against is the contract's table for that
   status, printed by `forge guide contract`. */
import {
  FINDINGS, SHAPES, TRIAGES, criteriaUncovered, looksTo, planFlags, planSteps, planTyped,
  sectionsOwed, stepsUncited, unwrap,
} from "./machine.mjs";
import { judgedHead, landingMoved, landingWrote, markedCommit, mergedForm, reviewedHead } from "./record/merged.mjs";
import { eachProblem } from "./record/content.mjs";
import { FORMS } from "../spec/parse.mjs";
import { lightens } from "../ladder.mjs";
import { sizeReport } from "../ladder-report.mjs";
import { attachmentNames, evidenceHeld, isCommit, sameCommit } from "../tracker/evidence.mjs";

import { Refused } from "../refusal.mjs";
import { FIELD as SESSION, landingOf } from "./lease.mjs";
import { judgeAsk, judgeProblems, numbered } from "./qa/verdicts.mjs";
import { criteriaLines } from "./record/record.mjs";
import { assemble, parse } from "./record/page.mjs";
import { CONTRACT } from "../guides/contract.mjs";
import { waitsForPerson } from "../tracker/project-config.mjs";

/* The contract's flow table in its own order: the sequence is the rule, so listing it is the point. */
export const ORDER = [
  "open", "confirmed", "clarified", "approved", "in_progress", "developed", "tested", "released", "closed",
];

/* The method's phases, numbered as the guide numbers them and indexed by that number. The one table: the flow table below builds its phrases from it and the transcript miner counts a run's calls against it, so phase 5 is one phase rather than two that shared a number and meant "prove" in one reading and "ship" in the other (ISS-700, BR-09). */
export const PHASES = [
  "0 Project", "1 Triage", "2 Clarify", "3 Plan", "4 Implement", "5 Prove", "6 Note", "7 Ship", "8 Learn",
];

/* The flow table's last column: which phase a status owes, and where its method lives — the
   reference the phase cites, or null where the body itself carries the phase. ISS-18 owns typing
   it; a pointer beats a number nobody can look up. */
export const PHASE = {
  open: [PHASES[1], null],
  confirmed: [PHASES[2], null],
  clarified: [PHASES[3], null],
  approved: [`${PHASES[4]}, to the branch`, "verification"],
  in_progress: [`${PHASES[4]}, to the review; ${PHASES[5]}; then 7's landing`, "verification"],
  developed: [PHASES[5], "verification"],
  /* The contract's cell abbreviates the note's phase to its number, and this table mirrors that cell for cell: `forge guide contract tested` is what a reader is held to. */
  tested: [`6, ${PHASES[7]}`, null],
  released: [`${PHASES[7]}, the close`, null],
  closed: ["none", "learning"],
  dropped: ["none", "learning"],
  reopen: [`${PHASES[1]}, of the person's finding`, null],
};

export const methodOf = (status) => {
  const held = PHASE[status];
  if (!held) return null;
  return { phase: held[0], reference: held[1] ? `forge guide issue-flow ${held[1]}` : "forge guide issue-flow" };
};

/* Which reader each park kind speaks to, and so which side status it lands in. Every kind in PARKS has a row: a park with nowhere to go is a status set from nothing. */
/** The status on which the tracker reads any comment as the reporter's answer and puts the issue back to `open` (ISS-429): the one a park's record goes up on before its move, and the one an override is refused on. */
export const ANSWERED_BY_COMMENT = "needs_info";

export const PARK_STATUS = {
  question: ANSWERED_BY_COMMENT,
  "screen-review": "waiting",
  "destructive-migration": "waiting",
  "release-decision": "waiting",
  "code-review": "waiting",
  "rolled-back": "on_hold",
  "no-way-back": "on_hold",
  unshippable: "on_hold",
  blocked: "on_hold",
  paused: "on_hold",
  crashed: "on_hold",
  dropped: "dropped",
};

export const SIDE = [ANSWERED_BY_COMMENT, "waiting", "on_hold"];

export const atLeast = (status, floor) =>
  ORDER.indexOf(status) >= 0 && ORDER.indexOf(status) >= ORDER.indexOf(floor);

/* `parse` resolves the keys and applies none of the shape's rules, so a comment carrying the tag and
   little else — by hand, or through a client no gate sits before — is measured against the write's
   own rules here: every field, the stamp the write reads off the issue, the evidence, the contract.
   A commit that is not one compares equal to a short sha by prefix, which is why the form counts. */
export const shapeGaps = (kind, record, names = []) => {
  const shape = SHAPES[kind];
  const got = Object.fromEntries(shape.fields.map((field) =>
    [field.flag, field.many ? record.fields[field.flag] ?? [] : record.fields[field.flag]]));
  const gaps = shape.fields
    .filter((field) => {
      const held = got[field.flag];
      if (field.many) return held.length < (field.least ?? 1);
      if (held === undefined) return !field.optional && !field.newer;
      return Boolean(field.oneOf) && !field.oneOf.includes(held);
    })
    .map((field) => `--${field.flag}`);
  for (const field of shape.fields) {
    const held = got[field.flag];
    if (field.many) {
      const said = eachProblem(field, held);
      if (said) gaps.push(`--${field.flag}, which ${said}`);
      continue;
    }
    if (held === undefined) continue;
    if (field.commit && !isCommit(held)) gaps.push(`--${field.flag} \`${held}\`, which is no commit`);
    if (field.criterion && !/^\d+\b/u.test(held)) gaps.push(`--${field.flag} \`${held}\`, which opens with no number`);
  }
  if (shape.stamp && record.fields[shape.stamp.flag] === undefined) gaps.push(`its ${shape.stamp.label} stamp`);
  if (!(record.contract >= 1 && record.contract <= CONTRACT)) {
    return [...gaps, `a contract ${record.contract} record, and this build reads contract 1 to ${CONTRACT}`];
  }
  for (const field of shape.fields.filter((one) => one.evidence)) {
    for (const ref of got[field.flag]) {
      if (!evidenceHeld(ref, names)) gaps.push(`--${field.flag} \`${ref}\`, which is no attachment here, no URL and no commit`);
    }
  }
  const said = shape.check?.(got);
  return said ? [...gaps, said] : gaps;
};

export const criteriaOf = (issue) => {
  try {
    return criteriaLines(unwrap(issue.acceptanceCriteria));
  } catch (error) {
    if (error instanceof Refused) return [];
    throw error;
  }
};

/* Whole first: `dropped` has no checks of its own, so a confirmation carrying the finding and
   nothing else would drop an issue on one line. */
export const dispositionOf = (view) => {
  const held = view.latest?.confirmation;
  if (!held || shapeGaps("confirmation", held.record, view.names ?? []).length) return null;
  const finding = held.record.fields.finding;
  return FINDINGS.includes(finding) && finding !== "holds" ? finding : null;
};

export const stepAfter = (status) => {
  const at = ORDER.indexOf(status);
  return at < 0 || at === ORDER.length - 1 ? null : ORDER[at + 1];
};

export const nextOf = (status, view) =>
  (status === "confirmed" && dispositionOf(view) ? "dropped" : stepAfter(status));

export const need = (what, command) => ({ what, command });

/* The park is a look at the evidence either way, which the project's own policy may say it does
   not want: the declaration is the plan's and whether a person is waited for is the project's. */
export const personLooks = (flags, policy = null) =>
  (policy && !waitsForPerson(policy) ? null : looksTo(flags));

/* Every correction, not the latest: the kind does not repeat, so a plan one erases a re-size (ISS-161). Kept on the view once read: it parses every comment on the issue, and four readers ask for it. */
const correctionsIn = (view) => (view.moved ??= view.comments
  .map((one) => parse(one.body ?? ""))
  .filter((one) => one?.kind === "correction" && !shapeGaps("correction", one, view.names).length)
  .map((one) => one.fields.moved));

export const sizeOf = (view) => (view.size ??= {
  plan: unwrap(view.issue.plan),
  moved: correctionsIn(view),
  whole: view.whole !== false,
  band: view.issue.complexity ?? null,
});

export const lightPath = (view, status) => lightens(status, sizeOf(view));
export const fixReport = (view, ref) => sizeReport(sizeOf(view), ref);

export const setForm = (ref, status) =>
  `forge advance ${ref} --set ${status} --why "<why this status is set with nothing earning it>"`;

/* The tracker answers this on the edge itself, so the check reads the edge rather than inferring an
   order from the list it arrived in: `relations.blockedBy` carries mentions beside orderings. `kind`
   is the fallback where no such field came, and an edge carrying neither came from somewhere else. */
const gatesDispatch = (edge) =>
  edge.gatesDispatch === undefined ? edge.kind === "blocks" : edge.gatesDispatch === true;

/* The tracker gates on a merged mark and this contract's floor is `developed`, so the status is a
   second and independent test — the *blocker's*, which a caller reading the blocker's own row names. */
export const holdsBackFrom = (edge, blocker) => gatesDispatch(edge) && !atLeast(blocker, "developed");
export const holdsBack = (edge) => holdsBackFrom(edge, edge.otherStatus);

export const ordersSaid = (edge, blocker) => {
  if (edge.expired) return "the edge expired";
  if (!gatesDispatch(edge)) return `a ${edge.kind ?? "kindless"} edge orders none`;
  return `the blocker is ${blocker ?? "unread"}`;
};

/* Named in the refusal: an ordering constraint and a mention read alike on a line of their own. */
const edgeKind = (edge) => (edge.kind ? `a ${edge.kind} edge` : "an edge whose kind the tracker did not name");

export const blockersOwed = ({ issue }) =>
  (issue.relations?.blockedBy ?? [])
    .filter(holdsBack)
    .map((one) =>
      need(
        `${one.otherDisplayId} gates this by ${edgeKind(one)} and is ${one.otherStatus}, which is not yet developed`,
        `forge advance ${one.otherDisplayId}`,
      ),
    );

/* One shape, four answers: absent, rewritten, present but not a whole payload, or there to be read.
   A rewritten record is named as itself rather than as the fields it appears to lack: the write
   supplied them, and a list of flags to re-supply sends the author back to a command that worked. */
export const payloadOwed = (view, kind, what, ask) => {
  const held = view.latest[kind];
  if (!held) return [need(what, ask)];
  if (held.record.rewritten) {
    return [need(
      `the ${kind} on the record was rewritten by the project's prose pipeline, so no key of this `
        + `shape reads back from it; write it again on this build, which sends the payload in a `
        + `fenced block the rewrite copies as written`,
      ask,
    )];
  }
  const gaps = shapeGaps(kind, held.record, view.names);
  return gaps.length
    ? [need(`the ${kind} on the record is not a whole payload: it lacks ${gaps.join(", ")}`, ask)]
    : [];
};

const reviewOwed = (view, ref) => {
  const merged = markedCommit(view.comments);
  const reviewed = reviewedHead(view.comments);
  const ask = `forge record review ${ref} --reviewer codex --commit ${merged ?? "<sha>"} `
    + `--outcome approved --finding "F1 accepted"`;
  const owed = payloadOwed(view, "review", "no code review of the head that landed", ask);
  if (owed.length) return owed;
  const held = view.latest.review.record.fields;
  const judged = held.commit;
  if (held.outcome !== "approved") return [need(`the latest review of ${judged} says ${held.outcome}`, ask)];
  const landed = merged && sameCommit(judged, merged);
  if (merged && !landed && !(reviewed && sameCommit(judged, reviewed))) {
    return [need(
      `the review judged ${judged}, and the mark names ${merged}` + (reviewed ? ` from head ${reviewed}` : ""),
      ask,
    )];
  }
  return [];
};

/* Both verdict shortfalls fold here, so neither drifts into the other's shape (ISS-297): several
   criteria are one item and one write, shared flags before the first --criterion `blocksIn` splits on. */
const askOne = (ref, number, commit) =>
  `forge record verdict ${ref} --criterion ${number} --verdict pass --commit ${commit} `
  + `--evidence <attachment|url|sha>`;
const askAll = (ref, numbers, commit) =>
  `forge record verdict ${ref} --commit ${commit} --evidence <attachment|url|sha>`
  + numbers.map((number) => ` --criterion ${number} --verdict pass`).join("");
const foldVerdicts = (ref, numbers, commit, one, many) =>
  (numbers.length > 1
    ? [need(many(numbers.join(", ")), askAll(ref, numbers, commit))]
    : numbers.map((number) => need(one(number), askOne(ref, number, commit))));

/* One item for the set: fourteen copies of one path list is what a run reads past. */
const equivalenceOwed = (view, ref, judged, moved, numbers) => {
  const at = `the verdict${numbers.length > 1 ? "s" : ""} on criterion ${numbers.join(", ")}`;
  if (moved === null) {
    return need(
      `${at} judged ${judged}, which the mark names as the judged head, and the mark says nothing `
        + `about what the landing moved, so nothing says those verdicts survived it`,
      mergedForm(ref),
    );
  }
  return need(
    `the landing moved ${moved.join(", ")}, which this change touched, so ${at} judged ${judged} `
      + `and the evidence was taken before those paths moved`,
    `forge record verdict ${ref} --criterion <n> --verdict pass --commit ${markedCommit(view.comments)} `
      + `--evidence <attachment|url|sha>`,
  );
};

/* A landing brings other people's commits and leaves this change's own diff alone, so a verdict
   judged before it judged the code that landed; the review's recheck at the landed head guards the
   tree they sit on. The note carries the predicate because git is asked where it can answer (ISS-156). */
const verdictsOwed = (view, ref) => {
  const merged = markedCommit(view.comments);
  const judged = judgedHead(view.comments);
  const moved = judged ? landingMoved(view.comments) : null;
  const stands = Boolean(judged) && moved?.length === 0;
  const ask = (number) => askOne(ref, number, merged ?? "<sha>");
  const out = foldVerdicts(ref, view.owed, merged ?? "<sha>",
    (number) => `criterion ${number} has no verdict`,
    (listed) => `criteria ${listed} have no verdict`);
  const atJudged = [];
  for (const [number, { record }] of numbered(view.verdicts)) {
    const held = record.fields;
    const gaps = shapeGaps("verdict", record, view.names);
    if (gaps.length) out.push(need(`the verdict on criterion ${number} lacks ${gaps.join(", ")}`, ask(number)));
    else if (held.verdict === "fail") out.push(need(`criterion ${number} failed its verdict`, ask(number)));
    else if (!merged || sameCommit(held.commit, merged)) continue;
    else if (judged && sameCommit(held.commit, judged)) {
      if (!stands) atJudged.push(number);
    } else {
      out.push(need(`the verdict on criterion ${number} judged ${held.commit}, and the merged commit is ${merged}`, ask(number)));
    }
  }
  if (atJudged.length) out.push(equivalenceOwed(view, ref, judged, moved, atJudged));
  /* A verdict the reader could key by nothing is named as itself: an item naming the criterion it
     does not carry is the shortfall a rewrite invented, and no command supplies it. */
  for (const one of view.unreadable ?? []) {
    out.push(need(
      `a verdict written ${one.at.slice(0, 16)} names no criterion this build can read`
        + `${one.record.rewritten ? ", because the prose pipeline rewrote its keys" : ""}`,
      ask("<n>"),
    ));
  }
  return out;
};

/* One reopen, one finding, one triage, matched by the reopen each was written at: routed on the
   latest instead, a second look would be ruled on by the ruling on the first. The count is the
   tracker's, so a tracker that never raises it leaves every record at reopen zero and the pair is
   whichever was written — which is what a first reopen owes anyway. */
export const atThisReopen = (view, kind) => {
  const count = String(view.issue.reopenCount ?? 0);
  const held = (view.repeated?.[kind] ?? []).filter((one) => one.record.fields.reopen === count);
  return held.length ? held.at(-1) : null;
};

/* A reopen sends the judging back to its start: a wrong-test triage moves the criteria and no commit
   with them, so every verdict on the record still names the merged commit and would pass again. */
const judgedSince = (view, ref) => {
  const held = atThisReopen(view, "triage");
  const outcome = held?.record.fields.outcome;
  if (!outcome || outcome === TRIAGES[2]) return [];
  /* Only the criteria the issue still has: a wrong-test correction may drop or renumber the one
     that was wrong, and a verdict asked for on a number the field no longer holds is refused at the
     write, which would leave the issue unable to reach `tested` at all. */
  const current = new Set(view.criteria.map((one) => one.number));
  const stale = numbered(view.verdicts)
    .filter(([number, one]) => current.has(number) && one.at <= held.at)
    .map(([number]) => number);
  /* No commit to read: whatever answers the finding has no sha on the record yet. */
  return foldVerdicts(
    ref,
    stale,
    "<sha>",
    (number) => `the verdict on criterion ${number} was written before this reopen's triage, and a reopen judges again`,
    (listed) => `the verdicts on criteria ${listed} were written before this reopen's triage, and a reopen judges again`,
  );
};

/* On what the run said of itself, never on a ledger this plugin cannot see: a scoped run reports no
   red for what it skipped, and a baseline naming no scope predates the field and is excused. */
const wholeOwed = (view, ref) => {
  const held = view.latest.baseline?.record.fields;
  if (held?.scope !== "part") return [];
  return [need(
    `the baseline says \`${held.gate}\` measured part of the tree, so what it did not run has no `
      + `answer and a green after it stands on nothing`,
    `forge record baseline ${ref} --gate "${held.gate}" --result "<what already fails>" `
      + `--commit <sha> --scope whole`,
  )];
};

/* A URL and a sha are citations; an attachment is the thing itself, and a screen is the one change
   whose proof is that somebody looked. `skipped` is exempt: there was nothing to look at. */
const shownOwed = (view, ref) => {
  if (view.flags.screen !== "yes") return [];
  /* Current criteria only, as `judgedSince` reads: asked for again on a dropped number, the write refuses. */
  const current = new Set(view.criteria.map((one) => one.number));
  const numbers = [...view.verdicts]
    .filter(([number]) => current.has(number))
    .filter(([, one]) => one.record.fields.verdict !== "skipped")
    .filter(([, one]) => !(one.record.fields.evidence ?? []).some((cited) => view.names.includes(cited)))
    .map(([number]) => number)
    .sort((one, two) => one - two);
  if (!numbers.length) return [];
  const at = numbers.length > 1 ? `criteria ${numbers.join(", ")}` : `criterion ${numbers[0]}`;
  return [need(
    `the plan declares a screen change, and the verdict on ${at} cites no attachment this issue `
      + `carries, so nothing on the record is a thing a person looked at`,
    `forge attach issue ${ref} <the rendered state>, then forge record verdict ${ref} `
      + `--commit ${markedCommit(view.comments) ?? "<sha>"} --evidence <that attachment>`
      + numbers.map((number) => ` --criterion ${number} --verdict pass`).join(""),
  )];
};

const judgeOwed = (view, ref) => judgeProblems(view)
  .map(({ number, why }) => need(`the verdict on criterion ${number} ${why}`, judgeAsk(ref, number, view.landing)));

export const verificationForm = (ref, commit, evidence, tail = "") =>
  `forge record verification ${ref} --where "<where it runs>" --commit ${commit} `
  + `--evidence ${evidence}${tail}`;

/* Nothing here can run a deploy — the machine that advances need not be the one that shipped — so where the config says production deploys on its own, the verification is asked to prove one happened, out of two values the record already holds. docs/cli/the-entry-checks.md.
   The test is `autoProd` alone — `pipelineConfig.autoProdDeploy`, as `releaseFrom` reads it — and deliberately not `waitsForPerson`, which answers a different question off the branch pair. Neither branch is consulted here, so a project with either shape of branches owes the proof when that flag is true (ISS-428).
   `verificationForm` above is the one spelling of the sentence and not of its flags, which are literals in it and are spelled again on `SHAPES.verification` and in `record.mjs`'s usage row; each caller keeps its own placeholders, because what a missing record is asked for and what a deploy is asked to prove are not one sentence. */
const deployOwed = (view, ref) => {
  if (!view.release?.autoProd) return [];
  const held = view.latest.verification.record.fields;
  const merged = markedCommit(view.comments);
  const asks = (commit, tail = "") => verificationForm(ref, commit, "<the deployment's build log>", tail);
  const out = [];
  if (merged && !sameCommit(held.commit, merged) && !sameCommit(held.contains, merged)) {
    out.push(need(
      `the verification says ${held.commit} is running and the merged mark says this change landed `
        + `at ${merged}, and nothing says the two are the same code. The sha is read from the `
        + `deployment's own build log and never from the branch head: verify the build that reports `
        + `${merged}, or where the host built a later head, say that ${merged} is in it`,
      asks("<the sha that build reports>", ` --contains ${merged}`),
    ));
  }
  if ((held.evidence ?? []).every((one) => isCommit(one))) {
    out.push(need(
      `every evidence item on the verification is a bare commit sha, and a sha names no deployment, `
        + `so nothing on the record says one ran for ${merged ?? "this change"}`,
      asks(merged ?? "<the sha the deployment built>"),
    ));
  }
  return out;
};

/* A whole path or nothing, prefixes included; a trailing dot ends a sentence unless a name follows. */
const namesPath = (named, path) =>
  new RegExp(`(?<![\\w./-])${path.replace(/[$()*+.?[\\\]^{|}]/gu, "\\$&")}(?![\\w/-])(?!\\.\\w)`, "u").test(named);

/* The plan's own text and not a path list, a plan being prose; `wrote` is not `moved`. A tier below
   `feature` writes no plan, and refusing against a list the ladder excused would take that rung back. */
const unplannedIn = (view) => {
  const wrote = landingWrote(view.comments);
  if (!wrote) return [];
  const named = [unwrap(view.issue.plan), ...correctionsIn(view)].join("\n");
  if (!named.trim()) return [];
  return wrote.filter((path) => !namesPath(named, path));
};

const scopeOwed = (view, ref) => {
  const outside = unplannedIn(view);
  if (!outside.length) return [];
  return [need(
    `the landing wrote ${outside.join(", ")}, which the plan does not name and no correction names `
      + `either, so the change grew and the record does not say where`,
    `forge record correction ${ref} --moved "the change also wrote ${outside.join(", ")}" `
      + `--why "<why each was needed>"`,
  )];
};

/* One entry check per status, each answering with what the record lacks and the write that supplies
   it. Nothing here reads the repository: what git knows was written on at the step that knew it. */
export const CHECKS = {
  confirmed: (view, ref) =>
    payloadOwed(
      view,
      "confirmation",
      "no confirmation: where you looked, what the issue is in the code's own terms, and the finding",
      `forge record confirmation ${ref} --where <where> --is "<what it is>" --finding holds`,
    ),
  clarified: (view, ref) =>
    (lightPath(view, "clarified") ? [] : payloadOwed(
      view,
      "decision",
      "no decision record: each reading decided with its assumption and undo, or an explicit none",
      `forge record decision ${ref} --decision "reading | assumption | undo"`,
    )),
  approved: (view, ref) => {
    const out = [];
    const plan = unwrap(view.issue.plan);
    const { flags } = view;
    /* Absent, the declarations read `no` in every reader downstream, so a fix defaults nothing here. */
    const asks = !lightPath(view, "approved");
    if (asks && !plan) out.push(need("the plan field is empty", `forge record plan ${ref} <plan.md>`));
    else if (asks && (!flags.screen || !flags.schema)) {
      out.push(need(
        "the plan declares neither `Screen change: yes|no` nor `Schema coupling: yes|no`, and the "
          + "two decide what the ship steps owe",
        `forge record plan ${ref} <plan.md>, with both lines in it`,
      ));
    }
    /* Read of the stored plan and not of the file, so a plan written by any route answers to it:
       the write judges what it is handed and this is what the record itself says. */
    if (asks && plan && !planTyped(plan)) {
      out.push(need(
        `the plan is untyped — it carries none of the sections a typed plan owes: ${sectionsOwed(plan, flags).join(" · ")}`,
        `forge record plan ${ref} <plan.md>, each section opened by a heading whose text is its name`,
      ));
    } else if (asks && plan) {
      const owed = sectionsOwed(plan, flags);
      if (owed.length) {
        out.push(need(
          `the plan carries no ${owed.length === 1 ? "section" : "sections"} ${owed.map((name) => `\`## ${name}\``).join(", ")}`,
          `forge record plan ${ref} <plan.md>, with each in it`,
        ));
      }
      const steps = planSteps(plan);
      const bare = criteriaUncovered(steps, view.criteria);
      if (bare.length) {
        out.push(need(
          `no plan step names criterion ${bare.join(", ")}, so nothing the plan does serves ${bare.length === 1 ? "it" : "them"}`,
          `forge record plan ${ref} <plan.md>, with a step naming each as \`criteria: ${bare[0]}\``,
        ));
      }
      /* The write's own refusal, asked again over the criteria the write cannot see: a step citing a
         number the issue does not hold serves as little as one citing nothing. */
      const uncited = stepsUncited(steps, view.criteria);
      if (uncited.length) {
        const named = uncited.map((one) => (one.cites.length ? `${one.number} (citing ${one.cites.join(", ")})` : `${one.number}`));
        out.push(need(
          `plan step ${named.join(", ")} ${uncited.length === 1 ? "serves" : "serve"} no criterion this issue holds, `
            + `so no verdict reaches what ${uncited.length === 1 ? "it does" : "they do"}`,
          `forge record plan ${ref} <plan.md>, with \`criteria: <n>\` on each, from ${view.criteria.map((one) => one.number).join(", ")}`,
        ));
      }
    }
    if (!view.criteria.length) {
      out.push(need("the criteria field holds no numbered line `N. outcome`", `forge record criteria ${ref} <criteria.md>`));
    }
    /* Called here and nowhere else, so a transition with no citation to weigh reads no tree. A list and empty, never falsy — an empty array is truthy. Which absence is which: `citedClauses`. */
    const cited = view.cited?.();
    if (cited && !cited.length) {
      out.push(need(
        "no clause of this project's requirements tree is named by the description, the plan or the "
          + `criteria, and a citation is \`<id>~<rev>\` — ${FORMS}`,
        `forge record criteria ${ref} <criteria.md>, with a criterion opening \`<id>~<rev>:\``,
      ));
    }
    return out;
  },
  in_progress: (view, ref) => {
    const baseline = payloadOwed(
      view,
      "baseline",
      "no baseline: the gate, what it already reports and the commit it ran at",
      `forge record baseline ${ref} --gate "<command>" --result "<what already fails>" --commit <sha> --scope whole`,
    );
    return [...blockersOwed(view), ...baseline, ...wholeOwed(view, ref)];
  },
  developed: (view, ref) => {
    const out = [];
    if (!view.issue.mergedAt) out.push(need("no merged mark, so nothing says the change landed", mergedForm(ref)));
    else if (!markedCommit(view.comments)) {
      out.push(need("the merged mark names no commit; its note carries it as `at <sha>`", mergedForm(ref)));
    }
    return [...out, ...scopeOwed(view, ref), ...reviewOwed(view, ref)];
  },
  tested: (view, ref) => {
    if (!view.criteria.length) {
      return [need("the criteria field holds no numbered line, so there is nothing to judge", `forge record criteria ${ref} <criteria.md>`)];
    }
    const out = [...verdictsOwed(view, ref), ...judgedSince(view, ref), ...shownOwed(view, ref), ...judgeOwed(view, ref)];
    if (view.flags.schema === "yes" && !view.names.length) {
      out.push(need(
        "the plan declares schema coupling, and no attachment carries the migration risk classification",
        `forge attach issue ${ref} <classification>`,
      ));
    }
    return out;
  },
  released: (view, ref) => {
    const verification = payloadOwed(
      view,
      "verification",
      "no verification: where the change now runs, at which commit, and the evidence",
      verificationForm(ref, "<sha>", "<attachment|url|sha>"),
    );
    /* One or the other: a payload with gaps has no fields to compare against anything. */
    const out = verification.length ? verification : deployOwed(view, ref);
    if (!view.issue.releaseNotes?.section && !lightPath(view, "released")) {
      out.push(need("no release note and no withholding either", `forge record note ${ref} --section Added --user "<what the reporter sees>"`));
    }
    const declared = personLooks(view.flags, view.release);
    if (declared && !answered(view, "screen-review")) {
      out.push(need(
        `the plan declares ${declared}, and no person has answered since it was parked for review`,
        `forge advance ${ref} --park screen-review --why "<why>" --evidence <attachment|url|sha>`,
      ));
    }
    return out;
  },
  closed: () => [],
  dropped: () => [],
};
/* The whole record in one object, so every check reads fields rather than fetching. `cited` is the one argument passed unevaluated: resolving an issue's clauses walks the checkout, which only the `approved` check has a reason to do, and a caller handing over the answer would make every other transition pay for it and fail where the checkout is unreadable. */
export const viewFrom = (documentId, issue, comments, cut = null, release = null, cited = null, deploy = null) => {
  const criteria = criteriaOf(issue);
  const names = attachmentNames(issue, comments);
  /* Parsed once: six readers here and in route.mjs each ran it over the same plan for the same answer. */
  const flags = planFlags(unwrap(issue.plan));
  return { documentId, issue, comments, criteria, names, cut, whole: !cut, release, cited, deploy, flags, landing: landingOf(issue?.[SESSION]), ...assemble(comments, criteria) };
};
export const parkRecord = (view, wanted = () => true, since = null, until = null) => {
  const found = view.comments
    .filter((one) => (!since || (one.createdAt ?? "") > since) && (!until || (one.createdAt ?? "") < until))
    .map((one) => ({ comment: one, record: parse(one.body ?? "") }))
    .filter((one) => one.record?.kind === "park" && wanted(one.record.fields.kind))
    .filter((one) => !shapeGaps("park", one.record, view.names).length);
  return found.length ? found.at(-1) : null;
};

export const SILENT = "on_hold";
const ANNOUNCED = /—\s*moved from `[a-z_]+`$/u;
const announcements = (view) =>
  view.comments.filter((one) => ANNOUNCED.test(unwrap(one.body).split("\n")[0]?.trim() ?? ""));
export const announcedAt = (view) => announcements(view).at(-1)?.createdAt ?? null;

/* The park that set a side status, not the newest of a kind: `waiting` files after the announcement
   and `needs_info` before it (ISS-429); `on_hold` announces nothing and reads as it did (ISS-420). */
export const parkThatSet = (view, status) => {
  const wanted = (one) => PARK_STATUS[one] === status;
  if (status === SILENT) return parkRecord(view, wanted);
  const said = announcements(view).map((one) => one.createdAt);
  if (!said.length) return null;
  return status === "needs_info"
    ? parkRecord(view, wanted, said.at(-2) ?? null, said.at(-1))
    : parkRecord(view, wanted, said.at(-1));
};

/* A screen is the change a deploy does not undo for whoever already read it, so a person answers: a
   comment from a token that is not a device's, later than the park. An agent on a person's PAT can. */
export const answered = (view, kind) => {
  const asked = parkRecord(view, (one) => one === kind);
  return Boolean(asked) && view.comments.some(
    (one) => !one.authorDeviceId && (one.createdAt ?? "") > (asked.comment.createdAt ?? ""),
  );
};
