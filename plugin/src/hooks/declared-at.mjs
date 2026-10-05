/* Each command of a shell line read against the project of the tree the shell stands in at that
   command, since a `cd` into another project moves what that project calls its gate. More than one
   gate asks a line this, so the reading is here and not in any of them. */
import { NOWHERE, directoryAt, spans } from "./shell-spans.mjs";

/** Every command span of `text` with the tree it runs in — null where no reading names one — the
 *  text from that command on, and what `read` says of the tree, asked once per tree. A tree no
 *  reading names is asked of `cwd`: that settles whether the line asks at all, and never the answer. */
export const commandsAt = (text, cwd, read) => {
  const seen = new Map();
  return spans(text, { pipes: true }).map(({ start }) => {
    const stood = directoryAt(text, start, cwd);
    const tree = stood === NOWHERE ? null : stood;
    const asks = tree ?? cwd;
    if (!seen.has(asks)) seen.set(asks, read(asks));
    return { tree, held: seen.get(asks), here: text.slice(start) };
  });
};

/** Whether the command `here` opens with is one of `classes`, the `[label, pattern]` pairs
 *  `declaredClasses` reads off a project's declaration. */
export const opensWithAny = (classes, here) => classes.some(([, match]) => match.exec(here)?.index === 0);
