/* The id a Bash command grants the process that will write, for a hook handed none of its own, read
   off the text's commands and not its first alone (ISS-672). The two forms: docs/cli/claim.md. */
import { quoting, spans } from "../hooks/shell-spans.mjs";

const BACKTICK = "\\x60";
const LITERAL = String.raw`[\w.@:+/-]+`;
const ID_VALUE = String.raw`(?:"(${LITERAL})"|'(${LITERAL})'|(${LITERAL}))`;
const valueIn = (hit) => hit?.[1] ?? hit?.[2] ?? hit?.[3] ?? "";

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

const runsACommand = (said) => {
  const joined = said.replace(CONTINUED, "");
  const read = quoting(said);
  if (ANSI_C.test(joined) || nests(read)) return RUNS_A_COMMAND.test(joined);
  const code = read.map(({ one }) => one).join("");
  return [...code.matchAll(EVERY_OPENER)].some(({ 0: opener, index: at }) =>
    acts(opener, read.slice(at, at + opener.length).map(({ under }) => under)));
};

const CALLS_THE_WRITER = new RegExp(String.raw`(?:^|[\s;&|()])[^\s;&|()]*forge(?![\w-])`, "u");
const OPENS_A_BODY = new RegExp(String.raw`[(${BACKTICK}]|<<`, "u");
const SEPARATOR = /^[ \t]*(&&|\|\||;|\n|\||&)/u;

const TAKEN_BACK = /(?:^|[;&|\n({])\s*(?:unset\b|source\b|\.\s|sudo\b|su\b|env\s+-[ui]\b)/u;
const EVERY_VALUE = /FORGE_SESSION_ID=(?:"([^"]*)"|'([^']*)'|([^\s;&|]*))/gu;
const unquoted = (text) => text.replace(/"[^"]*"|'[^']*'/gu, " ");

const commandsIn = (text) => spans(text, { pipes: true })
  .map(({ start, end }) => ({ said: text.slice(start, end), after: text.slice(end) }));

const sepAfter = (one) => SEPARATOR.exec(one?.after ?? "")?.[1] ?? "";

const reachOf = (found) => {
  const at = found.findIndex(({ said }) => OPENS_A_BODY.test(unquoted(said)));
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

export const idGrantedBy = (command) => {
  const text = Array.isArray(command) ? command.join("\n") : String(command ?? "");
  const granted = grantedIn(commandsIn(text));
  if (!granted || TAKEN_BACK.test(unquoted(text))) return null;
  const named = new Set([...text.matchAll(EVERY_VALUE)].map(valueIn));
  return named.size === 1 ? valueIn(granted) : null;
};
