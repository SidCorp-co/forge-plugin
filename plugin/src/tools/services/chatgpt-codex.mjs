/* `forge chatgpt image --via codex`: one picture over the review gateway's OpenAI-shaped images API,
   for the day ChatGPT web has no browser to draw with. The caller names this route; nothing here
   falls back to it or away from it, and nothing is sent twice. docs/cli/chatgpt-image.md carries
   why the model is a label, the size a hint, and the wait longer than the gateway's own. */
import { readFileSync, writeFileSync } from "node:fs";
import { extname } from "node:path";

import { clockFor, deadlineOf, parsedOr, ranOut, waitSeconds } from "../../wire/request.mjs";
import { fail } from "../../resolve/settings.mjs";
import { machineValue, storeMissing } from "../../resolve/machine/stores.mjs";
import { pathed, typed } from "../../hooks/shell-spans.mjs";

const VERB = "chatgpt image --via codex";
/* The backend serves one model whatever id is sent, so this is the label the gateway lists and no
   caller is offered a choice that changes nothing. */
const MODEL = "cx/gpt-image-2.5";
const REFERENCE_CAP = 5;
/* The gateway ends a call at 115s and the proxy in front of it near 125s; a client that gives up
   first has lost an image the seat already paid for. */
const FLOOR_SECONDS = 130;
const BODY_CHARS = 400;
const URL_LIKE = /^https?:\/\//u;
const TYPES = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif" };

const MAYBE = "The image may already have been made and counted against the Codex seat's quota. It is not sent"
  + " again, here or over ChatGPT web.";
const NONE = "No image was made. Nothing is sent again, here or over ChatGPT web.";

/* A hint and no more: the backend returned 1370x1148 for a square ask, so the ratio still travels
   as the prompt's last line and this only leans the canvas the same way. */
const sizeFor = (ratio) => {
  const [wide, tall] = ratio.split(":").map(Number);
  if (wide === tall) return "1024x1024";
  return wide > tall ? "1536x1024" : "1024x1536";
};

const settings = () => {
  const missing = storeMissing("codex");
  if (missing.length) {
    fail(`${VERB}: no gateway endpoint and key here yet. Set ${missing.length === 2 ? "both" : "it"}:\n  `
      + missing.map((row) => `forge doctor --${row.flag} <${row.asks}>`).join("\n  ") + "\n  Nothing was sent.");
  }
  return { url: machineValue("codex", "url").value.replace(/\/+$/u, ""), key: machineValue("codex", "key").value };
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

/* The caller's own number where one was typed; otherwise the configured wait, raised to what the
   gateway can take, and saying which of the two it was. */
const deadlineFor = (asked) => {
  if (asked !== null) return deadlineOf(asked);
  const configured = waitSeconds();
  const deadline = deadlineOf(Math.max(configured, FLOOR_SECONDS));
  return configured >= FLOOR_SECONDS ? { ...deadline, from: "waitSeconds in config.json" }
    : { ...deadline, from: `the Codex route's floor, above the gateway's own 115s` };
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
  const wait = answer.status === 503 && after ? `\n  The gateway asks for ${after}s before another request.` : "";
  fail(`${VERB}: the gateway answered ${answer.status} ${code} — ${said}\n  ${nothingMade(answer.status) ? NONE : MAYBE}${wait}`);
};

/* The URL is fetched as an ordinary GET: the image already exists, so following a redirect or
   failing here costs nothing but the file, and the URL is printed either way. */
const savedFrom = async (item, save, deadline, struck) => {
  if (item.b64_json) return writeFileSync(save, Buffer.from(item.b64_json, "base64"));
  const drawn = await fetch(item.url, { signal: clockFor(deadline) });
  if (!drawn.ok) throw new Error(`the image at ${struck(item.url)} answered ${drawn.status}`);
  return writeFileSync(save, Buffer.from(await drawn.arrayBuffer()));
};

const delivered = async (held, save, deadline, struck, shown) => {
  const item = held?.data?.[0];
  const lines = [];
  if (item?.url) lines.push(`image     ${struck(item.url)}`);
  if (held?.size) lines.push(`size      ${struck(held.size)}, the size sent being a hint the backend reads loosely`);
  if (save) {
    try {
      await savedFrom(item, save, deadline, struck);
    } catch (error) {
      if (lines.length) console.log(lines.join("\n"));
      return fail(`${VERB}: the image was made and did not reach ${save} — ${shown(ranOut(error, deadline))}.`
        + "\n  It is not sent again.");
    }
    lines.push(`saved     ${save}`);
  } else if (!item.url) {
    return fail(`${VERB}: the image came back as bytes rather than a URL, and bytes are never printed here.`
      + `\n  ${MAYBE}\n  Ask with --save <path> to write the next one.`);
  }
  return console.log(lines.join("\n"));
};

/* The two codes that say ChatGPT web could not draw at all. The owner chose a printed command over
   a fallback (ISS-2688): the agent decides whether to spend a Codex image, and nothing here does. */
const NO_DRAWING = /\b(no_browser|upstream_rate_limited)\b/u;

export const codexLine = (prompt, shape, save) => (text) => {
  const code = NO_DRAWING.exec(String(text))?.[1];
  if (!code) return "";
  return `\n  ChatGPT web could not draw this (${code}). The same picture over the Codex route, sent only if you run it:`
    + `\n  forge chatgpt image ${typed(prompt)} --ratio ${shape} --via codex${save ? ` --save ${pathed(save)}` : ""}`;
};

/* Each route's own flags, refused on the other before anything is read: the gateway keeps no
   conversation and serves one model whatever id is sent, and the web action takes no reference. */
export const routeOf = (via, { resume, model, given }) => {
  if (via !== undefined && via !== "codex") {
    fail(`chatgpt image: --via takes \`codex\`, and \`${via}\` is not a route. Nothing was sent.`
      + "\n  Leave --via off to draw over ChatGPT web, or write --via codex.");
  }
  const webOnly = [resume !== undefined && "--resume", model !== undefined && "--model"].filter(Boolean);
  if (via && webOnly.length) {
    fail(`chatgpt image --via codex: ${webOnly.join(" and ")} belong to ChatGPT web — the Codex gateway keeps no`
      + ` conversation and serves one model whatever id is sent. Nothing was sent.\n  Ask again without ${webOnly.join(" and ")}.`);
  }
  if (!via && given.length) {
    fail("chatgpt image: --file sends a reference image, which only the Codex route takes. Nothing was sent."
      + "\n  Add --via codex, or drop --file; a file for ChatGPT web to read goes with a question:"
      + '\n  forge chatgpt ask "<prompt>" --file path');
  }
  return via ?? "web";
};

/** One image over the Codex gateway: `prompt` is already composed under the framing and the ratio. */
export const codexImage = async ({ prompt, ratio, save, given, asked }) => {
  const held = settings();
  const images = referencesOf(given);
  const deadline = deadlineFor(asked);
  const { struck, shown } = redactorsFor(held.key);
  const body = {
    model: MODEL,
    prompt,
    n: 1,
    size: sizeFor(ratio),
    response_format: save ? "b64_json" : "url",
    ...(images.length ? { images: images.map((image_url) => ({ image_url })) } : {}),
  };
  console.error(`chatgpt image: one image over the Codex gateway, waiting up to ${deadline.value}s (${deadline.from}).`);
  let answer = null;
  let text = "";
  try {
    answer = await fetch(`${held.url}/v1/images/${images.length ? "edits" : "generations"}`, {
      method: "POST",
      headers: { authorization: `Bearer ${held.key}`, "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: clockFor(deadline),
      /* A followed 307 is the same POST sent a second time, which is a second image. */
      redirect: "error",
    });
    text = await answer.text();
  } catch (error) {
    fail(`${VERB}: ${shown(ranOut(error, deadline))}\n  ${MAYBE}`);
  }
  if (!answer.ok) refusedBy(answer, text, shown);
  const parsed = parsedOr(text);
  const item = parsed?.data?.[0];
  /* The body is not quoted: a torn answer is exactly where the image's base64 would be printed. */
  if (!item?.b64_json && !item?.url) {
    fail(`${VERB}: the gateway answered ${answer.status} with ${text.length} byte(s) that carry no image to read.\n  ${MAYBE}`);
  }
  return await delivered(parsed, save, deadline, struck, shown);
};
