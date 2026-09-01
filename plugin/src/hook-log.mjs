/* What the gates actually did. Three false refusals this session were found by watching a command
   fail, not by reading anything — a refusal left no trace at all. docs/FORGE-CLI.md. */
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { configDir } from "./resolve/config.mjs";
import { didYouMean } from "./suggest.mjs";
import { HOOKS_DIR, hookEvent, hookNames, offNow, setHook } from "./hook-switch.mjs";
import { fail } from "./resolve/settings.mjs";
import { flags } from "./resolve/flags.mjs";

export const HOOK_LOG_PATH = join(configDir("forge"), "hook-log.jsonl");
const KEPT = 220;
const TAIL = 20;

/* A named credential flag, a header, and the shapes that are a secret on sight. An hour ago a
   Coolify token reached this session's transcript through a redaction that missed one level. */
/* A value goes whole, quotes and spaces included: masking to the next space leaves most of a
   passphrase in a log that is printed back into a session. */
const VALUE = String.raw`("[^"]*"|'[^']*'|\S+)`;

const SECRETS = [
  [new RegExp(String.raw`(--?(?:token|password|api[-_]?key|secret|passwd?)[=\s]+)${VALUE}`, "giu"), "$1***"],
  [/(Authorization:\s*)(?:Bearer\s+)?\S+/giu, "$1***"],
  [/(Bearer\s+)\S+/giu, "$1***"],
  [/\b\d+\|[A-Za-z0-9]{30,}\b/gu, "***"],
  [/\beyJ[\w-]{10,}\.[\w-]+\.[\w-]+/gu, "***"],
  [/\b(?:sk|ghp|gho|github_pat)[-_][A-Za-z0-9_]{16,}\b/gu, "***"],
  /* Named rather than shaped: a value no pattern would recognise is still a secret when the name
     beside it says so. Over-masking a log is the safe direction. */
  [new RegExp(String.raw`\b(\w*(?:token|password|passwd|secret|api[-_]?key|key)\w*\s*=\s*)${VALUE}`, "giu"), "$1***"],
  [/([a-z][\w+.-]*:\/\/[^\s:@/]+:)[^\s@/]+@/giu, "$1***@"],
  [/("(?:password|token|secret|api[-_]?key)"\s*:\s*")[^"]*/giu, "$1***"],
];

export const scrubbed = (text) => {
  let out = String(text ?? "");
  for (const [pattern, mask] of SECRETS) out = out.replace(pattern, mask);
  return out.length > KEPT ? `${out.slice(0, KEPT)}\u2026` : out;
};

export const logHook = (record) => {
  try {
    mkdirSync(configDir("forge"), { recursive: true });
    if (!existsSync(HOOK_LOG_PATH)) closeSync(openSync(HOOK_LOG_PATH, "a", 0o600));
    appendFileSync(HOOK_LOG_PATH, `${JSON.stringify(record)}\n`);
    return true;
  } catch {
    return false;
  }
};

export const hookEntries = () => {
  try {
    return readFileSync(HOOK_LOG_PATH, "utf8")
      .split("\n")
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
};

const line = (one) =>
  `${one.at}  ${(one.hook ?? "?").padEnd(16)} ${(one.decision ?? "?").padEnd(5)} `
  + `${(one.tool ?? "?").padEnd(8)} ${one.target ?? ""}`;

/* The event is in the answer because that is what a switch turns off: one gate on one hook type. */
const switched = (name, off) => {
  if (!hookNames().includes(name)) fail(didYouMean("hook", name, hookNames()));
  setHook(name, off);
  console.log(`${name} (${hookEvent(name)}) is now ${off ? "off" : "on"}.`);
  const down = offNow();
  console.log(down.length ? `Off: ${down.map((one) => one.name).join(", ")}` : "Every hook is on.");
};

/* One document per gate, beside the hook rather than under docs/: only `plugin/` travels into an
   installed copy, and this is the path every refusal ends by naming. */
const HOW_DIR = join(HOOKS_DIR, "how");

const documented = () => {
  try {
    return readdirSync(HOW_DIR).filter((one) => one.endsWith(".md")).map((one) => one.slice(0, -3));
  } catch {
    return [];
  }
};

const reasoning = (name) => {
  if (!documented().includes(name)) fail(didYouMean("hook", name, documented()));
  console.log(readFileSync(join(HOW_DIR, `${name}.md`), "utf8").trimEnd());
};

/* Refusals as against notes, which do not inflate the count. Why they are logged: `_hook.mjs`. */
const REFUSALS = ["deny", "block"];

export const hooks = (argv) => {
  const held = flags(argv, "hooks", ["--deny", "--block", "--notes"]);
  if (held.how) return reasoning(held.how);
  /* Switching answers with the new state and stops: the refusal log is a different question. */
  if (held.off || held.on) return switched(held.off ?? held.on, Boolean(held.off));
  for (const { name, event } of offNow()) {
    console.log(`off: ${name.padEnd(16)} ${event}  — \`forge hooks --on ${name}\``);
  }
  let entries = hookEntries();
  const logged = entries.length;
  if (held.hook) {
    /* The log outlives the file: a hook since renamed is still worth filtering for. */
    const known = [...new Set([...hookNames(), ...entries.map((one) => one.hook).filter(Boolean)])];
    if (!known.includes(held.hook)) fail(didYouMean("hook", held.hook, known));
    entries = entries.filter((one) => one.hook === held.hook);
  }
  /* Either, never both: one entry has one decision, so two filters ANDed answered nothing. */
  const asked = held.notes ? [] : REFUSALS.filter((one) => held[one]);
  if (asked.length) entries = entries.filter((one) => asked.includes(one.decision));
  const noted = entries.filter((one) => !REFUSALS.includes(one.decision));
  entries = held.notes ? noted : entries.filter((one) => REFUSALS.includes(one.decision));
  const also = !held.notes && noted.length ? ` ${noted.length} note(s): \`forge hooks --notes\`.` : "";
  if (!entries.length) {
    const what = held.notes ? "notes" : "hook refusals";
    /* A filter matching nothing is not an empty log: the path is news only when none is there. */
    const where = logged
      ? `${logged} entr${logged === 1 ? "y" : "ies"} in ${HOOK_LOG_PATH} match nothing asked for`
      : `${HOOK_LOG_PATH} appears on the first one`;
    return console.log(`No ${what} logged. ${where}.${also}`);
  }
  const last = Number(held.last || TAIL);
  for (const one of entries.slice(-last)) console.log(line(one));
  const by = entries.reduce((seen, one) => ({ ...seen, [one.hook]: (seen[one.hook] ?? 0) + 1 }), {});
  const summary = Object.entries(by)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => `${name} ${count}`)
    .join(", ");
  console.log(`\n${entries.length} ${held.notes ? "note(s)" : "refusal(s)"}: ${summary}${also}`);
};
