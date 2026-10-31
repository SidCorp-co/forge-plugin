/* A landing built by hand, recorded in one call in the order core's direct mode names
   (`masters/owed.ts` DIRECT_ORDER): the lease, the merge mark at a sha the remote base carries, the
   move to `awaiting_release` with that sha as its reason, the comment, and the lease back last. Each
   step's refusal stops the call by name and says which steps already happened, since four separate
   calls failing apart (NO_HOLDER, NO_OP) is what this replaces. docs/cli/record-landed.md. */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { Refusal, fail, refusing } from "../../resolve/settings.mjs";
import { Refused } from "../../refusal.mjs";
import { flags } from "../../resolve/flags.mjs";
import { usageOf } from "../../resolve/visibility.mjs";
import { write } from "../../tracker/rest.mjs";
import { postComment } from "../../tracker/comments.mjs";
import { isCommit, sameCommit } from "../../tracker/evidence.mjs";
import { releasePolicy } from "../../tracker/project-config.mjs";
import { commitCarries } from "../../git/carries.mjs";
import { issueOf } from "./thread/posting.mjs";
import { markMerged } from "./merged.mjs";
import { FIELD, HOLDING, leaseOf, oweRelease, releaseOwed, renew, stateOf } from "../lease.mjs";
import { sessionOf } from "../../resolve/config.mjs";

export const LANDED = "landed";
const WHOLE_SHA = /^[0-9a-f]{40}$/u;
const REMOTE = "origin";
/* Where a claim may start from (`@forge/contracts/issue-machine:TAKEABLE_STATUSES`); from any of
   them the move to `awaiting_release` is no edge until the issue is taken to `in_progress`. */
const TAKEN_FROM = ["open", "approved", "reopen"];
const HELD_AT = "in_progress";
const RESTS_AT = "awaiting_release";

export const LANDED_ROW = "  landed       --sha <40-hex> [--reason R] [--comment-file F] [--dry-run]";

export const LANDED_BLOCKS = [
  "A landing built by hand, recorded in one call in the order core's direct mode names. In order:",
  "  1. the lease: taken where nothing holds the issue, renewed where this run holds it, refused where",
  "     another run does; an issue at open, approved or reopen is then taken to in_progress",
  "  2. merged: the sha is read against the remote base branch, fetched first, and the mark is",
  "     written at it only where that branch carries it",
  `  3. awaiting_release: the move, with the sha as its reason (and --reason after it)`,
  "  4. the comment: --comment-file, or one line naming the sha, the base and the commit's subject",
  "  5. the lease handed back, the last write",
  "A step already standing is said and not made again: a mark at this sha, an issue already at",
  "awaiting_release. A step refused stops the call by name, says which steps already happened, and",
  "keeps the lease, so the same call made again resumes where it stopped. --dry-run reads the issue",
  "and the base, prints every call the run would make, in order, and sends none.",
];

/* One line per step done, so a refusal can say exactly what stands. */
const said = (done) => (done.length ? done.map((one) => `  done: ${one}`).join("\n") : "  done: nothing");

const stopped = (ref, step, why, done) => fail(`record landed on ${ref} stopped at ${step}: ${why}\n`
  + `What already happened:\n${said(done)}\nNothing after it was sent. The lease stays with this run, `
  + `so the same call made again resumes from here.`);

/* The base, fetched from the remote into its tracking ref, and whether that ref carries the sha. */
const baseCarries = (sha, base) => {
  const fetched = spawnSync("git", ["fetch", "--quiet", REMOTE, `+refs/heads/${base}:refs/remotes/${REMOTE}/${base}`],
    { encoding: "utf8", timeout: 60_000, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } });
  if (fetched.error || fetched.status !== 0) {
    return { carries: null, why: `git fetch ${REMOTE} ${base} failed: ${String(fetched.stderr || fetched.error?.message || "").trim()}` };
  }
  return commitCarries(sha, `${REMOTE}/${base}`);
};

const subjectOf = (sha) => {
  const run = spawnSync("git", ["log", "-1", "--format=%s", sha], { encoding: "utf8" });
  return run.status === 0 ? run.stdout.trim() : "";
};

const commentOf = (given, { sha, base, reason }) => {
  if (given["comment-file"]) return readFileSync(given["comment-file"], "utf8");
  const subject = subjectOf(sha);
  return `Landed on \`${base}\` at ${sha}${reason ? `: ${reason}` : "."}${subject ? `\n\n${subject}` : ""}`;
};

const noteOf = (sha, base) => `merged to ${base} at ${sha}, landed by hand and recorded by forge record landed`;

const readFlags = (argv, ref) => {
  const usage = `${usageOf("record").replace("<kind>", LANDED)}\n${LANDED_ROW}`;
  const given = flags(argv, `record ${LANDED}`, ["--dry-run"], { usage });
  if (!given.sha) fail(`record ${LANDED} needs --sha: the whole 40-hex commit the change landed at on the base branch.`);
  const sha = String(given.sha).trim().toLowerCase();
  if (!WHOLE_SHA.test(sha) || !isCommit(sha)) {
    fail(`record ${LANDED}: --sha takes the whole 40-hex commit, as core's merge mark does (COMMIT_NOT_WHOLE), `
      + `not \`${given.sha}\`. Nothing was sent:\n  git rev-parse ${given.sha}`);
  }
  if (!ref || ref.startsWith("--")) fail(`record ${LANDED} takes the issue first:\n${usage}`);
  return { ...given, sha, dryRun: Boolean(given["dry-run"]) };
};

const plan = (ref, documentId, issue, { sha, base, reason }) => {
  const at = `/api/issues/${documentId}`;
  const state = stateOf(leaseOf(issue?.[FIELD]), sessionOf());
  const lease = HOLDING.includes(state) ? "renewed: this run holds it" : state === "free" ? "taken: nothing holds it"
    : `refused: ${state}`;
  return [
    `record landed ${ref} --dry-run: nothing is sent. The calls, in order:`,
    `  1. lease       PATCH ${at} {sessionContext.lease} — ${lease}`,
    ...(TAKEN_FROM.includes(issue.status) ? [`     take        POST ${at}/transition {toStatus: "${HELD_AT}"} — it stands at ${issue.status}`] : []),
    `  2. merged      git fetch ${REMOTE} ${base}; ${sha} must be on ${REMOTE}/${base}`,
    `                 POST ${at}/merge {commit: "${sha}", target: "base", note: "${noteOf(sha, base)}"}`,
    `  3. move        POST ${at}/transition {toStatus: "${RESTS_AT}", reason: "${sha}${reason ? `: ${reason}` : ""}"}`,
    `  4. comment     POST ${at}/comments {body}`,
    `  5. lease back  PATCH ${at} {sessionContext.lease released, holder emptied} — the last write`,
  ].join("\n");
};

/* Each step, in its order: a refusal stops the call naming what stands. */
const run = async (ref, given) => {
  const { documentId, body: issue } = await issueOf(ref);
  const base = (await releasePolicy())?.staging ?? null;
  if (!base) fail(`record ${LANDED} reads the remote base branch the sha must be on, and this project names none (baseBranch). Nothing was sent.`);
  const facts = { sha: given.sha, base, reason: given.reason ?? null };
  if (given.dryRun) return console.log(plan(ref, documentId, issue, facts));
  const done = [];
  const step = async (name, act) => {
    try {
      return await refusing(act);
    } catch (error) {
      if (error instanceof Refusal || error instanceof Refused) return stopped(ref, name, error.message, done);
      throw error;
    }
  };
  await step("1, the lease", () => renew(documentId, ref));
  done.push("the lease is this run's");
  if (TAKEN_FROM.includes(issue.status)) {
    const moved = await write("forge_issues", { action: "transition", documentId, data: { status: HELD_AT } }, undefined, true);
    if (moved?.refused) stopped(ref, `1, the take to ${HELD_AT}`, moved.refused, done);
    done.push(`moved ${issue.status} -> ${HELD_AT}`);
  }
  const carried = baseCarries(facts.sha, base);
  if (carried.carries !== true) {
    stopped(ref, "2, merged", `${facts.sha} is not on ${REMOTE}/${base}: ${carried.why ?? "git reads it as no ancestor"}. `
      + "Land it on the base branch first, or name the sha the base carries.", done);
  }
  if (sameCommit(issue.mergedCommitSha, facts.sha)) done.push(`already marked merged at ${facts.sha}`);
  else {
    await step("2, merged", () => markMerged(documentId, ref, noteOf(facts.sha, base), { leased: true, commit: facts.sha }));
    done.push(`marked merged at ${facts.sha} on ${base}`);
  }
  if (issue.status === RESTS_AT) done.push(`already at ${RESTS_AT}`);
  else {
    const moved = await write("forge_issues", { action: "transition", documentId,
      data: { status: RESTS_AT, reason: `${facts.sha}${facts.reason ? `: ${facts.reason}` : ""}` } }, undefined, true);
    if (moved?.refused) stopped(ref, `3, the move to ${RESTS_AT}`, moved.refused, done);
    done.push(`moved to ${RESTS_AT}, the sha its reason`);
  }
  const posted = await step("4, the comment", () => postComment(documentId, commentOf(given, facts), null, true));
  if (posted?.refused) stopped(ref, "4, the comment", posted.refused, done);
  done.push("the comment is up");
  for (const one of done) console.log(`${ref}  ${one}`);
  oweRelease(documentId, ref);
  await releaseOwed(console.log);
};

/** `forge record landed <ref> --sha <40-hex> [--reason R] [--comment-file F] [--dry-run]`. */
export const recordLanded = async (ref, argv) => run(ref, readFlags(argv, ref));
