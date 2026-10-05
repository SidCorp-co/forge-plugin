// The calls a project lists wait for what a consult owes on what they would judge: unread documents, unruled findings. how/codex-owed.md.

import { ageOf, pendingNow, pendingState } from "../../../src/codex/codex.mjs";
import { repoRoot } from "../../../src/git/repo-root.mjs";
import { listed, unverdicted } from "../../../src/codex/log/replies.mjs";
import { DROP, consultFor, downSaid, escapeFor, logReader, malformed, readIn, unreadApart, unruled } from "../../../src/codex/log/owed-refusal.mjs";
import { unreadSaid } from "../../../src/codex/log/unavailable.mjs";
import { at, declaredClasses } from "../../../src/stats/corpus/declared.mjs";
import { OWED_DOORS, codexOwedOf, enumOf, projectFileAt } from "../../../src/resolve/settings.mjs";
import { inRunHome } from "../../../src/resolve/session/run-home.mjs";
import { WRITER_WORD } from "../../../src/resolve/session/writer-word.mjs";
import { commandsAt, opensWithAny } from "../../../src/hooks/declared-at.mjs";
import { context, deny, how, quotedOut, shellText, typed, done } from "../../_hook.mjs";

const GATE = "codex-owed";
const ESCAPE = escapeFor(GATE);

/* One read of a tree's project file answers both halves: which commands that project calls its gate
   and its ship, and which doors it named. `commit` is codex-second's and matches no class here.
   The declared half alone: a door this project named and armed with no command guards nothing, since
   a table of one repository's own commands, reached from a route that refuses, is a refusal in every
   tree that spells its gate differently and never chose this (G-12). `forge doctor` names it. */
/* The one door whose command is this plugin's own verb, so no project declares it: a `--ready` capture,
   whatever the key's form and wherever `--pushed` stands. Read off the command alone with its quoted
   arguments blanked, so a `--ready` in a comment or inside a quoted value is no flag of the claim. */
const READY = at(String.raw`${WRITER_WORD}[ \t]+claim\b[^\n;&|]*?[ \t]--ready(?![\w-])`);
const capturing = (span) => READY.exec(quotedOut(span))?.index === 0;

const heldIn = (tree) => {
  const parsed = projectFileAt(tree);
  const owed = codexOwedOf(parsed?.codex);
  const doors = owed.unknown ? OWED_DOORS : owed.value;
  const classes = declaredClasses(parsed?.stats?.commands ?? null).filter(([label]) => doors.includes(label));
  return { classes, ready: doors.includes("ready"), unknown: owed.unknown, consult: enumOf("codex.consult", parsed).value };
};

/* `commandsAt` says which tree each command is read in; what is added here is that every tree
   counts, not the first: a line gating in two trees judges the second one's content too. */
const heldBy = (text, cwd) => {
  const found = [];
  let unreadable = false;
  for (const { tree, held: { classes, ready, unknown, consult }, here, span } of commandsAt(text, cwd, heldIn)) {
    if (!opensWithAny(classes, here) && !(ready && capturing(span))) continue;
    /* This gate's answer to a door behind a destination no reading names: the tree is unreadable, and the call is refused below. */
    if (!tree) {
      unreadable = true;
      continue;
    }
    const root = repoRoot(tree);
    if (root && !found.some((one) => one.root === root)) found.push({ root, unknown, consult });
  }
  return { found, unreadable };
};

/* What one tree's record owes, read under whichever home the caller has set, off the call's one log
   reader; it answers with what an advisory reading let through unread, which the caller says once
   every tree has been judged, a note refusing nothing and ending the gate where it is thrown. */
const judged = (root, cwd, log, consult) => {
  const cd = root === cwd ? "" : `cd ${typed(root)} && `;
  const waiting = pendingState(root);
  /* The working copy, which is what a consult reads and what this call would judge, where the
     commit asks its index: one record, one reader, two subjects. */
  const pending = waiting.files.length ? pendingNow(root, waiting.files, log).owed : [];
  const { owed, unread, down } = unreadApart(root, pending, log, consult);
  if (owed.length) {
    deny(
      `Run ${consultFor(cd, owed)}, then re-send. ${readIn()} ${DROP} ${ESCAPE}\n\n`
        + `Codex has not read what this call would judge in ${root} (${listed(owed)}, recorded ${ageOf(waiting.at)}). `
        + "Every door this project names asks for that same reading, so clearing it here clears them all."
        + downSaid(down) + how(),
    );
  }
  const open = unverdicted(log(), root);
  if (open) {
    deny(unruled(open, GATE, `, and this call would judge it in ${root}. Ruling on them clears every door `
      + "this project names.") + how());
  }
  return unread;
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
  const unread = [];
  for (const { root, unknown, consult } of found) {
    if (unknown) deny(`${malformed(unknown, GATE)}${how()}`);
    /* Each tree's record where its own run keeps it, which is not this hook's environment. */
    unread.push(...inRunHome(root, () => judged(root, cwd, log, consult)));
  }
  if (unread.length) context(unreadSaid("call", unread));
  done();
};
