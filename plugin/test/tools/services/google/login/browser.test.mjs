/* The consent address opened in the browser beside being printed. Openers here are shell scripts on a
   PATH this file makes, each writing the address it was handed to a file of its own name, so a case
   reads which command ran and with what. A login on a terminal is driven under `script`, which gives
   the verb a terminal for stdout while its stderr comes back on a pipe of its own; that needs
   util-linux, so those cases run on Linux alone and say so. Nothing reaches Google. */
import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { delimiter, join } from "node:path";

import { tempRoom } from "../../../../fixtures.mjs";
import { openAddress, openerFor } from "../../../../../src/tools/services/google/auth/browser.mjs";
import { FORGE_BIN, clientFile, googleEnv, googleHome, startFake } from "../fake.mjs";

const ADDRESS = "https://accounts.example.com/o/oauth2/auth?client_id=c&scope=a%20b&state=s";

let fake = null;
let room = null;

before(async () => {
  fake = await startFake();
  room = tempRoom("google-browser-");
});

after(() => fake?.close());

let binCount = 0;

/* A PATH directory holding each named opener; `failing` ones exit 1 without writing. */
const openers = (names, { failing = [] } = {}) => {
  binCount += 1;
  const bin = join(room, `bin-${binCount}`);
  mkdirSync(bin);
  for (const name of [...names, ...failing]) {
    const body = failing.includes(name) ? "exit 1" : `printf '%s\\n' "$1" >> '${join(bin, `${name}.opened`)}'`;
    writeFileSync(join(bin, name), `#!/bin/sh\n${body}\n`);
    chmodSync(join(bin, name), 0o755);
  }
  const opened = (name) => (existsSync(join(bin, `${name}.opened`)) ? readFileSync(join(bin, `${name}.opened`), "utf8").trim() : null);
  return { bin, opened };
};

/* The opener is detached and forgotten, so a case waits on the file it writes rather than on the child. */
const openedBy = async (opened, name) => {
  for (let tries = 0; tries < 100 && opened(name) === null; tries += 1) await new Promise((done) => setTimeout(done, 20));
  return opened(name);
};

test("each platform's own opener is the one chosen: open on macOS, start through the command shell on Windows, xdg-open elsewhere", () => {
  assert.deepEqual(openerFor(ADDRESS, "darwin"), { command: "open", args: [ADDRESS], verbatim: false });
  assert.deepEqual(openerFor(ADDRESS, "linux"), { command: "xdg-open", args: [ADDRESS], verbatim: false });
  assert.deepEqual(openerFor(ADDRESS, "freebsd"), { command: "xdg-open", args: [ADDRESS], verbatim: false });
  assert.deepEqual(openerFor(ADDRESS, "win32"), { command: "cmd.exe", args: ["/d", "/s", "/c", `start "" "${ADDRESS}"`], verbatim: true });
});

test("on a terminal the platform's opener is started with the address, and no competing command is", async () => {
  const { bin, opened } = openers(["open", "xdg-open"]);
  assert.equal(await openAddress(ADDRESS, { terminal: true, platform: "linux", env: { PATH: bin } }), "xdg-open");
  assert.equal(await openedBy(opened, "xdg-open"), ADDRESS);
  assert.equal(opened("open"), null);
});

test("--no-browser, output that is not a terminal and an opener that cannot start each start nothing", async () => {
  const { bin, opened } = openers(["xdg-open"]);
  assert.equal(await openAddress(ADDRESS, { terminal: true, wanted: false, platform: "linux", env: { PATH: bin } }), null);
  assert.equal(await openAddress(ADDRESS, { terminal: false, platform: "linux", env: { PATH: bin } }), null);
  assert.equal(await openAddress(ADDRESS, { terminal: true, platform: "linux", env: { PATH: openers([]).bin } }), null);
  assert.equal(opened("xdg-open"), null);
});

const hasScript = process.platform === "linux" && spawnSync("script", ["--version"]).status === 0;
const ON_LINUX = hasScript ? {} : { skip: "a terminal for stdout is made with util-linux script, which this box lacks" };

const shellQuoted = (word) => `'${word.replace(/'/gu, "'\\''")}'`;

/* A login that plays the browser off its stderr. On a terminal its stdout is script's pty and its
   stderr fd 3 of this process; otherwise both are plain pipes. */
const loggedIn = (home, bin, argv, { terminal }) => new Promise((done) => {
  const words = [FORGE_BIN, "google", "auth", "login", ...argv];
  const env = googleEnv(home, { PATH: `${bin}${delimiter}${process.env.PATH}` });
  const child = terminal
    ? spawn("script", ["-qfec", `${words.map(shellQuoted).join(" ")} 2>&3`, "/dev/null"], { env, cwd: room, stdio: ["pipe", "pipe", "pipe", "pipe"] })
    : spawn(words[0], words.slice(1), { env, cwd: room });
  let stderr = "";
  let followed = false;
  (terminal ? child.stdio[3] : child.stderr).on("data", async (chunk) => {
    stderr += chunk;
    const found = stderr.match(/^ {2}(http:\/\/127\.0\.0\.1:\d+\/auth\?\S+)$/mu);
    if (!found || followed) return;
    followed = true;
    const asked = new URL(found[1]);
    fake.challenge = asked.searchParams.get("code_challenge");
    const back = new URL(asked.searchParams.get("redirect_uri"));
    back.searchParams.set("code", "fake-code");
    back.searchParams.set("state", asked.searchParams.get("state"));
    await fetch(back);
  });
  child.stdout.resume();
  child.on("close", (status) => done({ status, stderr, home }));
});

const signedIn = (argv, bin, { terminal = true } = {}) => {
  const home = googleHome(fake);
  const client = clientFile(fake, room, { name: `client-${binCount}.json` });
  return loggedIn(home, bin, ["--client-secret", client, "--wait", "30", ...argv], { terminal });
};

const CONSENT = /^ {2}(http:\/\/127\.0\.0\.1:\d+\/auth\?\S+)$/mu;

const savedLogin = (home) => JSON.parse(readFileSync(join(home, "forge", "config.json"), "utf8")).google.accounts.owner;

test("a login on a terminal opens the consent address with the platform's opener and prints it on stderr", ON_LINUX, async () => {
  const { bin, opened } = openers(["xdg-open"]);
  const answer = await signedIn([], bin);
  assert.equal(answer.status, 0, answer.stderr);
  assert.equal(await openedBy(opened, "xdg-open"), answer.stderr.match(CONSENT)[1]);
  assert.match(answer.stderr, /Opened it with xdg-open; if no page appeared, open the address above by hand\./u);
});

test("a login on a terminal given --no-browser starts no opener and prints the address on stderr", ON_LINUX, async () => {
  const { bin, opened } = openers(["xdg-open"]);
  const answer = await signedIn(["--no-browser"], bin);
  assert.equal(answer.status, 0, answer.stderr);
  assert.match(answer.stderr, CONSENT);
  assert.equal(opened("xdg-open"), null);
  assert.doesNotMatch(answer.stderr, /Opened it with/u);
});

test("a login whose stdout is not a terminal starts no opener and prints the address on stderr", async () => {
  const { bin, opened } = openers(["xdg-open"]);
  const answer = await signedIn([], bin, { terminal: false });
  assert.equal(answer.status, 0, answer.stderr);
  assert.match(answer.stderr, CONSENT);
  assert.equal(opened("xdg-open"), null);
});

test("an opener that exits 1 leaves the login waiting for the redirect, which completes it", ON_LINUX, async () => {
  const { bin } = openers([], { failing: ["xdg-open"] });
  const answer = await signedIn([], bin);
  assert.equal(answer.status, 0, answer.stderr);
  assert.match(answer.stderr, /Opened it with xdg-open/u);
  assert.equal(savedLogin(answer.home).address, "owner@example.com");
});
