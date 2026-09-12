/* The clock one outbound attempt runs under, which both transports now share: every tracker call and every ChatGPT turn is bounded by these five functions, and until this file they were exercised only sideways, through whichever caller happened to be under test (ISS-1047). */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { apiBaseOf, deadlineOf, deadlineSeconds, MAX_WAIT_SECONDS, parsedOr, ranOut, secondsGiven, waitSeconds } from "../../src/wire/request.mjs";
import { ranAsync, tempHome } from "../fixtures.mjs";

const SAYS_ITS_DEADLINE = 'import("./src/wire/request.mjs")'
  + ".then(({ deadlineOf }) => { const d = deadlineOf(null); console.log(`${d.value} ${d.from}`); })";

/* How long one attempt may take, and the reading of what config.json may put in it, where the ladder of attempts above it says how many there are (ISS-828). */
test("the deadline one attempt gets is 60s unless config.json names a non-negative number of seconds", () => {
  assert.equal(waitSeconds({}), 60, "the default is the constant's");
  assert.equal(waitSeconds({ waitSeconds: 0 }), 0, "zero is a deadline that runs out at once, not the absence of one");
  assert.equal(waitSeconds({ waitSeconds: 0.5 }), 0.5);
  for (const bad of ["1", null, -1, Number.NaN, Number.POSITIVE_INFINITY, true, undefined]) {
    assert.equal(waitSeconds({ waitSeconds: bad }), 60, `${String(bad)} read as a deadline`);
  }
  /* The timer's own two limits, spent by the deadline rather than thrown where a request should go: whole milliseconds, and no more than a signed 32-bit count of them, past which the timer warns and fires at 1ms (consults 6b1ac4 F1, 8b2c3d F1). */
  assert.equal(waitSeconds({ waitSeconds: 1.001 }), 1.001, "what a project may write is read as written");
  assert.equal(deadlineSeconds({ waitSeconds: 1.001 }), 1.001, "and a whole millisecond of it is what it gets");
  assert.equal(deadlineSeconds({ waitSeconds: 0.0004 }), 0, "less than a millisecond gets none, which fires at once");
  assert.equal(deadlineSeconds({ waitSeconds: 1e9 }), 2147483.647,
    "and a value past the timer's range gets the deadline it buys rather than one that fires at 1ms");
  assert.equal(deadlineSeconds({}), 60, "the default goes through the same reading");
});

/* The value a caller hands in outranks the file, and which of the two answered is part of the answer because it is what the refusal a deadline produces has to name. */
test("a deadline names where it came from, the caller's own outranking the file's", () => {
  assert.equal(secondsGiven(2), 2);
  assert.equal(secondsGiven(0), 0, "zero is a deadline, not the absence of one");
  for (const bad of ["2", null, -1, Number.NaN, Number.POSITIVE_INFINITY, undefined]) {
    assert.equal(secondsGiven(bad), null, `${String(bad)} read as a number of seconds`);
  }
  const own = deadlineOf(3);
  assert.deepEqual({ ...own }, { millis: 3000, value: 3, from: "the caller's own deadline" });
  const fallen = deadlineOf(null);
  assert.equal(fallen.from, "waitSeconds in config.json", "and no caller's value sends the reader to the file");
  assert.equal(fallen.millis, deadlineSeconds() * 1000);
});

/* A caller's own deadline is the ChatGPT verb's to bound, and this module is what a tracker request
   runs under too: a ceiling put here rather than at that verb's flag would move both (ISS-1270). */
test("the deadline a config asks for is handed over unclamped, whatever a caller's own flag is bounded by", async () => {
  assert.equal(waitSeconds({ waitSeconds: 900 }), 900, "a configured wait is not cut to any verb's idea of long");
  assert.equal(deadlineSeconds({ waitSeconds: 900 }), 900);
  assert.equal(MAX_WAIT_SECONDS, 2147483.647, "the one bound here is the timer's own reach");
  const home = tempHome("request-wait");
  try {
    mkdirSync(join(home.path, "forge"), { recursive: true });
    writeFileSync(join(home.path, "forge", "config.json"), JSON.stringify({ waitSeconds: 900 }));
    /* Read in a process of its own: `userConfig` reads the file once and remembers, so a config
       swapped inside this one would be read by nothing. */
    const run = await ranAsync(process.execPath, ["-e", SAYS_ITS_DEADLINE],
      { ...process.env, XDG_CONFIG_HOME: home.path }, new URL("../..", import.meta.url).pathname, null);
    assert.equal(run.status, 0, run.stderr);
    assert.equal(run.stdout.trim(), "900 waitSeconds in config.json");
  } finally {
    home.remove();
  }
});

/* The name and nothing else: a runtime that reworded the message would leave a deadline reporting somebody's socket error as a timeout, or a timeout as whatever the runtime called it. */
test("a request that ran out says so with the seconds and the source, and any other failure says its own message", () => {
  const deadline = deadlineOf(5);
  const timedOut = new Error("The operation was aborted due to timeout");
  timedOut.name = "TimeoutError";
  assert.equal(ranOut(timedOut, deadline), "ran out after 5s (the caller's own deadline)");
  const dropped = new Error("other side closed");
  dropped.name = "SocketError";
  assert.equal(ranOut(dropped, deadline), "other side closed", "a failure that is not the clock's is not the clock's to word");
});

/* Off the URL it is handed rather than off one it reads: two endpoints are configured now, and a function reading its own would derive one caller's origin from the other's host (ISS-791). */
test("the REST origin beside an MCP endpoint is read off that endpoint, and a URL that is not one is refused by name", () => {
  assert.deepEqual(apiBaseOf("https://host.example/mcp"), { base: "https://host.example/api" });
  assert.deepEqual(apiBaseOf("https://host.example/under/mcp/"), { base: "https://host.example/under/api" },
    "a trailing slash is part of the tail, not part of the origin");
  for (const bad of ["https://host.example/api", "https://host.example", "", null, undefined, 7]) {
    const { base, problem } = apiBaseOf(bad);
    assert.equal(base, undefined, `${String(bad)} answered an origin`);
    assert.match(problem, /no \/mcp at the end of /u, `${String(bad)} was refused without being named`);
  }
});

/* One answer for a body that will not parse, spent by all three transports: two of them answered differently, so a caller moving between them got a different falsy value for the same failure. */
test("a body that will not parse is null, and one that will is itself", () => {
  assert.deepEqual(parsedOr('{"a":1}'), { a: 1 });
  assert.equal(parsedOr("<html>a gateway wrote this</html>"), null);
  assert.equal(parsedOr(""), null);
  assert.equal(parsedOr("null"), null, "a document that says null is not told apart from one that will not parse, and no caller here asks it to be");
});

/* One path to the clock, which means the module it moved out of does not still offer it: two import paths for one pair is a reader of the second finding the deadline in the tracker's REST module and following a hop that no longer says anything (ISS-1047). */
test("the tracker's REST module hands out neither of the clock's two names", async () => {
  const rest = await import("../../src/tracker/rest.mjs");
  assert.equal(rest.deadlineSeconds, undefined);
  assert.equal(rest.waitSeconds, undefined);
  assert.equal(typeof rest.retrySeconds, "function", "the ladder above one attempt is still this module's");
  assert.equal(typeof rest.backoff, "function");
});
