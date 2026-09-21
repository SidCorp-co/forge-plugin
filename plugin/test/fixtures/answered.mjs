/* A gate that allowed writes nothing, and so do a child that died, a gate that threw, a gate the clock skipped and a gate the switch turned off: the four that are not an answer are told apart here and nowhere else (ISS-1909, ISS-1940).
   A case whose subject is one of them says so — `exit` for a gate that ends the process rather than deciding, `skipped` for a gate it meant the runner to catch — and every other case is refused. */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";

const SKIPPED = /^forge hooks: (\S+) (?:failed and )?was skipped:/gmu;
const DECLARED = Symbol.for("forge.test.declared");
/* The declaration is kept on the run because this reads every run twice, once where it was spawned and once where its answer is taken, and the message offers a case either place. */
const spoke = (run, said = run[DECLARED]) => {
  const { exit = 0, skipped = [] } = said ?? {};
  if (said) run[DECLARED] = said;
  assert.equal(run.status, exit,
    `the child exited ${run.signal ? `on ${run.signal}` : run.status} rather than answering: ${run.stderr}`);
  const names = [...String(run.stderr).matchAll(SKIPPED)].map((one) => one[1]);
  assert.deepEqual(names.filter((one) => !skipped.includes(one)), [],
    "a gate did not run, so this silence is not a gate allowing: say so in the case that meant it, "
    + "with { skipped: [gate] } on the call that spawned it or on answered()");
  assert.deepEqual(skipped.filter((one) => !names.includes(one)), [],
    "this case declares a gate skipped that nothing the child wrote says was skipped: name the gate "
    + "it did skip, or drop the declaration");
  return run;
};

export const answered = (run, said) => {
  spoke(run, said);
  if (!run.stdout.trim()) return null;
  const answer = JSON.parse(run.stdout);
  assert.notEqual(answer, null,
    "the child wrote `null`, which is an answer and not the silence of a gate allowing");
  return answer;
};

/* `cwd` is the project the hook stands in, a different question from the event's `cwd`: the settings resolver walks up from the process, so a case varying a project key sets this. */
export const callHook = (hook, event, env = process.env, cwd = process.cwd(), said) =>
  spoke(spawnSync(process.execPath, [hook], { input: JSON.stringify(event), encoding: "utf8", env, cwd }), said);

export const callHookAsync = (hook, event, env = process.env, cwd = process.cwd(), said) =>
  new Promise((done) => {
    const child = spawn(process.execPath, [hook], { env, cwd });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (status, signal) => done({ stdout, stderr, status, signal }));
    child.stdin.end(JSON.stringify(event));
  }).then((run) => spoke(run, said));
