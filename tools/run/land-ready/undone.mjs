/* Whether a change takes back work that landed under it (ISS-369): a replay resolved the wrong way, or
   stale copies staged by `git add -u` after one, leave a tree every gate passes with another run's
   landed hunks undone. Asked by both landing routes, the ship's step before its rebase and each
   member of a `land-ready` set, of the same three commits: where the branch was cut, the base the
   change sits on, and the head that would land. Edits nothing. */
import { git, gitOut, lines } from "../../checkout.mjs";
import { shortly } from "../install.mjs";

const HUNK = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/u;
const BLAMED = /^([0-9a-f]{40}) (\d+) (\d+)/u;
const WORDY = /[\p{L}\p{N}]/u;
const DECLARED = /^Undoes:\s*([0-9a-f]{7,40})\s*$/gimu;

/* Unquoted and untranslated, so a path outside ASCII reads as the path and a hunk as git wrote it. */
const asked = (tree, args) => git(["-c", "core.quotePath=false", ...args], tree);
const said = (tree, args) => {
  const run = asked(tree, args);
  return run.status === 0 ? run.stdout ?? "" : "";
};

/* The branch's reflog, oldest first, each entry the commit the branch moved to and when. */
const reflogOf = (tree, branch) => lines(said(tree, ["log", "-g", "--date=unix", "--format=%H %gd",
  `refs/heads/${branch}`, "--"])).map((line) => {
  const [sha, at] = [line.slice(0, 40), /@\{(\d+)\}$/u.exec(line)?.[1]];
  return { sha, at: Number(at ?? Number.NaN) };
}).reverse();

/** Where the branch was cut: the oldest entry of its own reflog, which `start` writes when it makes
 *  the branch and which a replay, a reset or a rebase leaves in place, taken to its merge base with
 *  the base the change sits on. `why` where that cannot be read, since silence and a clean reading
 *  would otherwise print alike. */
export const cutOf = (tree, branch, was) => {
  if (!branch) return { why: "HEAD is on no branch, so there is no reflog to read" };
  const entries = reflogOf(tree, branch);
  if (!entries.length) return { why: `refs/heads/${branch} holds no reflog in this repository` };
  const at = gitOut(["merge-base", entries[0].sha, was], tree);
  if (!at) return { why: `the first entry of ${branch}'s reflog shares no history with ${shortly(was)}` };
  return { at, entries };
};

/* `-U0` hunks, reset at each file's header so a `--- a/` line is never read as a removal. */
const hunksOf = (text) => {
  const out = [];
  let at = null;
  for (const line of text.split("\n")) {
    if (line.startsWith("diff --git ")) {
      at = null;
      continue;
    }
    const hunk = HUNK.exec(line);
    if (hunk) {
      at = { oldStart: Number(hunk[1]), oldCount: hunk[2] === undefined ? 1 : Number(hunk[2]),
        newStart: Number(hunk[3]), newCount: hunk[4] === undefined ? 1 : Number(hunk[4]), removed: [], added: [] };
      out.push(at);
    } else if (at && line.startsWith("-")) at.removed.push(line.slice(1));
    else if (at && line.startsWith("+")) at.added.push(line.slice(1));
  }
  return out;
};

const diffed = (tree, from, to, paths = []) =>
  hunksOf(said(tree, ["diff", "-U0", "--no-renames", "--no-color", "--no-ext-diff", from, to, "--", ...paths]));

const counted = (texts) => {
  const out = new Map();
  for (const one of texts) out.set(one, (out.get(one) ?? 0) + 1);
  return out;
};

const holdsAll = (pool, wanted) => [...counted(wanted)].every(([text, many]) => (pool.get(text) ?? 0) >= many);

/* Each line of the file at `was` as the commit that wrote it and its line number in that commit; with
   `--reverse` over a range, as the last commit of it that still had the line. */
const blameOf = (tree, was, file, how = []) => {
  const out = [];
  let at = null;
  for (const line of said(tree, ["blame", "--porcelain", ...how, was, "--", file]).split("\n")) {
    const head = BLAMED.exec(line);
    if (head) at = { sha: head[1], orig: Number(head[2]), final: Number(head[3]) };
    else if (at && line.startsWith("\t")) {
      out.push({ ...at, text: line.slice(1) });
      at = null;
    }
  }
  return out;
};

/** One hunk, judged over the lines of it still standing at the base that carry a letter or digit, a
 *  blank or a brace being whichever copy the diff happened to align: every one of them is removed,
 *  and fewer than half come back anywhere in the change, which is what a move does. Past that, a
 *  hunk that replaced lines is taken back where what it replaced comes back in this file, which a
 *  stale copy always does and a rewrite into new content does not; a hunk that only added lines
 *  leaves nothing to restore, so it is taken back where every commit that removed those lines was
 *  written before the branch first held the hunk — work a replay carried over it, as against an
 *  edit made by somebody who had it in front of them. */
export const takesBack = ({ standing, removed, addedAnywhere, addedHere, replaced, replayed }) => {
  const wordy = standing.filter((one) => WORDY.test(one.text));
  if (!wordy.length || !wordy.every((one) => removed.has(one.final))) return false;
  const back = wordy.filter((one) => (addedAnywhere.get(one.text) ?? 0) > 0).length;
  if (back * 2 >= wordy.length) return false;
  return replaced.length ? holdsAll(addedHere, replaced) : wordy.every((one) => replayed(one.final));
};

const removedAt = (hunks) =>
  new Set(hunks.flatMap((one) => Array.from({ length: one.oldCount }, (_, at) => one.oldStart + at)));

const cached = (make) => {
  const held = new Map();
  return (key) => {
    if (!held.has(key)) held.set(key, make(key));
    return held.get(key);
  };
};

/* When the branch first held a commit: the first reflog entry carrying it, or null where none does
   and the question has no answer here. */
const heldFrom = (tree, entries) => cached((sha) =>
  entries.find((one) => git(["merge-base", "--is-ancestor", sha, one.sha], tree).status === 0)?.at ?? null);

const authoredAt = (tree) => cached((sha) => Number(gitOut(["log", "-1", "--format=%at", sha], tree)));

/* Which commit of the change removed each line of the file at `was`: reverse blame names the last
   commit that still had it, and the one after that on the change's first-parent line removed it. */
const removersOf = (tree, was, head, file) => {
  const order = lines(gitOut(["rev-list", "--reverse", "--first-parent", `${was}..${head}`], tree));
  const out = new Map();
  for (const one of blameOf(tree, `${was}..${head}`, file, ["--reverse"])) {
    const next = one.sha === was ? order[0] : order[order.indexOf(one.sha) + 1];
    if (next) out.set(one.final, next);
  }
  return out;
};

const fileTakesBack = (tree, { was, head, file, landed, addedAnywhere, entries }) => {
  const mine = diffed(tree, was, head, [file]);
  const removed = removedAt(mine);
  if (!removed.size) return [];
  const addedHere = counted(mine.flatMap((one) => one.added));
  const blamed = blameOf(tree, was, file);
  const removers = cached(() => removersOf(tree, was, head, file));
  const [held, authored] = [heldFrom(tree, entries), authoredAt(tree)];
  return landed.filter((sha) => gitOut(["rev-parse", "--verify", "-q", `${sha}^`], tree)
    && diffed(tree, `${sha}^`, sha, [file]).some((hunk) => takesBack({
      standing: blamed.filter((one) => one.sha === sha && one.orig >= hunk.newStart
        && one.orig < hunk.newStart + hunk.newCount),
      removed, addedAnywhere, addedHere, replaced: hunk.removed,
      replayed: (line) => {
        const [from, by] = [held(sha), removers(file).get(line)];
        return from !== null && Boolean(by) && authored(by) < from;
      },
    })));
};

/* The files the change modifies or deletes, each with the landed commits that touched it. */
const touchedBy = (tree, cut, was, head) => {
  const files = lines(said(tree, ["diff", "--name-only", "--no-renames", "--diff-filter=MD", was, head]));
  const out = new Map();
  if (!files.length) return out;
  let sha = null;
  for (const line of lines(said(tree, ["log", "--no-merges", "--format=@%H", "--name-only", `${cut}..${was}`, "--", ...files]))) {
    if (line.startsWith("@")) sha = line.slice(1);
    else if (sha) out.set(line, [...(out.get(line) ?? []), sha]);
  }
  return out;
};

const declaredIn = (tree, was, head) =>
  [...said(tree, ["log", "--format=%B", `${was}..${head}`]).matchAll(DECLARED)].map((one) => one[1].toLowerCase());

/** The reading for `head` on `was`: `judged` false with `why` where the cut of `branch` cannot be
 *  read, and otherwise the cut, how many commits landed since, and each one the change undoes with
 *  its subject and the files it lost.
 *  A commit a message of the change names as `Undoes: <sha>` is its builder's decision and not
 *  counted. */
export const undoneBy = (tree, { was, head, branch }) => {
  const cut = cutOf(tree, branch, was);
  if (!cut.at) return { judged: false, why: cut.why };
  const landed = lines(gitOut(["rev-list", "--no-merges", `${cut.at}..${was}`], tree));
  if (!landed.length) return { judged: true, cut: cut.at, landed: 0, undone: [] };
  const declared = declaredIn(tree, was, head);
  const addedAnywhere = counted(diffed(tree, was, head).flatMap((one) => one.added));
  const lost = new Map();
  for (const [file, shas] of touchedBy(tree, cut.at, was, head)) {
    const open = shas.filter((sha) => !declared.some((one) => sha.startsWith(one)));
    for (const sha of fileTakesBack(tree, { was, head, file, landed: open, addedAnywhere, entries: cut.entries })) {
      lost.set(sha, [...(lost.get(sha) ?? []), file]);
    }
  }
  const undone = [...lost].map(([commit, files]) =>
    ({ commit, files, subject: gitOut(["show", "--no-patch", "--format=%s", commit], tree) ?? "" }));
  return { judged: true, cut: cut.at, landed: landed.length, undone };
};

/** The line a step prints where it let the change through. */
export const undoneLine = (found) => {
  if (!found.judged) {
    return `where this branch was cut cannot be read — ${found.why} — so whether it takes back work `
      + `that landed under it is not judged here`;
  }
  if (!found.landed) {
    return `nothing landed under this change since it was cut at ${shortly(found.cut)}, so there is no `
      + `landed work for it to take back`;
  }
  return `${found.landed} commit(s) landed under this change since it was cut at ${shortly(found.cut)}, `
    + `and it takes back no hunk of any of them`;
};

/** The account both refusals open with, and the two ways out: the work put back, or the take-back
 *  declared as the change's own decision in a commit on top, which leaves a review read standing. */
export const undoneSaid = (found, was, head) => {
  const files = [...new Set(found.undone.flatMap((one) => one.files))];
  return `this change takes back work that landed under it, and no gate can see that: a tree with `
    + `landed work undone is a consistent tree. Each commit below landed after this branch was cut at `
    + `${shortly(found.cut)} and is none of this change's own, and the change removes every line one `
    + `of its hunks still has at ${shortly(was)} while putting back what that hunk replaced:\n`
    + `${found.undone.map((one) => `    ${shortly(one.commit)} ${one.subject} — ${one.files.join(", ")}`).join("\n")}\n`
    + `Read what it undoes:\n    git diff ${shortly(was)} ${shortly(head)} -- ${files.join(" ")}\n`
    + `Where a replay or a stale copy staged with \`git add -u\` did it, put that work back and commit it:\n`
    + `${found.undone.map((one) => `    git show --format= ${one.commit} -- ${one.files.join(" ")} | git apply --3way`).join("\n")}\n`
    + `    git commit -m "Put back the landed work this change took back"\n`
    + `Where taking it back is this change's decision, say so in a commit of its own:\n`
    + `${found.undone.map((one) => `    git commit --allow-empty -m "<why this change takes it back>" -m "Undoes: ${one.commit}"`).join("\n")}`;
};
