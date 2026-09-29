/* The Codex route of `forge chatgpt image`: the real CLI against one stub wearing both backends'
   shapes, the gateway's OpenAI images API and the web tool's MCP answer, so a case can say which of
   the two a call reached and how many times. The claim under most of these is that the route is the
   caller's choice and one request: nothing falls back, and nothing is sent a second time. */
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import test from "node:test";

import { ranAsync, tempHome } from "../../../fixtures.mjs";
import { patience } from "../../../patience.mjs";

const FORGE = new URL("../../../../bin/forge", import.meta.url).pathname;
const KEY = "sk_codex_stub_never_a_real_credential";
const WEB_KEY = "sm_stub_key_never_a_real_credential";
const FRAMING = "Flat vector illustration, muted palette, no text anywhere.";
const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
const B64 = PNG.toString("base64");

const state = { gateway: [], web: [], mode: "b64", web_mode: "no_browser", origin: null, hung: [] };

const GATEWAY = {
  b64: (res) => res.writeHead(200, { "content-type": "application/json" })
    .end(JSON.stringify({ data: [{ b64_json: B64 }], size: "1370x1148" })),
  url: (res) => res.writeHead(200, { "content-type": "application/json" })
    .end(JSON.stringify({ data: [{ url: `${state.origin}/hosted.png` }], size: "1536x1024" })),
  torn: (res) => res.writeHead(200, { "content-type": "application/json" }).end(`{"data":[{"b64_json":"${B64.slice(0, 12)}`),
  /* Held and never answered, so the client's own clock is what ends the call. */
  hang: state.hung.push.bind(state.hung),
  drop: (res) => res.socket.destroy(),
};
const erring = (status, code) => (res) => res.writeHead(status, { "content-type": "application/json", "retry-after": "30" })
  .end(JSON.stringify({ error: { message: `stub ${code}`, type: "api_error", code } }));
for (const [status, code] of [[502, "upstream_unknown_outcome"], [504, "upstream_timeout"], [500, "internal"],
  [503, "all_unavailable"], [400, "n_unsupported"], [429, "rate_limited"]]) GATEWAY[String(status)] = erring(status, code);

const WEB = {
  no_browser: (res) => res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({
    jsonrpc: "2.0", id: 1,
    result: { isError: true, content: [{ type: "text", text: "turn failed: no_browser — Canawan had no browser free" }] },
  })),
  rate: (res) => res.writeHead(429, { "content-type": "application/json" })
    .end(JSON.stringify({ error: "upstream_rate_limited" })),
  other: (res) => res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({
    jsonrpc: "2.0", id: 1, result: { isError: true, content: [{ type: "text", text: "turn failed: thread_lost" }] },
  })),
};

const stub = createServer((request, response) => {
  const { pathname } = new URL(request.url, state.origin);
  if (pathname === "/hosted.png") return response.writeHead(200, { "content-type": "image/png" }).end(PNG);
  let body = "";
  request.on("data", (chunk) => {
    body += chunk;
  });
  request.on("end", () => {
    if (pathname === "/mcp") {
      state.web.push(JSON.parse(body));
      return WEB[state.web_mode](response);
    }
    state.gateway.push({ path: pathname, auth: request.headers.authorization, body: JSON.parse(body) });
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

const home = tempHome("chatgpt-codex");
test.after(() => home.remove());

/* No profile stands behind the codex store here: CLAUDE_PROXY_ENV points at nothing, so the only
   endpoint and key are the ones this file writes, and never the developer's own. */
const env = ({ codex = true, waitSeconds = 5 } = {}) => {
  mkdirSync(join(home.path, "forge"), { recursive: true });
  writeFileSync(join(home.path, "forge", "config.json"), JSON.stringify({
    url: `${state.origin}/mcp`, token: "not-a-real-tracker-token", retrySeconds: 0, waitSeconds,
    chatgpt: { url: `${state.origin}/mcp`, key: WEB_KEY, prefix: FRAMING },
    ...(codex ? { codex: { url: `${state.origin}/`, key: KEY } } : {}),
  }));
  return { ...process.env, HOME: home.path, XDG_CONFIG_HOME: home.path,
    CLAUDE_PROXY_ENV: join(home.path, "no-profile.env"), FORGE_SESSION_ID: "chatgpt-codex-suite" };
};

const ran = (argv, options = {}) => {
  state.gateway.length = 0;
  state.web.length = 0;
  return ranAsync(FORGE, ["chatgpt", "image", ...argv], env(options));
};

const saveAt = (name) => {
  const path = join(home.path, name);
  rmSync(path, { force: true });
  return path;
};

const both = (run) => `${run.stdout}${run.stderr}`;

test("1. one POST to the gateway's generations route, under the codex key, with the image model and n 1", async () => {
  state.mode = "url";
  const run = await ran(["a fox asleep", "--ratio", "16:9", "--via", "codex"]);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(state.gateway.length, 1, "one picture is one request");
  const [sent] = state.gateway;
  assert.equal(sent.path, "/v1/images/generations");
  assert.equal(sent.auth, `Bearer ${KEY}`);
  assert.equal(sent.body.model, "cx/gpt-image-2.5");
  assert.equal(sent.body.n, 1);
  assert.equal(state.web.length, 0, "and nothing reached ChatGPT web");
});

test("2. the prompt is the framing, the caller's words, then the ratio line last", async () => {
  state.mode = "url";
  await ran(["a fox asleep", "--ratio", "9:16", "--via", "codex"]);
  const said = state.gateway[0].body.prompt;
  assert.ok(said.startsWith(`${FRAMING}\n\na fox asleep\n\n`), said);
  assert.match(said.split("\n").at(-1), /^Aspect ratio: 9:16\. Render the image at exactly 9:16/u);
});

test("3. the size hint leans the way the ratio does", async () => {
  state.mode = "url";
  for (const [ratio, size] of [["16:9", "1536x1024"], ["2:3", "1024x1536"], ["1:1", "1024x1024"]]) {
    await ran(["a fox", "--ratio", ratio, "--via", "codex"]);
    assert.equal(state.gateway[0].body.size, size, `--ratio ${ratio}`);
  }
});

test("4. --save writes the image's bytes, from b64_json and from a url alike", async () => {
  for (const mode of ["b64", "url"]) {
    state.mode = mode;
    const path = saveAt(`saved-${mode}.png`);
    const run = await ran(["a fox", "--ratio", "1:1", "--via", "codex", "--save", path]);
    assert.equal(run.status, 0, run.stderr);
    assert.deepEqual(readFileSync(path), PNG, `the ${mode} answer did not land`);
    assert.ok(run.stdout.includes(`saved     ${path}\n`), run.stdout);
    assert.equal(state.gateway[0].body.response_format, "b64_json", "a save asks for the bytes");
  }
});

test("5. no base64 of the image reaches the terminal, on success or on any failure", async () => {
  const runs = [];
  state.mode = "b64";
  runs.push(await ran(["a fox", "--ratio", "1:1", "--via", "codex", "--save", saveAt("quiet.png")]));
  runs.push(await ran(["a fox", "--ratio", "1:1", "--via", "codex"]));
  state.mode = "torn";
  runs.push(await ran(["a fox", "--ratio", "1:1", "--via", "codex", "--save", saveAt("torn.png")]));
  for (const run of runs) assert.ok(!both(run).includes(B64.slice(0, 12)), both(run));
  assert.match(runs[1].stderr, /came back as bytes rather than a URL/u);
});

test("6. without --save the route asks for a url and prints it on an image line", async () => {
  state.mode = "url";
  const run = await ran(["a fox", "--ratio", "1:1", "--via", "codex"]);
  assert.equal(state.gateway[0].body.response_format, "url");
  assert.match(run.stdout, new RegExp(`^image {5}${state.origin}/hosted\\.png$`, "mu"));
});

test("7. --file sends the one request to edits, a path as a data URI and a url as given", async () => {
  state.mode = "url";
  const reference = join(home.path, "reference.png");
  writeFileSync(reference, PNG);
  const run = await ran(["make it blue", "--ratio", "1:1", "--via", "codex", "--file", reference,
    "--file", "https://example.test/cube.jpg"]);
  assert.equal(run.status, 0, run.stderr);
  assert.equal(state.gateway.length, 1);
  assert.equal(state.gateway[0].path, "/v1/images/edits");
  assert.deepEqual(state.gateway[0].body.images, [
    { image_url: `data:image/png;base64,${B64}` },
    { image_url: "https://example.test/cube.jpg" },
  ]);
});

test("8. --resume or --model beside --via codex is refused with nothing sent", async () => {
  for (const extra of [["--resume", "conv-1"], ["--model", "gpt-image-2"]]) {
    const run = await ran(["a fox", "--ratio", "1:1", "--via", "codex", ...extra]);
    assert.equal(run.status, 1, extra.join(" "));
    assert.match(run.stderr, new RegExp(`${extra[0]} belong to ChatGPT web`, "u"));
    assert.equal(state.gateway.length + state.web.length, 0, `${extra[0]} sent something`);
  }
});

test("9. --file without --via codex, or a --via that is not codex, is refused with nothing sent", async () => {
  const noVia = await ran(["a fox", "--ratio", "1:1", "--file", "https://example.test/a.png"]);
  assert.equal(noVia.status, 1);
  assert.match(noVia.stderr, /only the Codex route takes\. Nothing was sent\.\n {2}Add --via codex/u);
  assert.equal(state.gateway.length + state.web.length, 0);
  const stranger = await ran(["a fox", "--ratio", "1:1", "--via", "dalle"]);
  assert.equal(stranger.status, 1);
  assert.match(stranger.stderr, /--via takes `codex`, and `dalle` is not a route/u);
  assert.equal(state.gateway.length + state.web.length, 0);
});

test("10. no codex endpoint or key is refused before anything is sent, naming both doctor flags", async () => {
  const run = await ran(["a fox", "--ratio", "1:1", "--via", "codex"], { codex: false });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /forge doctor --codex-url <endpoint>\n {2}forge doctor --codex-key <key>/u);
  assert.equal(state.gateway.length + state.web.length, 0);
});

const MAYBE = /may already have been made and counted against the Codex seat's quota/u;

test("11. a 502, 504, other 5xx, torn answer, dropped connection or timeout says the image may have been made", async () => {
  for (const mode of ["502", "504", "500", "torn", "drop", "hang"]) {
    state.mode = mode;
    const run = await ran(["a fox", "--ratio", "1:1", "--via", "codex", ...(mode === "hang" ? ["--wait", "1"] : [])]);
    assert.match(run.stderr, MAYBE, `${mode}: ${run.stderr}`);
  }
});

test("12. a 4xx or a 503 says no image was made", async () => {
  for (const mode of ["400", "429", "503"]) {
    state.mode = mode;
    const run = await ran(["a fox", "--ratio", "1:1", "--via", "codex"]);
    assert.match(run.stderr, /No image was made\./u, `${mode}: ${run.stderr}`);
    assert.doesNotMatch(run.stderr, MAYBE);
  }
});

/* Every field of the gateway's error is somebody else's text, the code as much as the message. */
test("12. a gateway error echoing the key in its code or message prints neither", async () => {
  GATEWAY.echo = erring(400, KEY);
  state.mode = "echo";
  const run = await ran(["a fox", "--ratio", "1:1", "--via", "codex"]);
  assert.equal(run.status, 1);
  assert.ok(!both(run).includes(KEY), both(run));
  assert.match(run.stderr, /400 <the key> — stub <the key>/u);
});

test("13. every failure after the send exits non-zero with one gateway request and none to ChatGPT web", async () => {
  for (const mode of ["502", "504", "500", "503", "400", "429", "torn", "drop"]) {
    state.mode = mode;
    const run = await ran(["a fox", "--ratio", "1:1", "--via", "codex"]);
    assert.equal(run.status, 1, mode);
    assert.equal(state.gateway.length, 1, `${mode} was sent ${state.gateway.length} times`);
    assert.equal(state.web.length, 0, `${mode} fell back to ChatGPT web`);
  }
});

/* The printed line is typed back through a shell, because a command that quotes a prompt wrongly
   is the defect and only running it can tell. */
test("14. a web failure on no_browser or upstream_rate_limited prints the --via codex command, and it runs", async () => {
  const path = saveAt("from-web.png");
  for (const mode of ["no_browser", "rate"]) {
    state.web_mode = mode;
    const run = await ran(["a fox's den", "--ratio", "16:9", "--save", path]);
    assert.equal(run.status, 1);
    const line = run.stderr.split("\n").find((one) => one.trim().startsWith("forge chatgpt image"));
    assert.equal(line?.trim(), `forge chatgpt image 'a fox'\\''s den' --ratio 16:9 --via codex --save ${path}`, run.stderr);
  }
  state.mode = "b64";
  state.gateway.length = 0;
  const line = (await ran(["a fox's den", "--ratio", "16:9", "--save", path])).stderr.split("\n")
    .find((one) => one.trim().startsWith("forge chatgpt image")).trim();
  /* Spawned without blocking: this process is also the stub the command talks to. */
  const typed = await ranAsync("sh", ["-c", line.replace(/^forge /u, `${FORGE} `)], env());
  assert.equal(typed.status, 0, typed.stderr);
  assert.match(state.gateway[0].body.prompt, /\n\na fox's den\n\nAspect ratio: 16:9\./u);
  assert.deepEqual(readFileSync(path), PNG);
});

test("14. no other web failure prints it", async () => {
  state.web_mode = "other";
  const run = await ran(["a fox", "--ratio", "16:9"]);
  assert.equal(run.status, 1);
  assert.doesNotMatch(run.stderr, /--via codex/u);
});

const collected = async (id) => {
  const stop = Date.now() + patience(10_000);
  for (;;) {
    const run = await ranAsync(FORGE, ["chatgpt", "collect", id], env({ waitSeconds: 700 }));
    if (!/still running/u.test(run.stderr) || Date.now() >= stop) return run;
    await new Promise((wake) => setTimeout(wake, 100));
  }
};

test("14. a detached picture that fails on no_browser collects with the same command", async () => {
  state.web_mode = "no_browser";
  const run = await ran(["a fox", "--ratio", "1:1"], { waitSeconds: 700 });
  assert.equal(run.status, 0, run.stderr);
  const id = /^turn {6}(\S+)$/mu.exec(run.stdout)?.[1];
  const read = await collected(id);
  assert.equal(read.status, 1);
  assert.match(read.stderr, /^ {2}forge chatgpt image 'a fox' --ratio 1:1 --via codex$/mu, read.stderr);
});

test("15. that web failure sends nothing to the Codex gateway", async () => {
  state.web_mode = "no_browser";
  const run = await ran(["a fox", "--ratio", "16:9"]);
  assert.equal(run.status, 1);
  assert.equal(state.web.length, 1);
  assert.equal(state.gateway.length, 0);
});

test("16. the wait is the larger of waitSeconds and 130 unless --wait sets it", async () => {
  state.mode = "url";
  assert.match((await ran(["a fox", "--ratio", "1:1", "--via", "codex"], { waitSeconds: 5 })).stderr,
    /waiting up to 130s \(the Codex route's floor/u);
  assert.match((await ran(["a fox", "--ratio", "1:1", "--via", "codex"], { waitSeconds: 200 })).stderr,
    /waiting up to 200s \(waitSeconds in config\.json\)/u);
  assert.match((await ran(["a fox", "--ratio", "1:1", "--via", "codex", "--wait", "7"])).stderr,
    /waiting up to 7s \(the caller's own deadline\)/u);
});

test("17. image -h names --via codex and --file", async () => {
  const run = await ran(["-h"]);
  assert.match(run.stdout, /^ {2}--via codex {4}the Codex gateway draws instead; never a fallback/mu);
  assert.match(run.stdout, /^ {2}--file p\|url {3}with --via codex, a reference image/mu);
});

test("19. more than five references beside --via codex are refused with nothing sent", async () => {
  const six = Array.from({ length: 6 }, (_, at) => ["--file", `https://example.test/${at}.png`]).flat();
  const run = await ran(["a fox", "--ratio", "1:1", "--via", "codex", ...six]);
  assert.equal(run.status, 1);
  assert.match(run.stderr, /6 reference images, and the gateway takes 5\. Nothing was sent\./u);
  assert.equal(state.gateway.length, 0);
  assert.ok(!existsSync(join(home.path, "never.png")));
});
