/* `forge codex image`: the real CLI against a stub wearing the gateway's OpenAI images shape, so a
   case can say what one call sent and how many times. The claim under most of these is one request
   and never a second, and a picture that may exist said to be one. */
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import test from "node:test";

import { ranAsync, tempHome } from "../fixtures.mjs";

const FORGE = new URL("../../bin/forge", import.meta.url).pathname;
const KEY = "sk_codex_stub_never_a_real_credential";
const FRAMING = "Flat vector illustration, muted palette, no text anywhere.";
const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
const B64 = PNG.toString("base64");

const state = { sent: [], downloads: 0, mode: "b64", hosted: 200, origin: null, hung: [] };

const json = (res, status, body, headers = {}) =>
  res.writeHead(status, { "content-type": "application/json", ...headers }).end(JSON.stringify(body));
const GATEWAY = {
  b64: (res) => json(res, 200, { data: [{ b64_json: B64 }], size: "1370x1148" }),
  url: (res) => json(res, 200, { data: [{ url: `${state.origin}/hosted.png` }], size: "1536x1024" }),
  garbled: (res) => json(res, 200, { data: [{ b64_json: "!!!!" }] }),
  cut: (res) => json(res, 200, { data: [{ b64_json: B64.slice(0, -1) }] }),
  torn: (res) => res.writeHead(200, { "content-type": "application/json" }).end(`{"data":[{"b64_json":"${B64.slice(0, 12)}`),
  /* Held and never answered, so the client's own clock is what ends the call. */
  hang: state.hung.push.bind(state.hung),
  drop: (res) => res.socket.destroy(),
};
const erring = (status, code) => (res) => json(res, status,
  { error: { message: `stub ${code}`, type: "api_error", code } }, { "retry-after": "30" });
for (const [status, code] of [[502, "upstream_unknown_outcome"], [504, "upstream_timeout"], [500, "internal"],
  [503, "all_unavailable"], [400, "n_unsupported"], [429, "rate_limited"]]) GATEWAY[String(status)] = erring(status, code);

const stub = createServer((request, response) => {
  const { pathname } = new URL(request.url, state.origin);
  if (pathname === "/hosted.png") {
    state.downloads += 1;
    if (state.hosted === "empty") return response.writeHead(200, { "content-type": "image/png" }).end();
    return state.hosted === 200 ? response.writeHead(200, { "content-type": "image/png" }).end(PNG)
      : response.writeHead(state.hosted).end();
  }
  let body = "";
  request.on("data", (chunk) => {
    body += chunk;
  });
  request.on("end", () => {
    state.sent.push({ method: request.method, path: pathname, auth: request.headers.authorization, body: JSON.parse(body) });
    return GATEWAY[state.mode](response);
  });
  return undefined;
});
await new Promise((listening) => stub.listen(0, "127.0.0.1", listening));
state.origin = `http://127.0.0.1:${stub.address().port}`;
test.after(() => {
  for (const held of state.hung) held.socket.destroy();
  stub.close();
});

const home = tempHome("codex-image");
test.after(() => home.remove());

/* No profile stands behind the codex store here: CLAUDE_PROXY_ENV points at nothing, so the only
   endpoint and key are the ones this file writes, and never the developer's own. */
const env = ({ codex = true, framing = true, waitSeconds = 5 } = {}) => {
  mkdirSync(join(home.path, "forge"), { recursive: true });
  writeFileSync(join(home.path, "forge", "config.json"), JSON.stringify({
    url: `${state.origin}/mcp`, token: "not-a-real-tracker-token", retrySeconds: 0, waitSeconds,
    ...(framing ? { chatgpt: { prefix: FRAMING } } : {}),
    ...(codex ? { codex: { url: `${state.origin}/`, key: KEY } } : {}),
  }));
  return { ...process.env, HOME: home.path, XDG_CONFIG_HOME: home.path,
    CLAUDE_PROXY_ENV: join(home.path, "no-profile.env"), FORGE_SESSION_ID: "codex-image-suite" };
};

const ran = (argv, options = {}) => {
  state.sent.length = 0;
  state.downloads = 0;
  return ranAsync(FORGE, ["codex", "image", ...argv], env(options));
};

const saveAt = (name) => {
  const path = join(home.path, name);
  rmSync(path, { force: true });
  return path;
};

const both = (run) => `${run.stdout}${run.stderr}`;
const MAYBE = /may already have been made and counted against the Codex seat's quota/u;

test("1. one POST to the generations route, under the codex key, with the image model, n 1 and a size leaning with the ratio", async () => {
  state.mode = "url";
  for (const [ratio, size] of [["16:9", "1536x1024"], ["2:3", "1024x1536"], ["1:1", "1024x1024"]]) {
    const run = await ran(["a fox asleep", "--ratio", ratio]);
    assert.equal(run.status, 0, run.stderr);
    assert.equal(state.sent.length, 1, "one picture is one request");
    const [sent] = state.sent;
    assert.equal(sent.method, "POST");
    assert.equal(sent.path, "/v1/images/generations");
    assert.equal(sent.auth, `Bearer ${KEY}`);
    assert.equal(sent.body.model, "cx/gpt-image-2.5");
    assert.equal(sent.body.n, 1);
    assert.equal(sent.body.size, size, `--ratio ${ratio}`);
  }
});

test("2. --file sends the one request to edits, a path as a data URI and a url as given", async () => {
  state.mode = "url";
  const reference = join(home.path, "reference.png");
  writeFileSync(reference, PNG);
  const run = await ran(["make it blue", "--ratio", "1:1", "--file", reference, "--file", "https://example.test/cube.jpg"]);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(state.sent.length, 1);
  assert.equal(state.sent[0].path, "/v1/images/edits");
  assert.deepEqual(state.sent[0].body.images, [
    { image_url: `data:image/png;base64,${B64}` },
    { image_url: "https://example.test/cube.jpg" },
  ]);
});

test("3. more than five references, or a local path that cannot be read, is refused with nothing sent", async () => {
  const six = Array.from({ length: 6 }, (_, at) => ["--file", `https://example.test/${at}.png`]).flat();
  const many = await ran(["a fox", "--ratio", "1:1", ...six]);
  assert.equal(many.status, 1);
  assert.match(many.stderr, /6 reference images, and the gateway takes 5\. Nothing was sent\./u);
  assert.equal(state.sent.length, 0);
  const missing = await ran(["a fox", "--ratio", "1:1", "--file", "https://example.test/a.png", "--file", join(home.path, "absent.png")]);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /no file at .*absent\.png, so nothing was sent/u);
  assert.equal(state.sent.length, 0);
});

test("4. the prompt is the framing, the caller's words, then the ratio line, in the words chatgpt image composes", async () => {
  state.mode = "url";
  await ran(["a fox asleep", "--ratio", "9:16"]);
  const said = state.sent[0].body.prompt;
  /* Whole, and the same text chatgpt image's suite expects of its own composition. */
  assert.equal(said, `${FRAMING}\n\na fox asleep\n\nAspect ratio: 9:16. Render the image at exactly 9:16 and at `
    + "no other shape — do not crop or pad it to a different one.");
  assert.ok(said.startsWith(`${FRAMING}\n\na fox asleep\n\n`), said);
  assert.match(said.split("\n").at(-1), /^Aspect ratio: 9:16\. Render the image at exactly 9:16/u);
});

test("5. no framing, no ratio or a malformed ratio is refused before anything is sent", async () => {
  const unframed = await ran(["a fox", "--ratio", "1:1"], { framing: false });
  assert.equal(unframed.status, 1);
  assert.match(unframed.stderr, /states no framing\.\n {2}framing {3}none saved — `forge doctor --chatgpt-prefix <[^>]+>`/u);
  const unshaped = await ran(["a fox"]);
  assert.equal(unshaped.status, 1);
  assert.match(unshaped.stderr, /states no ratio\./u);
  const crooked = await ran(["a fox", "--ratio", "wide"]);
  assert.equal(crooked.status, 1);
  assert.match(crooked.stderr, /--ratio takes two whole numbers above nought .* `wide` is not one/u);
  assert.equal(state.sent.length, 0);
});

test("6. --save writes the image's bytes, from b64_json and from a url alike", async () => {
  for (const mode of ["b64", "url"]) {
    state.mode = mode;
    state.hosted = 200;
    const path = saveAt(`saved-${mode}.png`);
    const run = await ran(["a fox", "--ratio", "1:1", "--save", path]);
    assert.equal(run.status, 0, run.stderr);
    assert.deepEqual(readFileSync(path), PNG, `the ${mode} answer did not land`);
    assert.ok(run.stdout.includes(`saved     ${path}\n`), run.stdout);
    assert.equal(state.sent[0].body.response_format, "b64_json", "a save asks for the bytes");
  }
});

test("7. without --save the action asks for a url and prints it on an image line", async () => {
  state.mode = "url";
  const run = await ran(["a fox", "--ratio", "1:1"]);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(state.sent[0].body.response_format, "url");
  assert.match(run.stdout, new RegExp(`^image {5}${state.origin}/hosted\\.png$`, "mu"));
});

test("8. no base64 of the image reaches the terminal, on success or on any failure", async () => {
  const runs = [];
  state.mode = "b64";
  runs.push(await ran(["a fox", "--ratio", "1:1", "--save", saveAt("quiet.png")]));
  runs.push(await ran(["a fox", "--ratio", "1:1"]));
  state.mode = "torn";
  runs.push(await ran(["a fox", "--ratio", "1:1", "--save", saveAt("torn.png")]));
  for (const run of runs) assert.ok(!both(run).includes(B64.slice(0, 12)), both(run));
});

test("9. a 4xx or a 503 says no image was made", async () => {
  for (const mode of ["400", "429", "503"]) {
    state.mode = mode;
    const run = await ran(["a fox", "--ratio", "1:1"]);
    assert.match(run.stderr, /No image was made\./u, `${mode}: ${run.stderr}`);
    assert.doesNotMatch(run.stderr, MAYBE);
  }
});

test("10. a 502, 504, other 5xx, torn answer, dropped connection or timeout says the image may have been made", async () => {
  for (const mode of ["502", "504", "500", "torn", "drop", "hang"]) {
    state.mode = mode;
    const run = await ran(["a fox", "--ratio", "1:1", ...(mode === "hang" ? ["--wait", "1"] : [])]);
    assert.match(run.stderr, MAYBE, `${mode}: ${run.stderr}`);
  }
});

test("11. every failure after the send exits non-zero with one POST", async () => {
  for (const mode of ["502", "504", "500", "503", "400", "429", "torn", "drop"]) {
    state.mode = mode;
    const run = await ran(["a fox", "--ratio", "1:1"]);
    assert.equal(run.status, 1, mode);
    assert.equal(state.sent.length, 1, `${mode} was sent ${state.sent.length} times`);
  }
});

/* Every field of the gateway's error is somebody else's text, the code as much as the message. */
test("11. a gateway error echoing the key in its code or message prints neither", async () => {
  GATEWAY.echo = erring(400, KEY);
  state.mode = "echo";
  const run = await ran(["a fox", "--ratio", "1:1"]);
  assert.equal(run.status, 1);
  assert.ok(!both(run).includes(KEY), both(run));
  assert.match(run.stderr, /400 <the key> — stub <the key>/u);
});

test("8. an answer whose bytes are not whole base64 is no picture: nothing is written and the image may exist", async () => {
  for (const mode of ["garbled", "cut"]) {
    state.mode = mode;
    const path = saveAt("kept.png");
    writeFileSync(path, "what was here before");
    const run = await ran(["a fox", "--ratio", "1:1", "--save", path]);
    assert.equal(run.status, 1, mode);
    assert.match(run.stderr, /carry no image to read/u, mode);
    assert.match(run.stderr, MAYBE, mode);
    assert.doesNotMatch(run.stdout, /saved/u, mode);
    assert.equal(readFileSync(path, "utf8"), "what was here before", mode);
    assert.equal(state.sent.length, 1, mode);
  }
});

test("11. a Retry-After echoing the key is not printed", async () => {
  GATEWAY.echoAfter = (res) => json(res, 503, { error: { message: "stub busy", code: "all_unavailable" } }, { "retry-after": KEY });
  state.mode = "echoAfter";
  const run = await ran(["a fox", "--ratio", "1:1"]);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /No image was made\./u);
  assert.match(run.stderr, /asks for <the key>s before another request/u);
  assert.ok(!both(run).includes(KEY), both(run));
  assert.equal(state.sent.length, 1);
});

test("12. no codex endpoint or key is refused before anything is sent, naming the doctor flags", async () => {
  const run = await ran(["a fox", "--ratio", "1:1"], { codex: false });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /forge doctor --codex-url <endpoint> --codex-key <key>/u);
  assert.match(run.stderr, /Nothing was sent\./u);
  assert.equal(state.sent.length, 0);
});

test("13. the wait is the larger of waitSeconds and 130 unless --wait sets it, and a wait that is no number is refused", async () => {
  state.mode = "url";
  assert.match((await ran(["a fox", "--ratio", "1:1"], { waitSeconds: 5 })).stderr,
    /waiting up to 130s \(this action's floor/u);
  assert.match((await ran(["a fox", "--ratio", "1:1"], { waitSeconds: 200 })).stderr,
    /waiting up to 200s \(waitSeconds in config\.json\)/u);
  assert.match((await ran(["a fox", "--ratio", "1:1", "--wait", "7"])).stderr,
    /waiting up to 7s \(the caller's own deadline\)/u);
  for (const wait of ["soon", "0", "-3", "0.0001"]) {
    const run = await ran(["a fox", "--ratio", "1:1", "--wait", wait]);
    assert.equal(run.status, 1, wait);
    assert.match(run.stderr, new RegExp(`--wait takes a number of seconds, 0\\.001 at the least, and \`${wait}\` is not one`, "u"));
    assert.equal(state.sent.length, 0, `--wait ${wait} sent something`);
  }
});

test("14. a flag the usage does not list is refused with nothing sent", async () => {
  for (const extra of [["--model", "gpt-image-2"], ["--resume", "conv-1"], ["--via", "codex"], ["--chatgpt-prefix", "x"]]) {
    const run = await ran(["a fox", "--ratio", "1:1", ...extra]);
    assert.equal(run.status, 1, extra.join(" "));
    assert.match(run.stderr, new RegExp(extra[0], "u"));
    assert.equal(state.sent.length, 0, `${extra[0]} sent something`);
  }
});

test("15. an image call writes nothing to the consult log or the pending state", async () => {
  rmSync(join(home.path, "forge", "codex-log.jsonl"), { force: true });
  rmSync(join(home.path, "forge", "codex.json"), { force: true });
  state.mode = "b64";
  const run = await ran(["a fox", "--ratio", "1:1", "--save", saveAt("unlogged.png")]);
  assert.equal(run.status, 0, run.stderr);
  assert.ok(!existsSync(join(home.path, "forge", "codex-log.jsonl")), "a consult log row was written");
  assert.ok(!existsSync(join(home.path, "forge", "codex.json")), "codex pending state was written");
});

test("16. codex -h, its usage line and the codex row of forge -h name image, and the headline is not review alone", async () => {
  const codexHelp = (await ranAsync(FORGE, ["codex", "-h"], env())).stdout;
  assert.match(codexHelp.split("\n")[0], /\|image>/u);
  assert.match(codexHelp, /^ {2}image {5}one picture/mu);
  assert.doesNotMatch(codexHelp, /A second model reviews what this turn changed/u);
  const forgeHelp = (await ranAsync(FORGE, ["-h"], env())).stdout;
  assert.match(forgeHelp, /codex <[^>]*\|image>/u);
  assert.match(forgeHelp, /a second review of what this turn changed, or a picture/u);
});

test("17. codex image -h says a picture spends the Codex window a consult does", async () => {
  const run = await ran(["-h"]);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /spends the same Codex 5 h window a consult does/u);
  assert.equal(state.sent.length, 0);
});

test("19. without --save, an answer carrying only bytes is refused and names --save", async () => {
  state.mode = "b64";
  const run = await ran(["a fox", "--ratio", "1:1"]);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /came back as bytes rather than a URL/u);
  assert.match(run.stderr, /Ask with --save <path> to write the next one\./u);
});

test("20. a failed or empty download of a returned url says the image was made and not saved, with one POST", async () => {
  state.mode = "url";
  for (const hosted of [404, "empty"]) {
    state.hosted = hosted;
    const path = saveAt("never.png");
    const run = await ran(["a fox", "--ratio", "1:1", "--save", path]);
    assert.equal(run.status, 1, String(hosted));
    assert.match(run.stderr, /the image was made and did not reach .*never\.png/u);
    assert.match(run.stderr, /It is not sent again\./u);
    assert.equal(state.sent.length, 1);
    assert.equal(state.downloads, 1);
    assert.ok(!existsSync(path), `${hosted} left a file`);
  }
  state.hosted = 200;
});
