/* The id a Bash command grants the process that will write, for a hook handed none of its own, read
   off the text's commands and not its first alone (ISS-672). The two forms: docs/cli/claim.md. */
import { quoting, spans } from "../../hooks/shell-spans.mjs";

const BACKTICK = "\\x60";
const LITERAL = String.raw`[\w.@:+/-]+`;
const ID_VALUE = String.raw`(?:"(${LITERAL})"|'(${LITERAL})'|(${LITERAL}))`;
export const valueIn = (hit) => hit?.[1] ?? hit?.[2] ?? hit?.[3] ?? "";

const TOP_LEVEL_EXPORT =
  new RegExp(String.raw`^\s*export\s+FORGE_SESSION_ID=${ID_VALUE}\s*$`, "u");

const PREFIX_ON_THE_WRITER = new RegExp(
  String.raw`^[ \t]*(?:env[ \t]+)?FORGE_SESSION_ID=${ID_VALUE}[ \t]+(?:[\w./~-]*/)?forge(?=[ \t]|$)`,
  "u",
);

const OPENER = String.raw`[$<>]\(|\$\{[\s|]|<<|${BACKTICK}`;
const RUNS_A_COMMAND = new RegExp(OPENER, "u");
const EVERY_OPENER = new RegExp(OPENER, "gu");
/* Where this shell's reach ends: every opener above, and a bare `(` besides. A subshell runs no command a prefix could cover, so it is no opener to `runsACommand`, but it is a shell an export made inside it does not come back from. One table, and that alternative is the whole difference. */
const BODY = String.raw`${OPENER}|\(`;
const OPENS_A_BODY = new RegExp(BODY, "u");
const EVERY_BODY = new RegExp(BODY, "gu");
/* What a double quote still runs: a command substitution, in either spelling. A process substitution and a here-doc operator are text there, and commands anywhere a shell reads one. */
const IN_DOUBLE = new RegExp(String.raw`^(?:\$[({]|${BACKTICK})`, "u");

/* The one reading of a command every question below asks, out of one `quoting` walk: the text a shell reads, its continuations joined as the walk joins them, and beside it the quoting each of its characters stands under, offset for offset. */
const readOf = (text) => {
  const marks = quoting(text);
  return { code: marks.map(({ one }) => one).join(""), under: marks.map(({ under }) => under).join("") };
};

/* The quoting `quoting` cannot place, and the whole of what this reader does about it: after a `$'…'` every apostrophe could be the one a backslash kept, and an expansion carries a word of its own whose quotes nest — `"${x:-"it's $(…)"}"` runs a substitution the flat reading calls data, where one inside single quotes nests nothing because nothing nests there; `$[`, whose deprecated body no shell this runs on is read for, is the same. Where either stands the reading is a guess, and every reader here answers a guess the way ISS-858 did: as if the quotes were not there. */
const ANSI_C = /\$'/u;
const NESTS = /\$[{[]/gu;
const unplaced = ({ code, under }) => ANSI_C.test(code)
  || [...code.matchAll(NESTS)].some(({ index }) => !["'", "#", "\\"].includes(under[index]));

/* Which openers a quoting runs, `shell-spans` having answered what the quoting is: a double quote keeps only a command substitution, a backslash on any of an opener's own characters ends it, and what this cannot place falls through to refused. */
const acts = (opener, under) =>
  !under.includes("\\") && under[0] !== "'" && (under[0] !== '"' || IN_DOUBLE.test(opener));

const opens = (read, every, any) => (unplaced(read)
  ? any.test(read.code)
  : [...read.code.matchAll(every)].some(({ 0: opener, index: at }) =>
    acts(opener, read.under.slice(at, at + opener.length))));

export const runsACommand = (said) => opens(readOf(said), EVERY_OPENER, RUNS_A_COMMAND);
const opensABody = (said) => opens(readOf(said), EVERY_BODY, OPENS_A_BODY);

/* What a take-back is looked for in: the same text with what a quote, a comment or a backslash made data blanked, space for space, so an escaped or quoted separator starts nothing and a comment runs nothing. What still spells a word once the shell removes its quotes stays — `"unset"` and `\unset` run `unset` as surely as `""unset` does. A heredoc's body is data this walk reads as shell, where one unpaired apostrophe misplaces every quote after it, so a live `<<` makes the reading a guess here too, answered the same way. */
const SPELLS = /[\w.-]/u;
const HEREDOC = /<</gu;
const asRun = (read) => {
  const { code, under } = read;
  if (unplaced(read) || [...code.matchAll(HEREDOC)].some(({ index }) => under.slice(index, index + 2) === "  ")) return code;
  return code.split("").map((one, at) =>
    (under[at] === " " || (under[at] !== "#" && SPELLS.test(one)) ? one : " ")).join("");
};

const textOf = (command) => (Array.isArray(command) ? command.join("\n") : String(command ?? ""));

export const CALLS_THE_WRITER = new RegExp(String.raw`(?:^|[\s;&|()])[^\s;&|()]*forge(?![\w-])`, "u");
const SEPARATOR = /^[ \t]*(&&|\|\||;|\n|\||&)/u;

const TAKEN_BACK = /(?:^|[;&|\n({])\s*(?:unset\b|source\b|\.\s|sudo\b|su\b|env\s+(?:-[ui]\b|--unset\b|--ignore-environment\b))/u;
const EVERY_TAKE_BACK = new RegExp(TAKEN_BACK.source, "gu");

const VAR = "FORGE_SESSION_ID";
const ANY_WORD = String.raw`(?:"[^"]*"|'[^']*'|[^\s;&|])`;
const ANY_VALUE = String.raw`(?:"([^"]*)"|'([^']*)'|([^\s;&|)]*))`;

/** Every id the text names, read wider than one it may grant, and why that asymmetry is the safe direction: docs/cli/the-granted-id.md. */
const EVERY_VALUE = new RegExp(String.raw`\bFORGE_SESSION_ID=${ANY_VALUE}`, "gu");
const ASSIGNS_THE_ID = new RegExp(EVERY_VALUE.source, "u");

const EVERY_WORD = new RegExp(String.raw`${ANY_WORD}+`, "gu");
const WRAPPER = /^(?:export|env)$/u;
const ASSIGNS = /^([A-Za-z_]\w*)=([\s\S]*)$/u;
const ONE_NAME = new RegExp(String.raw`^${LITERAL}$`, "u");
const dequoted = (word) => word.replace(/"([^"]*)"|'([^']*)'/gu, "$1$2");

const commandsIn = (text) => spans(text, { pipes: true })
  .map(({ start, end }) => ({ at: start, said: text.slice(start, end), after: text.slice(end) }));

const sepAfter = (one) => SEPARATOR.exec(one?.after ?? "")?.[1] ?? "";

const reachOf = (found) => {
  const at = found.findIndex(({ said }) => opensABody(said));
  return at < 0 ? found.length : at + 1;
};

const inThisShell = (found, i) =>
  !["|", "&"].includes(sepAfter(found[i])) && sepAfter(found[i - 1]) !== "|";

/* `spans` owns where a command begins and ends, so no grammar for one lives here; whatever `OPENS_A_BODY` names, wherever the shell would act on it, opens what is not this shell, and neither is a pipeline stage or a background job.
   An export covers a later call of this shell reached unconditionally, or joined to it by an unbroken `&&` no `||` can jump into, and being the environment it reaches a substitution too — where a
   prefix covers one command alone, so one carrying an opener a shell would act on is refused unread (ISS-858, ISS-949). */
const grantedIn = (found) => {
  const reach = reachOf(found);
  const at = found.findIndex(({ said }, i) =>
    i < reach && TOP_LEVEL_EXPORT.test(said) && inThisShell(found, i));
  const before = found.slice(0, Math.max(at, 0)).map(sepAfter);
  const chained = (i) => found.slice(at, i).every((one) => sepAfter(one) === "&&");
  const reached = (i) => at >= 0 && i > at && i < reach
    && (!before.includes("||") && (!before.includes("&&") || chained(i)));
  const called = found.map(({ said }) => CALLS_THE_WRITER.test(said));
  const prefixes = found.map(({ said }, i) =>
    (called[i] && !runsACommand(said) ? PREFIX_ON_THE_WRITER.exec(said) : null));
  const calls = called.map((yes, i) => (yes ? Boolean(prefixes[i]) || reached(i) : null));
  if (!calls.includes(true) || calls.includes(false)) return null;
  return prefixes.find(Boolean) ?? TOP_LEVEL_EXPORT.exec(found[at].said);
};

/** What one command assigns the name, read as a shell reads a command's head: the words in front of the first that is neither a wrapper nor an assignment. A prefix assignment's name is unquoted or it is a command word, which is why only an argument to a wrapper is dequoted whole; the value is the same `LITERAL` a grant is, so one this reader cannot spell is no id rather than a holder nothing matches.
 *  `undefined` where the command said nothing about the name, which is not assigning it nothing. */
const grantIn = (said) => {
  let found;
  let wrapped = false;
  for (const [word] of said.matchAll(EVERY_WORD)) {
    if (WRAPPER.test(word)) wrapped = true;
    else {
      const hit = ASSIGNS.exec(wrapped ? dequoted(word) : word);
      if (!hit) break;
      if (hit[1] === VAR) found = ONE_NAME.exec(dequoted(hit[2]))?.[0] ?? null;
    }
  }
  return found;
};

const grantEnding = (text, read = readOf(text)) => [
  ...commandsIn(read.code).map(({ at, said }) => ({ at, id: grantIn(said) }))
    .filter(({ id }) => id !== undefined),
  ...[...asRun(read).matchAll(EVERY_TAKE_BACK)].map((hit) => ({ at: hit.index, id: null })),
].sort((one, two) => one.at - two.at).at(-1)?.id ?? null;

/** The other reader's question — which run a whole turn's writes went under — and why each call is read alone: docs/cli/the-granted-id.md. */
export const lastIdGranted = (commands) => {
  let found = null;
  for (const command of [commands ?? []].flat()) found = grantEnding(String(command ?? "")) ?? found;
  return found;
};

/** Whether the text assigns the name or takes the environment back at all, granting or not: a command that does either is not run under the id its run holds elsewhere. */
export const movesTheId = (command) => {
  const read = readOf(textOf(command));
  return ASSIGNS_THE_ID.test(read.code) || TAKEN_BACK.test(asRun(read));
};

export const idGrantedBy = (command) => {
  const read = readOf(textOf(command));
  const granted = grantedIn(commandsIn(read.code));
  if (!granted || TAKEN_BACK.test(asRun(read))) return null;
  const named = new Set([...read.code.matchAll(EVERY_VALUE)].map(valueIn));
  return named.size === 1 ? valueIn(granted) : null;
};
