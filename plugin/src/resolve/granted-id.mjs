/* The id a Bash command grants the process that will write, for a hook handed none of its own, read
   off the text's commands and not its first alone (ISS-672). The two forms: docs/cli/claim.md. */
import { spans } from "../hooks/shell-spans.mjs";

const BACKTICK = "\\x60";
const LITERAL = String.raw`[\w.@:+/-]+`;
const ID_VALUE = String.raw`(?:"(${LITERAL})"|'(${LITERAL})'|(${LITERAL}))`;
const valueIn = (hit) => hit?.[1] ?? hit?.[2] ?? hit?.[3] ?? "";

const TOP_LEVEL_EXPORT =
  new RegExp(String.raw`^\s*export\s+FORGE_SESSION_ID=${ID_VALUE}\s*$`, "u");

const PREFIX_ON_THE_WRITER = new RegExp(
  String.raw`^[ \t]*(?:env[ \t]+)?FORGE_SESSION_ID=${ID_VALUE}[ \t]+(?:[\w./~-]*/)?forge`
  + String.raw`(?:[ \t]+[^\s&|;$()<>${BACKTICK}]+)*[ \t]*$`,
  "u",
);

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

/* `spans` owns where a command begins, so no grammar for one lives here; a `(`, a `<<` or a backtick
   opens what is not this shell, and neither is a pipeline stage or a background job. An export
   covers a later call of this shell when nothing can run that call without it: it is reached
   unconditionally, or an unbroken `&&` no `||` can jump into joins the two. A prefix covers the
   command it sits on. Every call owes the same grant, or the id names only some of the writes. */
const grantedIn = (found) => {
  const reach = reachOf(found);
  const at = found.findIndex(({ said }, i) =>
    i < reach && TOP_LEVEL_EXPORT.test(said) && inThisShell(found, i));
  const before = found.slice(0, Math.max(at, 0)).map(sepAfter);
  const chained = (i) => found.slice(at, i).every((one) => sepAfter(one) === "&&");
  const reached = (i) => at >= 0 && i > at && i < reach
    && (!before.includes("||") && (!before.includes("&&") || chained(i)));
  const covered = ({ said }, i) => PREFIX_ON_THE_WRITER.test(said) || reached(i);
  const calls = found.map((one, i) => (CALLS_THE_WRITER.test(one.said) ? covered(one, i) : null));
  if (!calls.includes(true) || calls.includes(false)) return null;
  const prefixed = found.map(({ said }) => PREFIX_ON_THE_WRITER.exec(said)).find(Boolean);
  return prefixed ?? TOP_LEVEL_EXPORT.exec(found[at].said);
};

export const idGrantedBy = (command) => {
  const text = Array.isArray(command) ? command.join("\n") : String(command ?? "");
  const granted = grantedIn(commandsIn(text));
  if (!granted || TAKEN_BACK.test(unquoted(text))) return null;
  const named = new Set([...text.matchAll(EVERY_VALUE)].map(valueIn));
  return named.size === 1 ? valueIn(granted) : null;
};
