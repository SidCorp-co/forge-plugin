/* `forge codex image`: one picture over the Codex gateway's OpenAI-shaped images API, on the
   endpoint and key a consult is sent with. One request and never a second, and nothing of it is a
   review: no log row, no pending state, no eval window. docs/cli/codex-the-image.md carries why the
   model is a label, the size a hint and the wait longer than the gateway's own. */
import { readFileSync, writeFileSync } from "node:fs";
import { extname } from "node:path";

import { bytesWithin, clockFor, deadlineOf, parsedOr, ranOut, textWithin, waitSeconds } from "../../wire/request.mjs";
import { fail } from "../../resolve/settings.mjs";
import { gateway } from "../../resolve/machine/stores.mjs";
import { flags, promptFirst, pullRepeated } from "../../resolve/flags.mjs";
import { imageAsk, ratioFrom, savedFraming, stating } from "../../tools/services/picture.mjs";

const VERB = "codex image";
/* The backend serves one model whatever id is sent, so this is the `image_only` id the gateway's
   own model list carries and no caller is offered a choice that changes nothing. */
const MODEL = "cx/gpt-image-2.5";
const REFERENCE_CAP = 5;
/* The gateway ends a call at 115s and the proxy in front of it near 125s; a client that gives up
   first has lost an image the seat already paid for. */
const FLOOR_SECONDS = 130;
const MIN_WAIT_SECONDS = 0.001;
const BODY_CHARS = 400;
const URL_LIKE = /^https?:\/\//u;
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u;
const TYPES = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif" };

const MAYBE = "The image may already have been made and counted against the Codex seat's quota. It is not sent again.";
const NONE = "No image was made. Nothing is sent again.";

export const IMAGE_USAGE = [
  `Usage: forge codex image "<prompt>" --ratio w:h [--file path|url]... [--save path] [--wait s]`,
  "One picture over the Codex gateway's images API, on the endpoint and key a consult is sent with.",
  "It spends the same Codex 5 h window a consult does, and it is not a review: nothing is logged.",
  "",
  "Drawn under the framing `forge doctor --chatgpt-prefix \"<framing>\"` saved, the prompt in the",
  "middle and the ratio last. One request and never a second: an answer that never arrived may",
  "still have made the picture, and the refusal says which it was.",
  "",
  "  --ratio w:h    required; it travels as the prompt's last line, the size only leaning the same way",
  "  --file p|url   a reference image to draw from, up to 5; each local path is read before the send",
  "  --save path    write the picture's bytes there; without it the picture's URL is printed",
  `  --wait s       seconds to hold this call open; at least ${FLOOR_SECONDS} unless set here`,
].join("\n");

/* A hint and no more: the backend returned 1370x1148 for a square ask, so the ratio still travels
   as the prompt's last line and this only leans the canvas the same way. */
const sizeFor = (ratio) => {
  const [wide, tall] = ratio.split(":").map(Number);
  if (wide === tall) return "1024x1024";
  return wide > tall ? "1536x1024" : "1024x1536";
};

const settings = () => {
  const { url, key, problem } = gateway();
  if (problem) fail(`${VERB}: ${problem}\n  Nothing was sent.`);
  return { url: url.value.replace(/\/+$/u, ""), key: key.value };
};

/* Every reference is read before the request leaves, so a missing second file costs no image. */
const referencesOf = (given) => {
  if (given.length > REFERENCE_CAP) {
    fail(`${VERB}: ${given.length} reference images, and the gateway takes ${REFERENCE_CAP}. Nothing was sent.`);
  }
  return given.map((one) => {
    if (URL_LIKE.test(one)) return one;
    try {
      const type = TYPES[extname(one).toLowerCase()] ?? "image/png";
      return `data:${type};base64,${readFileSync(one).toString("base64")}`;
    } catch (error) {
      return fail(error.code === "ENOENT"
        ? `${VERB}: no file at ${one}, so nothing was sent`
        : `${VERB}: ${one} could not be read (${error.code ?? error.message}), so nothing was sent`);
    }
  });
};

/* Judged on the seconds typed: `deadlineOf` reads a value it cannot use as no value, which would
   hold this call to the configured wait while the caller believes their own number is in force, and
   the clock counts whole milliseconds, so a wait under one of them would spend a picture on nought. */
const waitFrom = (raw) => {
  if (raw === undefined) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < MIN_WAIT_SECONDS) {
    fail(`${VERB}: --wait takes a number of seconds, ${MIN_WAIT_SECONDS} at the least, and \`${raw}\` is not one.`
      + `\n  Nothing was sent. Ask again with the seconds this call may wait, ${FLOOR_SECONDS} or more.`);
  }
  return value;
};

/* The caller's own number where one was typed; otherwise the configured wait, raised to what the
   gateway can take, and saying which of the two it was. */
const deadlineFor = (asked) => {
  if (asked !== null) return deadlineOf(asked);
  const configured = waitSeconds();
  const deadline = deadlineOf(Math.max(configured, FLOOR_SECONDS));
  return configured >= FLOOR_SECONDS ? { ...deadline, from: "waitSeconds in config.json" }
    : { ...deadline, from: "this action's floor, above the gateway's own 115s" };
};

const redactorsFor = (key) => {
  const struck = (text) => String(text).split(key).join("<the key>");
  return { struck, shown: (text) => struck(text).slice(0, BODY_CHARS) };
};

/* After the send, only the gateway's own word that nothing went upstream makes an ending cheap: a
   4xx is refused before any account is asked, and a 503 found no account to ask. */
const nothingMade = (status) => (status >= 400 && status < 500) || status === 503;

const refusedBy = (answer, text, shown) => {
  const held = parsedOr(text)?.error;
  const code = shown(held?.code ?? held?.type ?? "no code");
  const said = held?.message ? shown(held.message) : `${text.length} byte(s) that are not the gateway's error shape`;
  const after = answer.headers.get("retry-after");
  const wait = answer.status === 503 && after ? `\n  The gateway asks for ${shown(after)}s before another request.` : "";
  fail(`${VERB}: the gateway answered ${answer.status} ${code} — ${said}\n  ${nothingMade(answer.status) ? NONE : MAYBE}${wait}`);
};

/* The URL is fetched as an ordinary GET: the image already exists, so following a redirect or
   failing here costs nothing but the file, and the URL is printed either way. */
const savedFrom = async (picture, save, deadline, struck) => {
  if (picture.bytes) return writeFileSync(save, picture.bytes);
  const clock = clockFor(deadline);
  const drawn = await fetch(picture.url, { signal: clock });
  if (!drawn.ok) throw new Error(`the image at ${struck(picture.url)} answered ${drawn.status}`);
  const bytes = await bytesWithin(drawn, clock);
  if (!bytes.length) throw new Error(`the image at ${struck(picture.url)} answered ${drawn.status} with no bytes`);
  return writeFileSync(save, bytes);
};

/* Read strictly, because Node decodes base64 leniently: stray characters decode to no bytes and a
   group cut short to fewer, either of which written to the path would read as a picture saved. */
const pictureIn = (item) => {
  const bytes = typeof item?.b64_json === "string" && BASE64.test(item.b64_json) ? Buffer.from(item.b64_json, "base64") : null;
  return { bytes: bytes?.length ? bytes : null, url: typeof item?.url === "string" && URL_LIKE.test(item.url) ? item.url : null };
};

const delivered = async (picture, size, save, deadline, { struck, shown }) => {
  const lines = [];
  if (picture.url) lines.push(`image     ${struck(picture.url)}`);
  if (size) lines.push(`size      ${struck(size)}, the size sent being a hint the backend reads loosely`);
  if (save) {
    try {
      await savedFrom(picture, save, deadline, struck);
    } catch (error) {
      if (lines.length) console.log(lines.join("\n"));
      return fail(`${VERB}: the image was made and did not reach ${save} — ${shown(ranOut(error, deadline))}.`
        + "\n  It is not sent again.");
    }
    lines.push(`saved     ${save}`);
  } else if (!picture.url) {
    return fail(`${VERB}: the image came back as bytes rather than a URL, and bytes are never printed here.`
      + `\n  ${MAYBE}\n  Ask with --save <path> to write the next one.`);
  }
  return console.log(lines.join("\n"));
};

/* A followed 307 is the same POST sent a second time, which is a second image. */
const posted = async (held, body, deadline, shown) => {
  try {
    const clock = clockFor(deadline);
    const answer = await fetch(`${held.url}/v1/images/${body.images ? "edits" : "generations"}`, {
      method: "POST",
      headers: { authorization: `Bearer ${held.key}`, "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: clock,
      redirect: "error",
    });
    return { answer, text: await textWithin(answer, clock) };
  } catch (error) {
    return fail(`${VERB}: ${shown(ranOut(error, deadline))}\n  ${MAYBE}`);
  }
};

const drawn = async ({ prompt, ratio, save, given, asked }) => {
  const held = settings();
  const images = referencesOf(given);
  const deadline = deadlineFor(asked);
  const redact = redactorsFor(held.key);
  const body = {
    model: MODEL,
    prompt,
    n: 1,
    size: sizeFor(ratio),
    response_format: save ? "b64_json" : "url",
    ...(images.length ? { images: images.map((image_url) => ({ image_url })) } : {}),
  };
  console.error(`${VERB}: one image over the Codex gateway, waiting up to ${deadline.value}s (${deadline.from}).`);
  const { answer, text } = await posted(held, body, deadline, redact.shown);
  if (!answer.ok) refusedBy(answer, text, redact.shown);
  const parsed = parsedOr(text);
  const picture = pictureIn(parsed?.data?.[0]);
  /* The body is not quoted: a torn answer is exactly where the image's base64 would be printed. */
  if (!picture.bytes && !picture.url) {
    fail(`${VERB}: the gateway answered ${answer.status} with ${text.length} byte(s) that carry no image to read.\n  ${MAYBE}`);
  }
  return await delivered(picture, parsed.size, save, deadline, redact);
};

/** Everything the caller owes is judged before the gateway is even read, so no picture is spent learning it. */
export const image = async (argv) => {
  const row = { usage: IMAGE_USAGE };
  const prompt = promptFirst(argv, VERB, IMAGE_USAGE, () =>
    flags(pullRepeated(argv, "--file", VERB, row).rest, VERB, [], row));
  const { values: given, rest } = pullRepeated(argv.slice(1), "--file", VERB, row);
  const { ratio, save, wait } = flags(rest, VERB, [], row);
  const asked = waitFrom(wait);
  const prefix = savedFraming();
  stating(VERB, prefix, ratio);
  const shape = ratioFrom(VERB, ratio);
  return await drawn({ prompt: imageAsk(prefix, prompt, shape), ratio: shape, save, given, asked });
};
