/* The deadline a wait may be given, against the seconds the call carrying it may live, and what it says while it holds
   one. The default was thirty minutes and both deadlines offered double what they had just been given, so a run that did
   as it was told was killed for it and learned nothing: 31 waits of exactly ten minutes, 310 of 4,102 wall minutes over
   54 runs, and three runs that then polled 53, 49 and 21 times (ISS-1889). */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import { DEADLINE, DEFAULT_MINUTES, gatesHere, waitForSlot, waitForVerdict } from "../../../gates/verdict.mjs";
import { recordDir, recordRun } from "../../../gates/timing.mjs";
import { STEPS } from "../../../gates/steps.mjs";
import { CALL_CEILING_SECONDS } from "../../../../plugin/src/host/call-ceiling.mjs";
import { heldGate, reachedTheStep, ROOT, run, scratch, stopGate } from "../scratch.mjs";
import { BRIEFLY, heard, holding, ofOne, TICK, waited } from "./waiting.mjs";
import { patience } from "../../../../plugin/test/patience.mjs";

const OFFERED = /node tools\/gates\.mjs --wait(?: slot)?(?: (\d+(?:\.\d+)?))?/gu;

const offersIn = (text) => [...text.matchAll(OFFERED)]
  .map(([whole, minutes]) => ({ whole, seconds: (minutes === undefined ? DEFAULT_MINUTES : Number(minutes)) * 60 }));

test("every --wait command this tool prints names a deadline one call can hold", async () => {
  const clean = scratch("wait-offers-clean");
  const { at, work } = holding("wait-offers");
  const gate = heldGate(work);
  try {
    await reachedTheStep(gate, "the gate this case waits on never reached its hanging step");
    const said = heard();
    assert.equal(await waited(work, said), DEADLINE, said.lines.join("\n"));
    assert.equal(await waitForSlot(work, { minutes: BRIEFLY, tick: TICK, place: ofOne, ...said }), DEADLINE,
      said.lines.join("\n"));
    const printed = [said.lines.join("\n"),
      ...[["-h"], ["--wait", "--full"], ["--wait", "soon"], ["--wait", "25"]]
        .map((argv) => { const one = run(work, argv); return one.stdout + one.stderr; }),
      (() => { const one = run(clean.work, ["--wait"]); return one.stdout + one.stderr; })()].join("\n");
    const offers = offersIn(printed);
    assert.ok(offers.length >= 6, `the scan found ${offers.length} command(s), so it is matching nothing`);
    for (const one of offers) {
      assert.ok(one.seconds <= CALL_CEILING_SECONDS,
        `\`${one.whole}\` is ${one.seconds}s and one call may live ${CALL_CEILING_SECONDS}s`);
    }
  } finally {
    await stopGate(gate);
    for (const one of [at, clean.at]) rmSync(one, { recursive: true, force: true });
  }
});

/* The deadline a caller types, refused where it cannot be reached rather than taken and silently lost: past the
   ceiling the host ends the call first, and `forge hooks --how polling` sanctions no route here that holds one
   longer — a backgrounded loop is refused with the rest. Before the wait and not inside it, so the refusal costs
   the caller nothing while a gate of this tree is running and would otherwise have held the call. */
test("a deadline past what one call may live is refused before any waiting, and the refusal names one that fits", async () => {
  const { at, work } = holding("wait-ceiling");
  const gate = heldGate(work);
  try {
    await reachedTheStep(gate, "the gate this case refuses a wait on never reached its hanging step");
    const began = Date.now();
    const said = run(work, ["--wait", "25"]);
    assert.equal(said.status, 1, said.stdout + said.stderr);
    assert.ok(Date.now() - began < patience(5000), "it waited on the gate before refusing the deadline");
    assert.ok(said.stderr.includes(`the most a call can hold is ${DEFAULT_MINUTES * 60}s of the `
      + `${CALL_CEILING_SECONDS}s it may live`), `the refusal does not say what a call may hold:\n${said.stderr}`);
    assert.ok(said.stderr.includes(`Wait ${DEFAULT_MINUTES} minutes in a call that returns`),
      `the refusal names no deadline that fits:\n${said.stderr}`);
    assert.ok(!`${said.stdout}${said.stderr}`.includes("gate wait: watching"),
      `it began the wait it refused:\n${said.stdout}${said.stderr}`);
    /* The boundary itself, both subjects: a deadline of exactly the seconds a call may live starts after this
       process does, so the host arrives first and the caller is cut at the one value that looked safe. */
    for (const subject of [[], ["slot"]]) {
      for (const over of ["10", "9.999", String(DEFAULT_MINUTES + 0.001)]) {
        const refused = run(work, ["--wait", ...subject, over]);
        const whole = `${refused.stdout}${refused.stderr}`;
        assert.equal(refused.status, 1, `\`--wait ${subject.join(" ")} ${over}\` was not refused:\n${whole}`);
        assert.ok(!whole.includes("gate wait: watching"),
          `\`--wait ${subject.join(" ")} ${over}\` began the wait:\n${whole}`);
      }
    }
    const none = scratch("wait-ceiling-held");
    try {
      for (const subject of [[], ["slot"]]) {
        const held = run(none.work, ["--wait", ...subject, String(DEFAULT_MINUTES)]);
        assert.ok(`${held.stdout}${held.stderr}`.includes("gate wait: watching"),
          `the longest deadline a call can hold was refused:\n${held.stdout}${held.stderr}`);
      }
    } finally {
      rmSync(none.at, { recursive: true, force: true });
    }
  } finally {
    await stopGate(gate);
    rmSync(at, { recursive: true, force: true });
  }
});

/* What a caller holds when the call is ended before the wait answers. The ending is not observable from in here —
   a host that took the call and a failure after this line look alike — so the line says only that an answer is one
   more line, which makes a result carrying this one alone readable as a call that reached none (ISS-1889). */
test("a wait says what it is watching before its first round, and a reached deadline adds a line that opening one does not", async () => {
  const { at, work } = holding("wait-watching");
  const gate = heldGate(work);
  try {
    await reachedTheStep(gate, "the gate this case waits on never reached its hanging step");
    const said = heard();
    let atFirstRound = null;
    const gates = (root, ours) => {
      atFirstRound ??= said.lines.length;
      return gatesHere(root, ours);
    };
    assert.equal(await waitForVerdict(work, { minutes: BRIEFLY, tick: TICK, gates, ...said }), DEADLINE,
      said.lines.join("\n"));
    assert.equal(atFirstRound, 1, "the wait had said nothing, or more than the one line, by its first round");
    assert.ok(said.lines[0].startsWith(`gate wait: watching — the verdict of ${work},`), said.lines[0]);
    assert.ok(said.lines[0].includes(`for up to ${BRIEFLY} minute(s)`), said.lines[0]);
    assert.match(said.lines[0], /an answer is one more line of its own/iu, said.lines[0]);
    assert.ok(said.lines.length > 1, "a reached deadline said no more than the line it opened with");
    assert.match(said.lines.at(-1), /^gate wait: deadline/u, said.lines.at(-1));
  } finally {
    await stopGate(gate);
    rmSync(at, { recursive: true, force: true });
  }
});

/* A deadline saying only that the gate is still running is one a run stops believing and starts polling around.
   What it needs instead is the figure: how far this gate has got against what the newest whole ones took. */
test("the deadline names what the newest whole gates recorded under this checkout took, and whose record that is", async () => {
  const { at, work } = holding("wait-recorded");
  const gate = heldGate(work);
  try {
    await reachedTheStep(gate, "the gate this case waits on never reached its hanging step");
    for (const seconds of [100, 300, 500]) {
      recordRun(recordDir(work), { seconds, ran: STEPS.length, total: STEPS.length });
    }
    const said = heard();
    assert.equal(await waited(work, said), DEADLINE, said.lines.join("\n"));
    const whole = said.lines.join("\n");
    assert.ok(whole.includes(`The newest 3 whole gate(s) of ${STEPS.length} step(s) recorded under this `
      + "checkout took 300s median"), `the recorded figure is not in the deadline:\n${whole}`);
    assert.match(whole, /every worktree sharing that record appends to it/u,
      `the deadline attributes the figure to this tree alone:\n${whole}`);
  } finally {
    await stopGate(gate);
    rmSync(at, { recursive: true, force: true });
  }
});

/* One value and not a fifth spelling of it: the number was in the source once, as the chatgpt detach's own, and three
   more times as the prose "ten-minute cap" — and the gate wait, whose deadline was three times it, read none of them. */
test("the seconds one call may live are one exported value, and the gate wait and the chatgpt detach both read it", () => {
  const { at, work } = scratch("wait-one-ceiling");
  try {
    const help = run(work, ["-h"]);
    assert.ok(help.stdout.includes(`one may live ${CALL_CEILING_SECONDS}s`),
      `the help does not state the ceiling from the one value:\n${help.stdout}`);
    assert.ok(DEFAULT_MINUTES * 60 < CALL_CEILING_SECONDS,
      `the default is ${DEFAULT_MINUTES * 60}s against a ceiling of ${CALL_CEILING_SECONDS}s`);
    const chatgpt = readFileSync(join(ROOT, "plugin", "src", "tools", "services", "chatgpt.mjs"), "utf8");
    assert.match(chatgpt, /import \{ CALL_CEILING_SECONDS, pastCeiling \} from "\.\.\/\.\.\/host\/call-ceiling\.mjs";/u,
      "the chatgpt service does not read the one value");
    assert.match(chatgpt, /if \(pastCeiling\(deadline\.value\)\) return detaching\(/u,
      "the chatgpt detach does not decide by the one value");
    assert.ok(!/DETACH_ABOVE_SECONDS/u.test(chatgpt), "the chatgpt service still holds a ceiling of its own");
  } finally {
    rmSync(at, { recursive: true, force: true });
  }
});
