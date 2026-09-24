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
/* What a double quote still runs: a command substitution, in either spelling. A process substitution and a here-doc operator are text there, and commands anywhere a shell reads one. */
const IN_DOUBLE = new RegExp(String.raw`^(?:\$[({]|${BACKTICK})`, "u");
/* The quoting `quoting` cannot place, and the whole of what this reader does about it: after a `$'…'` every apostrophe could be the one a backslash kept, so the reading is a guess and the answer is the one ISS-858 landed. Read on the joined text, where a `$` and an apostrophe a continuation splits are the one the shell joins them into. */
const ANSI_C = /\$'/u;
const CONTINUED = /\\\n/gu;

/* Which openers a quoting runs, `shell-spans` having answered what the quoting is: a double quote keeps only a command substitution, a backslash on any of an opener's own characters ends it, and what this cannot place falls through to refused. */
const acts = (opener, under) =>
  !under.includes("\\") && under[0] !== "'" && (under[0] !== '"' || IN_DOUBLE.test(opener));

/* The other quoting this reading cannot place: an expansion carries a word of its own, and the quotes in it nest — `"${x:-"it's $(…)"}"` runs a substitution the flat reading calls data, where one inside single quotes nests nothing because nothing nests there. So a live `${` is the fallback's too, and `$[`, whose deprecated body no shell this runs on is read for. */
const NESTS_IN = /[{[]/u;
const nests = (read) => read.some(({ one, under }, at) =>
  one === "$" && under !== "'" && under !== "#" && under !== "\\"
  && NESTS_IN.test(read[at + 1]?.one ?? ""));

export const runsACommand = (said) => {
  const joined = said.replace(CONTINUED, "");
  const read = quoting(said);
  if (ANSI_C.test(joined) || nests(read)) return RUNS_A_COMMAND.test(joined);
  const code = read.map(({ one }) => one).join("");
  return [...code.matchAll(EVERY_OPENER)].some(({ 0: opener, index: at }) =>
    acts(opener, read.slice(at, at + opener.length).map(({ under }) => under)));
};

export const CALLS_THE_WRITER = new RegExp(String.raw`(?:^|[\s;&|()])[^\s;&|()]*forge(?![\w-])`, "u");
const OPENS_A_BODY = new RegExp(String.raw`[(${BACKTICK}]|<<`, "u");
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

const masked = (text) => text.replace(/"[^"]*"|'[^']*'/gu, (one) => " ".repeat(one.length));

const commandsIn = (text) => spans(text, { pipes: true })
  .map(({ start, end }) => ({ at: start, said: text.slice(start, end), after: text.slice(end) }));

const sepAfter = (one) => SEPARATOR.exec(one?.after ?? "")?.[1] ?? "";

const reachOf = (found) => {
  const at = found.findIndex(({ said }) => OPENS_A_BODY.test(masked(said)));
  return at < 0 ? found.length : at + 1;
};

const inThisShell = (found, i) =>
  !["|", "&"].includes(sepAfter(found[i])) && sepAfter(found[i - 1]) !== "|";

/* `spans` owns where a command begins and ends, so no grammar for one lives here; a `(`, a `<<` or a backtick opens what is not this shell, and neither is a pipeline stage or a background job.
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

const grantEnding = (text, joined = text.replace(CONTINUED, "")) => [
  ...commandsIn(joined).map(({ at, said }) => ({ at, id: grantIn(said) }))
    .filter(({ id }) => id !== undefined),
  ...[...masked(joined).matchAll(EVERY_TAKE_BACK)].map((hit) => ({ at: hit.index, id: null })),
].sort((one, two) => one.at - two.at).at(-1)?.id ?? null;

/** The other reader's question — which run a whole turn's writes went under — and why each call is read alone: docs/cli/the-granted-id.md. */
export const lastIdGranted = (commands) => {
  let found = null;
  for (const command of [commands ?? []].flat()) found = grantEnding(String(command ?? "")) ?? found;
  return found;
};

/** Whether the text assigns the name or takes the environment back at all, granting or not: a command that does either is not run under the id its run holds elsewhere. */
export const movesTheId = (command) => {
  const text = Array.isArray(command) ? command.join("\n") : String(command ?? "");
  return ASSIGNS_THE_ID.test(text) || TAKEN_BACK.test(masked(text));
};

export const idGrantedBy = (command) => {
  const text = Array.isArray(command) ? command.join("\n") : String(command ?? "");
  const granted = grantedIn(commandsIn(text));
  if (!granted || TAKEN_BACK.test(masked(text))) return null;
  const named = new Set([...text.matchAll(EVERY_VALUE)].map(valueIn));
  return named.size === 1 ? valueIn(granted) : null;
};
