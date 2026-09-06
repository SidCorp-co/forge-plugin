// The read a call did nothing but make of a log, for the gate that refuses the same one twice and the
// profiler that counts it. `sed` is no reader here: `sed -i` writes and the verb does not say which.

import { spans, unquote } from "./shell-spans.mjs";

export const LOG_NAME = /\.(?:log|out|output|err)$/u;
const READS = /^(?:\S*\/)?(?:cat|tail|head|tac|nl|wc|ls|stat|grep|egrep|fgrep|rg)$/u;
const INERT = /^(?:cd|echo|pwd|true|:)$/u;

const WORD = /(?:'[^']*'|"(?:[^"\\]|\\.)*"|\S)+/gu;
const LEADS = /^[\s;&|()]+/u;
const AIMS = /^\d*[<>]/u;
const EXPANDS = /\$\(|`/u;
const SETTLE = /'[^']*'|"(?:[^"\\]|\\.)*"|\s+/gu;

export const NOTHING = "";

const wordsOf = (whole, { start, end }) =>
  (whole.slice(start, end).replace(LEADS, "").trim().match(WORD) ?? []).map(unquote);

const reading = (whole) => {
  if (EXPANDS.test(whole)) return null;
  const found = new Set();
  let asked = false;
  for (const span of spans(whole, { pipes: true })) {
    const words = wordsOf(whole, span);
    if (!words.length) continue;
    const rest = words.slice(1);
    if (rest.some((one) => AIMS.test(one))) return null;
    if (INERT.test(words[0])) continue;
    if (!READS.test(words[0])) return null;
    for (const one of rest) if (!one.startsWith("-") && LOG_NAME.test(one)) found.add(one);
    asked = true;
  }
  if (!asked) return [];
  return found.size ? [...found].sort() : null;
};

/** `null` where the call did something and the read before it stops mattering, `NOTHING` where it was
 *  inert, otherwise a key two calls share only by asking one log the same question. The command comes
 *  in as the transcript records it, unexpanded, so a gate and a profiler cannot key on different text. */
export const logRead = (text) => {
  const whole = String(text ?? "");
  const logs = reading(whole);
  if (logs === null) return null;
  return logs.length ? whole.replace(SETTLE, (one) => (one.trim() ? one : " ")).trim() : NOTHING;
};

export const logsIn = (text) => reading(String(text ?? "")) ?? [];
