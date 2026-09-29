// The calls a project lists wait for what a consult owes on what they would judge: unread documents, unruled findings. how/codex-owed.md.

import { ageOf, pendingNow, pendingState } from "../../../src/codex/codex.mjs";
import { repoRoot } from "../../../src/git/repo-root.mjs";
import { listed, unverdicted } from "../../../src/codex/log/replies.mjs";
import { DROP, consultFor, escapeFor, logReader, malformed, readIn, unruled } from "../../../src/codex/owed-refusal.mjs";
import { declaredClasses } from "../../../src/stats/corpus/declared.mjs";
import { OWED_DOORS, codexOwedOf, projectFileAt } from "../../../src/resolve/settings.mjs";
import { inRunHome } from "../../../src/resolve/session/run-home.mjs";
import { NOWHERE, deny, directoryAt, how, shellText, spans, typed, done } from "../../_hook.mjs";

const GATE = "codex-owed";
const ESCAPE = escapeFor(GATE);

/* One read of a tree's project file answers both halves: which commands that project calls its gate
   and its ship, and which doors it named. `commit` is codex-second's and matches no class here.
   The declared half alone: a door this project named and armed with no command guards nothing, since
   a table of one repository's own commands, reached from a route that refuses, is a refusal in every
   tree that spells its gate differently and never chose this (G-12). `forge doctor` names it. */
const heldIn = (tree) => {
  const parsed = projectFileAt(tree);
  const owed = codexOwedOf(parsed?.codex);
  const classes = declaredClasses(parsed?.stats?.commands ?? null)
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
    const stood = directoryAt(text, start, cwd);
    const tree = stood === NOWHERE ? null : stood;
    /* A destination no reading can name leaves the shell's own list to say whether this asks at all,
       which settles the asking and never the answer: a tree that never chose this is refused nothing. */
    const asks = tree ?? cwd;
    if (!seen.has(asks)) seen.set(asks, heldIn(asks));
    const { classes, unknown } = seen.get(asks);
    const here = text.slice(start);
    if (!classes.some(([, match]) => match.exec(here)?.index === 0)) continue;
    /* This gate's answer to a door behind that destination: the tree is unreadable, and the call is refused below. */
    if (!tree) {
      unreadable = true;
      continue;
    }
    const root = repoRoot(tree);
    if (root && !found.some((one) => one.root === root)) found.push({ root, unknown });
  }
  return { found, unreadable };
};

/* What one tree's record owes, read under whichever home the caller has set, off the call's one log reader. */
const judged = (root, cwd, log) => {
  const cd = root === cwd ? "" : `cd ${typed(root)} && `;
  const waiting = pendingState(root);
  /* The working copy, which is what a consult reads and what this call would judge, where the
     commit asks its index: one record, one reader, two subjects. */
  const owed = waiting.files.length ? pendingNow(root, waiting.files, log).owed : [];
  if (owed.length) {
    deny(
      `Run ${consultFor(cd, owed)}, then re-send. ${readIn()} ${DROP} ${ESCAPE}\n\n`
        + `Codex has not read what this call would judge in ${root} (${listed(owed)}, recorded ${ageOf(waiting.at)}). `
        + "Every door this project names asks for that same reading, so clearing it here clears them all."
        + how(),
    );
  }
  const open = unverdicted(log(), root);
  if (open) {
    deny(unruled(open, GATE, `, and this call would judge it in ${root}. Ruling on them clears every door `
      + "this project names.") + how());
  }
};

export const run = (ev) => {
  if (ev.tool_name !== "Bash" || process.env.FORGE_CODEX_DISABLE === "1") done();
  const cwd = ev.cwd ?? process.cwd();
  const { found, unreadable } = heldBy(shellText((ev.tool_input ?? {}).command), cwd);
  if (unreadable) {
    deny(
      `Spell the tree out — \`cd <path> && <the command>\` — then re-send. ${ESCAPE}\n\n`
        + "Which tree this call would judge cannot be read from the command — a `cd -`, a bare `cd` or a "
        + "destination built from a value names no directory this reading can check, so whose record it "
        + "owes cannot be asked for."
        + how(),
    );
  }
  const log = logReader();
  for (const { root, unknown } of found) {
    if (unknown) deny(`${malformed(unknown, GATE)}${how()}`);
    /* Each tree's record where its own run keeps it, which is not this hook's environment. */
    inRunHome(root, () => judged(root, cwd, log));
  }
  done();
};
