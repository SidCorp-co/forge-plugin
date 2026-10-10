/* What a picture is asked for under, whichever backend draws it: the saved framing, the caller's
   words and the ratio, refused before anything is sent when either of the two it needs is missing.
   `forge chatgpt image` and `forge codex image` both compose through this, so how this machine's
   pictures are framed is one decision with one source. docs/cli/chatgpt-image.md carries why. */
import { fail } from "../../resolve/settings.mjs";
import { CHATGPT_PREFIX, machineValue } from "../../resolve/machine/stores.mjs";

const RATIO = /^([1-9]\d*):([1-9]\d*)$/u;

/** The framing `forge doctor --chatgpt-prefix` saved, or nothing where none was. */
export const savedFraming = () => machineValue("chatgpt", CHATGPT_PREFIX.key).value;

/* Last and alone on its line: a ratio inside the prose is the instruction a generation model most often reads past, which is the thing this action exists to fix. Which spelling lands is not diffable, so docs/cli/chatgpt-image.md carries what was run rather than an argument. */
const ratioSaid = (ratio) => `Aspect ratio: ${ratio}. Render the image at exactly ${ratio} and at no `
  + "other shape — do not crop or pad it to a different one.";

/** The framing first, the caller's words in the middle, the shape last. */
export const imageAsk = (prefix, prompt, ratio) => `${prefix}\n\n${prompt}\n\n${ratioSaid(ratio)}`;

/* Both are named whichever of them is missing: a caller told about one, who fixes it and then meets the other, has spent two rounds learning one shape. Neither is defaulted — a default ratio is the square picture nobody asked for, arriving with no sign that a choice was made for them. */
export const stating = (verb, prefix, ratio) => {
  if (prefix && ratio) return;
  const lacks = !prefix && !ratio ? "neither" : (prefix ? "no ratio" : "no framing");
  fail(`${verb}: a picture is asked for under a framing and at a shape, and this call states ${lacks}.`
    + `\n  framing   ${prefix ? "saved, and every picture is drawn under it"
      : `none saved — \`forge doctor --${CHATGPT_PREFIX.flag} <${CHATGPT_PREFIX.asks}>\`, once, for every picture after it`}`
    + `\n  ratio     ${ratio ? `${ratio}, as this call asked` : "--ratio w:h, and nothing defaults one"}`
    + "\n  Nothing was sent.");
};

export const ratioFrom = (verb, given) => {
  if (!RATIO.test(given)) {
    fail(`${verb}: --ratio takes two whole numbers above nought with a colon between them, and \`${given}\` is not one.`
      + "\n  Nothing was sent. Ask again with the shape you want: --ratio 16:9, --ratio 9:16, --ratio 1:1.");
  }
  return given;
};
