/* The id a Bash command grants the process that will write, for a hook that is handed none of its
   own. Which two forms a dispatcher has to write for this to read one: docs/cli/claim.md. */
const BACKTICK = "\\x60";
const LITERAL = String.raw`[\w.@:+/-]+`;
const ID_VALUE = String.raw`(?:"(${LITERAL})"|'(${LITERAL})'|(${LITERAL}))`;
const valueIn = (hit) => hit?.[1] ?? hit?.[2] ?? hit?.[3] ?? "";

const TOP_LEVEL_EXPORT =
  new RegExp(String.raw`^\s*export\s+FORGE_SESSION_ID=${ID_VALUE}\s*(?:$|;|\n|&&|\|\|)`, "u");

const PREFIX_ON_THE_WRITER = new RegExp(
  String.raw`^[ \t]*(?:env[ \t]+)?FORGE_SESSION_ID=${ID_VALUE}[ \t]+(?:[\w./~-]*/)?forge`
  + String.raw`(?:[ \t]+[^\s&|;$()<>${BACKTICK}]+)*[ \t]*$`,
  "u",
);

const TAKEN_BACK = /(?:^|[;&|\n({])\s*(?:unset\b|source\b|\.\s|sudo\b|su\b|env\s+-[ui]\b)/u;
const EVERY_VALUE = /FORGE_SESSION_ID=(?:"([^"]*)"|'([^']*)'|([^\s;&|]*))/gu;
const unquoted = (text) => text.replace(/"[^"]*"|'[^']*'/gu, " ");

export const idGrantedBy = (command) => {
  const text = Array.isArray(command) ? command.join("\n") : String(command ?? "");
  const granted = TOP_LEVEL_EXPORT.exec(text) ?? PREFIX_ON_THE_WRITER.exec(text);
  if (!granted || TAKEN_BACK.test(unquoted(text))) return null;
  const named = new Set([...text.matchAll(EVERY_VALUE)].map(valueIn));
  return named.size === 1 ? valueIn(granted) : null;
};
