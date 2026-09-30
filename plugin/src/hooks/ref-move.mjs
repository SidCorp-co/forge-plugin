/* Whether a `git update-ref` moves a ref some worktree stands on, and what that tree would be left
   holding. `update-ref` moves a ref and never a work tree, which is why it gets past git's own refusal
   to push or fetch into a checked-out branch, and why the tree it leaves reads its old files as edits.
   Doubt refuses: a failed reading allows only where the failure is git's own refusal of the update. */
import { canonical } from "../resolve/canonical.mjs";
import { gitProbe, probeMs } from "./git-probe.mjs";
import { NOWHERE } from "./shell-spans.mjs";

/* A shell word, adjacent quoted and bare fragments joined as the shell joins them: `'refs/heads/'main`. */
const WORDS = /(?:"[^"]*"|'[^']*'|[^\s"'])+/gu;
const FRAGMENT = /"([^"]*)"|'([^']*)'/gu;
const REDIRECTION = /^\d*[<>]{1,2}(?:&\d)?$/u;
const VALUED = new Set(["-m"]);

/** The operands and the two forms that change what they mean, off what follows `update-ref`. */
export const updateRefOf = (rest) => {
  const words = (String(rest).match(WORDS) ?? []).map((word) => word.replace(FRAGMENT, (_, d, s) => d ?? s));
  const operands = [];
  const flags = new Set();
  let past = false;
  for (let at = 0; at < words.length; at += 1) {
    const word = words[at];
    if (REDIRECTION.test(word)) at += 1;
    else if (/^\d*[<>]/u.test(word)) continue;
    else if (!past && word === "--") past = true;
    else if (!past && word.startsWith("-")) {
      flags.add(word);
      if (VALUED.has(word)) at += 1;
    } else operands.push(word);
  }
  return {
    stdin: flags.has("--stdin"),
    deletes: flags.has("-d"),
    deref: !flags.has("--no-deref"),
    ref: operands[0] ?? null,
    value: operands[1] ?? null,
  };
};

/* The two refs a checked-out tree stands on: its own HEAD, and a branch by its full name. A bare name is
   written under the git directory and moves no branch, which git 2.53 was seen doing. */
const judged = (ref) => ref === "HEAD" || /^refs\/heads\/./u.test(ref ?? "");

const worktreesOf = (out) =>
  out.split("\n\n").map((block) => {
    const one = {};
    for (const line of block.split("\n")) {
      const [key, ...value] = line.split(" ");
      one[key] = value.join(" ");
    }
    return one;
  }).filter((one) => one.worktree && !("bare" in one));

const UNBORN = /^0+$/u;
const short = (sha) => sha.slice(0, 7);

const HAND_OVER =
  "Hand the landing over with `forge claim <ISS-nn> --pushed --ready`, which leaves it to the actor "
  + "that lands in that checkout; moving the branch from inside the tree that has it checked out, "
  + "where the files move with it, is for the session working there.";

const OWN =
  "Move this tree's branch with its files: `git reset --keep <new>` moves both, and refuses where an "
  + "uncommitted edit would be lost.";

const unread = (what) => ({
  instead: HAND_OVER,
  cause:
    "`git update-ref` moves a ref and never a work tree, so a move of a branch some worktree has "
    + `checked out leaves that tree's files at the old commit. Whether this one does could not be read: ${what}.`,
});

const STDIN = {
  instead:
    "Move each ref with its own `git update-ref <ref> <new> [<old>]` call, which this guard can read.",
  cause:
    "`git update-ref --stdin` takes its transaction from input the command does not show, so nothing "
    + "here can tell whether it moves a branch a worktree has checked out, which would leave that tree's "
    + "files at the old commit to be committed back over the move.",
};

const staleIn = (entry, to, ask) => {
  const said = UNBORN.test(entry.HEAD)
    ? ask(["ls-tree", "-r", "--name-only", to])
    : ask(["diff", "--name-only", "--no-renames", entry.HEAD, to]);
  return said?.status === 0 ? said.out.split("\n").filter(Boolean) : null;
};

const moved = (hits, to, here) => {
  const trees = hits.map(({ entry, paths }) => {
    const branch = entry.branch ? `\`${entry.branch.replace(/^refs\/heads\//u, "")}\`` : "the detached HEAD";
    const from = UNBORN.test(entry.HEAD) ? "no commit" : short(entry.HEAD);
    const list = paths.length ? paths.map((path) => `  ${path}`).join("\n") : "  (no path differs)";
    return `${branch} is checked out at ${entry.worktree}, whose files would stay at ${from} while it `
      + `reads ${short(to)}. Each of these ${paths.length} path(s) would read there as an uncommitted `
      + `edit, and the next commit in that tree would revert the move:\n${list}`;
  });
  const own = hits.every(({ entry }) => canonical(entry.worktree) === here);
  return { instead: own ? OWN : HAND_OVER, cause: `\`git update-ref\` moves a ref and never a work tree. ${trees.join("\n")}` };
};

/* The ref a dereferencing update moves: a symbolic ref's target, which for a bare repository's HEAD is a
   branch a linked tree may stand on, else the name itself. A detached HEAD answers `HEAD`, the tree the call runs in. */
const targetOf = (ask, ref) => {
  const said = ask(["symbolic-ref", "-q", ref]);
  if (said?.status === 0) return { ref: said.out.trim() };
  if (said?.status === 1) return { ref };
  return { unread: `git did not say which ref \`${ref}\` names` };
};

/** Null where the call leaves no checked-out tree behind, else the refusal's `{ instead, cause }`.
 *  `tree` is where the command runs, `NOWHERE` where the text does not say; `left` is the ms remaining. */
export const refMoveIn = (rest, tree, left) => {
  const call = updateRefOf(rest);
  if (call.deletes || (!call.stdin && call.ref === null)) return null;
  if (tree === NOWHERE && !call.stdin && !judged(call.ref)) return null;
  if (tree === NOWHERE) return unread("which tree the call runs in cannot be read from the command, so spell the directory out: `cd <path> && …`");
  const ask = (argv) => gitProbe(argv, { cwd: tree, ms: probeMs(left()) });
  const repo = ask(["rev-parse", "--git-dir"]);
  if (!repo) return unread(`git did not say in time whether ${tree} is a repository`);
  if (repo.status !== 0) return null;
  if (call.stdin) return STDIN;
  if (call.value === null) return null;
  const target = call.deref ? targetOf(ask, call.ref) : { ref: call.ref };
  if (target.unread) return unread(target.unread);
  if (!judged(target.ref)) return null;
  const to = ask(["rev-parse", "--verify", "--quiet", `${call.value}^{commit}`]);
  if (!to) return unread(`git did not say in time which commit \`${call.value}\` names`);
  if (to.status !== 0) return null;
  const sha = to.out.trim();
  const listed = ask(["worktree", "list", "--porcelain"]);
  if (listed?.status !== 0) return unread("`git worktree list --porcelain` gave no listing of the trees that could be standing on it");
  const entries = worktreesOf(listed.out);
  const top = ask(["rev-parse", "--show-toplevel"]);
  const here = top?.status === 0 ? canonical(top.out.trim()) : null;
  let standing = entries.filter((one) => one.branch === target.ref);
  if (target.ref === "HEAD") {
    if (ask(["rev-parse", "--is-bare-repository"])?.out.trim() === "true") return null;
    if (!here) return unread(`git did not say which work tree ${tree} is`);
    standing = entries.filter((one) => canonical(one.worktree) === here);
    if (!standing.length) return unread(`no worktree git listed is ${here}, where the call runs`);
  }
  const hits = [];
  for (const entry of standing.filter((one) => one.HEAD !== sha)) {
    const paths = staleIn(entry, sha, ask);
    if (!paths) return unread(`the paths that differ between ${short(entry.HEAD)} and ${short(sha)} in ${entry.worktree} could not be listed`);
    hits.push({ entry, paths });
  }
  return hits.length ? moved(hits, sha, here) : null;
};
