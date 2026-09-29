// Hands every code file a call wrote to the linter the project configured, and says when a call wrote where no gate could see. Owns the routes, never the rules; how/code-quality.md says why the split falls there.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { isAbsolute, relative } from "node:path";

import { UNREAD, lintConfigured, linting, MAX_FILES, unreadWhy } from "../../src/hooks/lint-delegate.mjs";
import { askedAlready, block, context, remaining, touched, unseenWrites } from "../_hook.mjs";

const SPARE_MS = 5_000;

const FIX = "Fix each finding the project's linter reported below, in the file it names.";

/* Once per content: two of seventeen blocks landed on a grep naming a file written a moment before. */
const shaOf = (file) => {
  try {
    return createHash("sha1").update(readFileSync(file)).digest("hex").slice(0, 16);
  } catch {
    return "";
  }
};

const SAID = { by: "one call's gate", clock: "the event's clock" };

/* Said rather than refused: a file never read and a file that passed were the same silence (ISS-38). */
const unlinted = (ev, files) => {
  const shown = (file) => {
    const near = relative(ev.cwd || process.cwd(), file);
    return near.startsWith("..") || isAbsolute(near) ? file : near;
  };
  const lines = UNREAD
    .map((why) => [unreadWhy(why, SAID), files.filter((one) => one.unread === why).map((one) => shown(one.file))])
    .filter(([, names]) => names.length)
    .map(([text, names]) => `  ${text}: ${names.join(", ")}`);
  return `Not linted, so nothing here says these pass:\n${lines.join("\n")}\n`
    + `  Clear it: run the project's linter on them, or write them across calls of at most ${MAX_FILES} code files.`;
};

/* Three named are enough to find the command by; the rest are counted. */
const SHOWN = 3;

/* Said once a session, and only where no file of the call reached the gates, which is what keeps "no gate read it" true of a loop over names the command also spelled (ISS-450). The stamp is read before the command is parsed, since every call after the one that said it would parse only to say nothing. */
const UNSEEN = "unseen-names";
const unseen = (ev) => {
  if (ev.tool_name !== "Bash" || touched(ev).length) return "";
  if (askedAlready(ev, UNSEEN, "code-quality", { set: false })) return "";
  const said = unseenWrites(ev.tool_input?.command);
  if (!said.length || askedAlready(ev, UNSEEN, "code-quality")) return "";
  const more = said.length > SHOWN ? ` and ${said.length - SHOWN} more` : "";
  return `Not seen, so no gate read what this call's write through ${said.slice(0, SHOWN).map((one) => `\`${one}\``).join(", ")}${more} `
    + `landed on, if it ran: no spelling in the command produces ${said.length > 1 ? "those names" : "that name"}.\n`
    + "  Clear it: spell the path in the command, or write the file with Edit or Write. Said once a session: `forge hooks --how writes`.";
};

export const run = (ev) => {
  const asked = (file) => {
    const before = shaOf(file);
    return Boolean(before) && askedAlready(ev, `${file}@${before}`, "code-quality", { set: false });
  };
  const reasons = [];
  const unread = [];
  const configured = lintConfigured();
  for (const one of linting(ev, touched(ev), () => remaining() - SPARE_MS, { skip: asked })) {
    const { file, said } = one;
    if (one.unread && configured(file)) unread.push(one);
    if (!said) continue;
    reasons.push(said);
    /* Stamped as it stands after the delegate, which may have formatted it. */
    const after = shaOf(file);
    if (after) askedAlready(ev, `${file}@${after}`, "code-quality");
  }
  const note = [unread.length ? unlinted(ev, unread) : "", unseen(ev)].filter(Boolean).join("\n\n");
  /* The findings are the linter's words; the route ahead of them is this gate's. */
  if (reasons.length) block([FIX, ...reasons, note].filter(Boolean).join("\n\n"));
  if (note) context(note);
};
