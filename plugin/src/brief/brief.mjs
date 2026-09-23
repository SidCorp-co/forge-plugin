/* The message a dispatch sends, generated rather than written: the readings a run cannot take for
   itself at the moment it starts, and nothing a dispatcher typed. docs/cli/brief.md. */
import { realpathSync } from "node:fs";
import { resolve } from "node:path";

import { fail } from "../resolve/settings.mjs";
import { flags, wantsHelp } from "../resolve/flags.mjs";
import { helpOf } from "../resolve/visibility.mjs";
import { copiesFor } from "./copies.mjs";
import { keepBrief } from "./record.mjs";
import { defaultRef, heldBy, recordsOf, treesOf } from "./trees.mjs";

const KEY = /^[A-Z][A-Z0-9]*-\d+$/u;

const real = (path) => {
  try {
    return realpathSync(resolve(path));
  } catch {
    return null;
  }
};

const listed = (files) => files.join(", ");

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
  ].filter(Boolean);
};

const copyLines = (copies) => {
  if (copies.unread) return [`Plugin copy: not read, since ${copies.unread}.`];
  if (!copies.between.length) return [`Plugin copy: this session loaded ${copies.loaded}, the one installed; nothing moved since.`];
  return [
    `Plugin copy: this session loaded ${copies.loaded}; ${listed(copies.between)} landed since, `
      + `${copies.moved.length} file(s) moved.`,
    copies.frozen.length
      ? `Restart owed: yes, the restart set moved: ${listed(copies.frozen)}.`
      : "Restart owed: no, nothing in the restart set moved.",
  ];
};

/** The brief itself, off readings already taken, so a case can hand it any it likes. */
export const briefText = ({ key, target, others, base, copies }) => [
  ...(key ? [key] : []),
  ...(target ? treeLines(target) : []),
  ...(others
    ? [`Held by the other trees, read now: uncommitted, and committed against ${base ?? "no default branch"}:`,
      ...others.map(({ tree, held }) => heldLine(tree, held))]
    : ["Trees: none read, since this directory is in no git checkout."]),
  ...copyLines(copies),
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
  const base = trees ? defaultRef(here) : null;
  const others = trees?.filter((one) => one !== target).map((tree) => ({ tree, held: heldBy(tree.path, base) })) ?? null;
  const text = briefText({ key, target, others, base, copies: copiesFor() });
  try {
    keepBrief(process.env.CLAUDE_CODE_SESSION_ID, text);
  } catch (error) {
    fail(`brief: the record the hook checks a dispatch against could not be written (${error.message}), `
      + "so no brief is printed: one sent now would be refused. Make the forge config directory writable and run this again.");
  }
  console.log(text);
};
