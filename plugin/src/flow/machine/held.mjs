/* Holding matches out of a prose rewrite's way and putting them back: the mechanism, apart from
   `machine.mjs`, which says what a declaration is and so what is held. */
import { CODE_SPAN } from "../../prose.mjs";

/* What a declaration stands as while the prose pass runs. It cannot itself be a code span — the
   reader refuses those — and an identifier inside one is carried whole by a pass that keeps spans byte for byte. */
const HELD = "forge-machine";
const SPAN_PART = new RegExp(`(${CODE_SPAN})`, "gu");
/* Named away from anything the text already says, so a plan quoting the mark keeps its quotation:
   the restore cannot tell a span it wrote from one it was given, so it is never given one. */
const heldIn = (source) => {
  let key = HELD;
  while (source.includes(key)) key = `${key}x`;
  return key;
};

/** Every match of `pattern` outside a code span, marked, its own text kept in `held` for the restore. */
export const heldOut = (pattern, text, held = {}) => {
  const source = String(text);
  if (!pattern) return source;
  const key = heldIn(source);
  const texts = [];
  const out = source
    .split(SPAN_PART)
    .map((part, at) => (at % 2 ? part : part.replace(pattern, (whole) => {
      texts.push(whole);
      return `\`${key}-${texts.length - 1}\``;
    })))
    .join("");
  Object.assign(held, { key, texts });
  return out;
};

/** The other half of the protection: what `protectMachine` held, back where its own marks stand. */
export const restoreMachine = (text, held = {}) => {
  const { key, texts } = held;
  if (!key || !texts?.length) return String(text);
  return String(text).replace(new RegExp(`\`${key}-(\\d+)\``, "gu"), (mark, at) => texts[Number(at)] ?? mark);
};
