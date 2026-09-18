// The calls a project lists wait for what a consult owes on what they would judge: unread documents, unruled findings. how/codex-owed.md.

import { resolve } from "node:path";

import { ageOf, pendingNow, pendingState } from "../../../src/codex/codex.mjs";
import { repoRoot } from "../../../src/git/repo-root.mjs";
import { logBytes } from "../../../src/codex/codex-log.mjs";
import { unverdicted, verdictForm } from "../../../src/codex/log/replies.mjs";
import { classesFor } from "../../../src/stats/corpus/classes.mjs";
import { OWED_DOORS, codexOwedOf, projectFileAt } from "../../../src/resolve/settings.mjs";
import { configDir } from "../../../src/resolve/config.mjs";
import { NOWHERE, deny, how, movedTo, shellText, spans, typed, done } from "../../_hook.mjs";

const ESCAPE = "For the session: `forge hooks --off codex-owed` — an inline `FORGE_CODEX_DISABLE=1` "
  + "prefix never reaches a hook.";

const readIn = () => `Read from ${typed(configDir("forge"))}, so a consult recorded under another `
  + "XDG_CONFIG_HOME clears nothing here.";

const MALFORMED = "`codex.owed` in .forge.json is a list of the doors a consult is demanded at, out of "
  + `${OWED_DOORS.join(", ")}. Drop the key and the commit alone asks.`;

/* One read of a tree's project file answers both halves: which commands that project calls its gate
   and its ship, and which doors it named. `commit` is codex-second's and matches no class here. */
const heldIn = (tree) => {
  const parsed = projectFileAt(tree);
  const owed = codexOwedOf(parsed?.codex);
  const classes = classesFor(parsed?.stats?.commands ?? null)
    .filter(([label]) => (owed.unknown ? OWED_DOORS : owed.value).includes(label));
  return { classes, unknown: owed.unknown };
};

/* Every command of the line against the tree the shell stands in AT that command, and every tree it
   reaches rather than the first: a `cd` into another project moves both what a gate command is and
   whose record owes, and a line gating in two trees would judge the second one's content too. */
const heldBy = (text, cwd) => {
  const seen = new Map();
  const found = [];
  let unreadable = false;
  for (const { start } of spans(text, { pipes: true })) {
    const stood = movedTo(text, start);
    const tree = stood === NOWHERE ? null : resolve(cwd, stood ?? ".");
    /* A destination no reading can name leaves the shell's own list to say whether this asks at all,
       which settles the asking and never the answer: a tree that never chose this is refused nothing. */
    const asks = tree ?? cwd;
    if (!seen.has(asks)) seen.set(asks, heldIn(asks));
    const { classes, unknown } = seen.get(asks);
    const here = text.slice(start);
    if (!classes.some(([, match]) => match.exec(here)?.index === 0)) continue;
    if (!tree) {
      unreadable = true;
      continue;
    }
    const root = repoRoot(tree);
    if (root && !found.some((one) => one.root === root)) found.push({ root, unknown });
  }
  return { found, unreadable };
};

const six = (rels) => rels.slice(0, 6).map(typed).join(" ");

export const run = (ev) => {
  if (ev.tool_name !== "Bash" || process.env.FORGE_CODEX_DISABLE === "1") done();
  const cwd = ev.cwd ?? process.cwd();
  const { found, unreadable } = heldBy(shellText((ev.tool_input ?? {}).command), cwd);
  if (unreadable) {
    deny(
      "Which tree this call would judge cannot be read from the command — a `cd -`, a bare `cd` or a "
        + "destination built from a value names no directory this reading can check, so whose record it "
        + "owes cannot be asked for.\n\nDo this: spell the tree out — `cd <path> && <the command>` — "
        + `then re-send. ${ESCAPE}`
        + how(),
    );
  }
  let entries = null;
  const log = () => (entries ??= logBytes());
  for (const { root, unknown } of found) {
    if (unknown) deny(`${unknown} is no door this reads. ${MALFORMED}${how()}`);
    const cd = root === cwd ? "" : `cd ${typed(root)} && `;
    const waiting = pendingState(root);
    /* The working copy, which is what a consult reads and what this call would judge, where the
       commit asks its index: one record, one reader, two subjects. */
    const owed = waiting.files.length ? pendingNow(root, waiting.files, log).owed : [];
    if (owed.length) {
      deny(
        `Codex has not read what this call would judge in ${root} (${six(owed)}`
          + `${owed.length > 6 ? ` and ${owed.length - 6} more` : ""}, recorded ${ageOf(waiting.at)}). `
          + `Every door this project names asks for that same reading, so clearing it here clears them all.\n\n`
          + `Do this: \`${cd}echo "<what you were doing>" | forge codex consult --diff --only `
          + `blocker,major ${six(owed)}\`, then re-send. ${readIn()} `
          + `\`forge codex pending --drop\` discards them unread. ${ESCAPE}`
          + how(),
      );
    }
    const open = unverdicted(log(), root);
    if (open) {
      deny(
        `Consult ${open.id} made ${open.ids.join(", ")} on ${open.files.join(", ")}; nothing says what `
          + `became of ${open.open.join(", ")}, and this call would judge it in ${root}. Ruling on them `
          + `clears every door this project names.\n\n`
          + `Do this: \`${verdictForm(open.id)}\`, then re-send. ${readIn()} `
          + `A --recheck records the verdict for what it refutes. ${ESCAPE}`
          + how(),
      );
    }
  }
  done();
};
