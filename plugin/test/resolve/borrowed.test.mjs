/* A run home that borrows this machine's credentials by reference: every borrowed key read from the
   file the reference names at the moment it is read, every other key read from and written to the
   home, and a write naming a borrowed key refused before the file is touched. Before this the only way
   a run home reached live data was a copy of the token in scratch (ISS-2612). Each case stands two
   homes up — the machine's and the run's — so a value turning up in the wrong one is a file to read. */
import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { answered, escaped, tempRoom } from "../fixtures.mjs";
import { BORROWED, BORROW_VAR } from "../../src/resolve/machine/borrowed.mjs";
import { STORES } from "../../src/resolve/machine/stores.mjs";

const CLI = fileURLToPath(new URL("../../src/cli.mjs", import.meta.url));
const CONFIG = new URL("../../src/resolve/config.mjs", import.meta.url).href;
const STORES_AT = new URL("../../src/resolve/machine/stores.mjs", import.meta.url).href;

const TOKEN = "machine-token-0123456789abcdef";
const GATEWAY = "machine-gateway-key-0123456789";
const VI_KEY = "machine-vi-key-0123456789abcdef";

/* A port nothing listens on, refused at once, so the report's tracker rows cost no wait. */
const machineHome = (values = {}) => {
  const home = tempRoom("borrowed-machine-");
  mkdirSync(join(home, "forge"));
  const file = join(home, "forge", "config.json");
  writeFileSync(file, JSON.stringify({
    url: "http://127.0.0.1:1/mcp", token: TOKEN, codex: { key: GATEWAY }, vi: { key: VI_KEY },
    retrySeconds: 0, waitSeconds: 0.05, ...values,
  }));
  return file;
};

const runHome = (values = null) => {
  const home = tempRoom("borrowed-run-");
  if (values) {
    mkdirSync(join(home, "forge"));
    writeFileSync(join(home, "forge", "config.json"), JSON.stringify(values));
  }
  return home;
};

const envOf = (home, borrowed, extra = {}) => ({
  PATH: process.env.PATH, HOME: home, XDG_CONFIG_HOME: home, [BORROW_VAR]: borrowed, ...extra,
});

const cli = (home, borrowed, argv) => spawnSync(process.execPath, [CLI, ...argv],
  { encoding: "utf8", cwd: tempRoom("borrowed-cwd-"), env: envOf(home, borrowed) });

/* One module script, so a case reads the resolver the way every verb does and prints what it found. */
const probe = (home, borrowed, body, extra = {}) => {
  const run = spawnSync(process.execPath, ["--input-type=module", "-e",
    `import * as config from ${JSON.stringify(CONFIG)}; import * as stores from ${JSON.stringify(STORES_AT)};`
    + ` import { writeFileSync } from "node:fs"; const out = await (async () => { ${body} })();`
    + " process.stdout.write(JSON.stringify(out));"],
  { encoding: "utf8", cwd: tempRoom("borrowed-cwd-"), env: envOf(home, borrowed, extra) });
  return { ...run, out: () => answered(run) };
};

/** Every file under a home, whole, so a value that reached the home anywhere is found. */
const everything = (dir) => (existsSync(dir) ? readdirSync(dir).map((name) => join(dir, name))
  .map((path) => (statSync(path).isDirectory() ? everything(path) : readFileSync(path, "utf8"))).join("\n") : "");

test("a run home holding no token reports the token set, read from the file it borrows from", () => {
  const borrowed = machineHome();
  const home = runHome();
  const run = cli(home, borrowed, ["doctor"]);
  const row = run.stdout.split("\n").find((line) => /\] token {2,}/u.test(line)) ?? "";
  assert.match(row, new RegExp(`set \\(${TOKEN.length} chars\\) {2}← ${escaped(borrowed)}$`, "u"),
    `the token row names the borrowed file after its arrow:\n${run.stdout}${run.stderr}`);
  assert.doesNotMatch(everything(home), new RegExp(TOKEN, "u"), "and the report wrote the token nowhere under the run home");
});

test("a borrowed key of a store resolves from the borrowed file, and an unborrowed key of it from the run home", () => {
  const borrowed = machineHome();
  const home = runHome({ vi: { model: "run/model", key: "the-run-homes-copy-0123456789" } });
  const run = probe(home, borrowed, `return { key: stores.machineValue("vi", "key"), model: stores.machineValue("vi", "model") };`);
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(run.out().key, { value: VI_KEY, from: borrowed },
    "the borrowed key is the borrowed file's, and the copy the run home held is never read");
  assert.deepEqual(run.out().model, { value: "run/model", from: join(home, "forge", "config.json") });
});

test("a write aimed at a borrowed key is refused naming the key and the borrowed file, and the run home holds none", () => {
  const borrowed = machineHome();
  const home = runHome();
  const run = cli(home, borrowed, ["doctor", "--token", "a-fresh-token-0123456789"]);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stderr, /`token` is borrowed from/u, run.stderr);
  assert.ok(run.stderr.includes(borrowed), `the refusal names the file the key lives in:\n${run.stderr}`);
  assert.match(run.stderr, /nothing was written/u, run.stderr);
  const own = join(home, "forge", "config.json");
  assert.equal(existsSync(own) ? JSON.parse(readFileSync(own, "utf8")).token : undefined, undefined,
    "the run home's config holds no value for the refused key");
  assert.equal(JSON.parse(readFileSync(borrowed, "utf8")).token, TOKEN, "and the borrowed file is untouched");
});

test("a write to an unborrowed key is saved in the run home, which then holds no borrowed value", () => {
  const borrowed = machineHome({ chatgpt: { key: "machine-chatgpt-key-0123456789" } });
  const home = runHome();
  const hidden = cli(home, borrowed, ["doctor", "--hide", "issue"]);
  assert.equal(hidden.status, 0, hidden.stderr);
  const nested = cli(home, borrowed, ["doctor", "--vi-model", "run/model", "--chatgpt-prefix", "Flat."]);
  assert.equal(nested.status, 0, nested.stderr);
  const saved = JSON.parse(readFileSync(join(home, "forge", "config.json"), "utf8"));
  assert.deepEqual(saved.withheld, { issue: "hidden" });
  assert.deepEqual(saved.vi, { model: "run/model" }, "a nested write merged onto the run home's own store, not the borrowed one");
  assert.deepEqual(saved.chatgpt, { prefix: "Flat." });
  const held = BORROWED.map((row) => row.key).filter((key) => key.split(".")
    .reduce((at, part) => (at && typeof at === "object" ? at[part] : undefined), saved) !== undefined);
  assert.deepEqual(held, [], "the run home's config carries no borrowed key");
});

test("a borrow naming no other readable config file is refused with the path and the route out", () => {
  const home = runHome({});
  const missing = join(tempRoom("borrowed-missing-"), "config.json");
  const broken = join(tempRoom("borrowed-broken-"), "config.json");
  writeFileSync(broken, "{ not json");
  const alias = join(tempRoom("borrowed-alias-"), "config.json");
  symlinkSync(join(home, "forge", "config.json"), alias);
  const cases = [["forge/config.json", /is not an absolute path/u], [missing, /does not read as a config/u],
    [broken, /does not read as a config/u], [join(home, "forge", "config.json"), /the config this home already reads/u],
    [alias, /the config this home already reads/u]];
  for (const [path, said] of cases) {
    const run = probe(home, path, "return config.userConfig().token ?? null;");
    assert.equal(run.status, 1, `${path} resolved rather than refused: ${run.stdout}`);
    assert.match(run.stderr, said, run.stderr);
    assert.ok(run.stderr.includes(`${BORROW_VAR}=${path}`), `the refusal names the path it was given:\n${run.stderr}`);
    assert.match(run.stderr, new RegExp(`unset ${BORROW_VAR}`, "u"), "and the route out");
  }
});

test("every secret key of the machine stores table and the tracker token are borrowable as secrets", () => {
  const secrets = new Set(BORROWED.filter((row) => row.secret).map((row) => row.key));
  const owed = ["token", ...STORES.flatMap((row) => row.keys.filter((one) => one.secret).map((one) => `${row.store}.${one.key}`))];
  assert.deepEqual(owed.filter((key) => !secrets.has(key)), [],
    "a secret key the stores table declares is one a run home could only reach by a copy");
});

test("a borrowed key changed between two reads in one process is read with its new value, and the run home holds neither", () => {
  const borrowed = machineHome();
  const home = runHome();
  const run = probe(home, borrowed, `
    const first = config.userConfig().token;
    writeFileSync(${JSON.stringify(borrowed)}, JSON.stringify({ url: "http://127.0.0.1:1/mcp", token: "rotated-token-0123456789abcdef" }));
    const second = config.userConfig().token;
    return { first, second };`);
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual([run.out().first, run.out().second], [TOKEN, "rotated-token-0123456789abcdef"]);
  const kept = everything(home);
  assert.doesNotMatch(kept, new RegExp(`${TOKEN}|rotated-token`, "u"), "neither value was written under the run home");
});

test("a store key the borrowed file lacks resolves from that store's fallback file, named as the source", () => {
  const borrowed = machineHome({ codex: {} });
  const home = runHome();
  const profile = join(tempRoom("borrowed-profile-"), "claude-proxy.env");
  writeFileSync(profile, "ANTHROPIC_BASE_URL=https://gw.example\nANTHROPIC_AUTH_TOKEN=profile-gateway-key-0123456789\n");
  const run = probe(home, borrowed, `return stores.machineValue("codex", "key");`, { CLAUDE_PROXY_ENV: profile });
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(run.out(), { value: "profile-gateway-key-0123456789", from: profile });
});

test("the account's readers answer a rotated token at the next call, not the first one they read", () => {
  const borrowed = machineHome();
  const home = runHome();
  const settingsAt = new URL("../../src/resolve/settings.mjs", import.meta.url).href;
  const run = probe(home, borrowed, `
    const { accountCredentials, settings } = await import(${JSON.stringify(settingsAt)});
    const first = [accountCredentials().token.value, settings().token];
    writeFileSync(${JSON.stringify(borrowed)}, JSON.stringify({ url: "http://127.0.0.1:1/mcp", token: "rotated-token-0123456789abcdef" }));
    return { first, second: [accountCredentials().token.value, settings().token] };`);
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(run.out().first, [TOKEN, `Bearer ${TOKEN}`]);
  assert.deepEqual(run.out().second, ["rotated-token-0123456789abcdef", "Bearer rotated-token-0123456789abcdef"]);
});

test("a borrow refused inside an embedding script throws the refusal that script catches, rather than ending it", () => {
  const home = runHome({});
  const settingsAt = new URL("../../src/resolve/settings.mjs", import.meta.url).href;
  const run = probe(home, "relative/config.json", `
    const { Refusal, refusing } = await import(${JSON.stringify(settingsAt)});
    try {
      await refusing(async () => config.userConfig());
      return "resolved";
    } catch (error) {
      return error instanceof Refusal ? error.message : "another error";
    }`);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.out(), /FORGE_BORROW_FROM=relative\/config\.json is not an absolute path/u, run.out());
});
