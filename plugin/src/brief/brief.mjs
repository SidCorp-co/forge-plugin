/* The message a dispatch sends, generated rather than written: the readings a run cannot take for
   itself at the moment it starts, and nothing a dispatcher typed. docs/cli/brief.md. */
import { realpathSync } from "node:fs";
import { resolve } from "node:path";

import { borrowRoute } from "../resolve/config.mjs";
import { fail } from "../resolve/settings.mjs";
import { flags, wantsHelp } from "../resolve/flags.mjs";
import { helpOf } from "../resolve/visibility.mjs";
import { mintRunId, runIdAt, runNames, runsFor, scratchMinted } from "../resolve/session/run-id.mjs";
import { copiesFor } from "./copies.mjs";
import { keepBrief } from "./record.mjs";
import { defaultRef, heldBy, recordsOf, treesOf } from "./trees.mjs";

const KEY = /^[A-Z][A-Z0-9]*-\d+$/u;

/* The one prefix a run id can carry: the reader places `iss-<n>` and nothing else. */
const MINTABLE = /^ISS-\d+$/u;

const real = (path) => {
  try {
    return realpathSync(resolve(path));
  } catch {
    return null;
  }
};

const listed = (files) => files.join(", ");

const batchOf = (raw, key, tree) => {
  if (raw === undefined) return [];
  if (!key || !tree) {
    fail("brief: --batch names the issues a run is dispatched to beside the first, minted into the run id of "
      + "the tree --tree names, so it is read only with a key and --tree:\n  forge brief ISS-45 --batch ISS-46,ISS-47 --tree <dir>");
  }
  const keys = String(raw).split(",").map((one) => one.trim());
  const bad = keys.filter((one) => !KEY.test(one));
  if (bad.length) fail(`brief: --batch takes issue keys joined by commas, as ISS-46,ISS-47, and \`${bad.join("`, `")}\` is none.`);
  if (new Set([key, ...keys]).size !== keys.length + 1) {
    fail(`brief: --batch names ${key} or one of its keys twice, and a run is dispatched to each issue once. Name each key one time.`);
  }
  return keys;
};

/* The dispatch is the moment a run is bound to its issues, and this is the one verb of the plugin every dispatch runs, so a tree naming no run is given its id here rather than by a repository tool no other project has (ISS-1682). An id already there is read and never extended, since the run it names may still be standing in that tree. Every refusal comes before the write. What it returns is every issue the binding names, which can be more than the call gave: the brief's text is handed to the run exactly, so a member left only inside the id is one the run never works (ISS-2581). */
const bindTree = (tree, keys) => {
  const held = runIdAt(tree);
  if (held) {
    const names = runsFor(held).map((one) => one.toUpperCase());
    const missing = keys.filter((one) => !runNames(held, one));
    if (!missing.length) return names;
    fail(`brief: ${tree} already holds the run id ${held}, which names ${names.length ? listed(names) : "no issue"} `
      + `and not ${listed(missing)}, so a run dispatched from it would be refused the lease its dispatcher holds. `
      + "An id is never extended, since the run it names may still be standing in that tree. Brief a tree of its own:\n"
      + `  git worktree add <new tree> && forge brief ${keys[0]}${keys.length > 1 ? ` --batch ${keys.slice(1).join(",")}` : ""} --tree <new tree>`);
  }
  const foreign = keys.filter((one) => !MINTABLE.test(one));
  if (foreign.length) {
    fail(`brief: ${listed(foreign)} cannot go into a run id, which names only ISS- keys, so a run given one could `
      + `never be placed as the run dispatched to it. Brief the tree under the issue's ISS- key.`);
  }
  return runsFor(mintRunId(tree, keys)).map((one) => one.toUpperCase());
};

/* The scratch directory goes with the id, under it and recorded beside it, so whatever outlives the run can say whose a
   directory under the temporary root is (ISS-2524). A tree whose id was minted before the brief made scratch is given it
   here too. A brief whose run would write where nothing records it is not printed. */
const scratchFor = (tree) => {
  const { at, failed } = scratchMinted(tree, runIdAt(tree));
  if (!failed) return;
  fail(`brief: the scratch directory ${at} could not be made and recorded (${failed}), so no brief is printed: a run `
    + "sent now would write where nothing records it. Make the path that reason names writable — the temporary root "
    + "TMPDIR names, or the git directory of the tree — and brief again.");
};

const heldLine = (tree, held) => {
  const who = [...held.keys, tree.branch ?? "detached"].join(", ");
  const parts = [
    held.committed === null ? "committed: not read" : held.committed.length ? `committed: ${listed(held.committed)}` : null,
    held.uncommitted === null ? "uncommitted: not read" : held.uncommitted.length ? `uncommitted: ${listed(held.uncommitted)}` : null,
  ].filter(Boolean);
  return `  ${tree.path} (${who}): ${parts.length ? parts.join("; ") : "reads empty"}`;
};

const treeLines = (tree) => {
  const { id, scratch } = recordsOf(tree.path);
  return [
    `Tree: ${tree.path} · branch ${tree.branch ?? "detached"} · head ${tree.head?.slice(0, 7) ?? "none"}`,
    id ? `FORGE_SESSION_ID=${id}` : null,
    scratch ? `TMPDIR=${scratch}` : null,
    /* A run dispatched with no route to borrow by copies the credential into its scratch, which is
       what the borrow ended (ISS-2619). */
    scratch ? borrowRoute(scratch) : null,
  ].filter(Boolean);
};

/* The copy reading is the dispatcher's and never the run's: only the session that dispatches can
   restart, and a run in any project is handed a line about a copy it cannot act on (ISS-2963). So it
   goes to standard error, which the brief's digest never holds, only where a restart is owed, and in
   versions rather than the plugin's own paths, which a project that never saw its source cannot place.
   Copies it could not place are silence, by AC-07-6-2. */
const restartLine = (copies) => (copies.frozen?.length
  ? `forge brief: a restart is owed before this dispatch. This session loaded forge ${copies.loaded} and `
    + `${copies.installed} is installed, and the hooks, skills or roles a session keeps from its start differ `
    + `between them: a dispatched run takes them from this session. Restart it, which loads ${copies.installed}, `
    + "and brief again. This line is not part of the brief: send only what standard output printed."
  : null);

/** The brief itself, off readings already taken, so a case can hand it any it likes. */
const briefText = ({ members, target, others, base }) => [
  ...(members.length ? [listed(members)] : []),
  ...(target ? treeLines(target) : []),
  ...(others
    ? [`Held by the other trees, read now: uncommitted, and committed against ${base ?? "no default branch"}:`,
      ...others.map(({ tree, held }) => heldLine(tree, held))]
    : ["Trees: none read, since this directory is in no git checkout."]),
].join("\n");

export const brief = async (argv) => {
  if (wantsHelp(argv)) return console.log(helpOf("brief"));
  const [first, ...rest] = argv;
  const key = first && !first.startsWith("--") ? first : null;
  if (key && !KEY.test(key)) fail(`brief: \`${key}\` is no issue key. Name one as ISS-45, or none for a run that is given no tree.`);
  const asked = flags(key ? rest : argv, "brief", [], { usage: helpOf("brief") });
  const here = process.cwd();
  const trees = treesOf(here);
  if (!trees && asked.tree) fail(`brief: ${here} is in no git checkout, so --tree names nothing here. Run it from the repository the run works in.`);
  const wanted = asked.tree ? real(asked.tree) : null;
  const target = wanted ? (trees ?? []).find((one) => real(one.path) === wanted) : null;
  if (asked.tree && !target) {
    fail(`brief: ${asked.tree} is no worktree of this repository. \`git worktree list\` names the ones it has.`);
  }
  const batch = batchOf(asked.batch, key, target);
  const members = key && target ? bindTree(target.path, [key, ...batch]) : key ? [key] : [];
  if (key && target) scratchFor(target.path);
  const base = trees ? defaultRef(here) : null;
  const others = trees?.filter((one) => one !== target).map((tree) => ({ tree, held: heldBy(tree.path, base) })) ?? null;
  const text = briefText({ members, target, others, base });
  const restart = restartLine(copiesFor());
  try {
    keepBrief(process.env.CLAUDE_CODE_SESSION_ID, text);
  } catch (error) {
    fail(`brief: the record the hook checks a dispatch against could not be written (${error.message}), `
      + "so no brief is printed: one sent now would be refused. Make that directory writable and run this again.");
  }
  if (restart) console.error(restart);
  console.log(text);
};
