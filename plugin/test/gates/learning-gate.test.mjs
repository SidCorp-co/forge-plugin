/* The gate is a decision, so it is exercised the way Claude Code calls it: the event on stdin and
   the permission decision on stdout. The Bash fixtures are shapes observed slipping through. */
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import test from "node:test";

import { callHook, homeEnv, tempRoom } from "../fixtures.mjs";

const HOOK = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "hooks", "entries", "learning-gate.mjs");
/* A refusal writes to the config dir now, so a suite that skips this one logs onto the developer. */
const HOME = homeEnv("learning-gate");
/* A fixture path, not this machine's: the Bash cases need only a string holding /memory/, and
   the ones that judge content build a real directory below. */
const MEMORY = "/home/dev/.claude/projects/-home-dev-app/memory";
const SKILL = "plugin/skills/issue-flow/SKILL.md";
const SKILL_DIR = "/home/dev/app/plugin/skills/issue-flow";

/* The gate stamps /tmp once per session per file, so a fixture reusing a session id passes on a
   re-run for the wrong reason. Every call gets its own session. */
const ask = (event) =>
  callHook(HOOK, { session_id: randomUUID(), ...event }, HOME);

const answered = (run) => {
  assert.equal(run.status, 0, run.stderr);
  if (!run.stdout.trim()) return { allowed: true };
  const answer = JSON.parse(run.stdout).hookSpecificOutput;
  return { allowed: answer.permissionDecision !== "deny", reason: answer.permissionDecisionReason };
};

const decide = (command) => answered(ask({ tool_name: "Bash", tool_input: { command } }));

/* A value naming another was dropped whole rather than carried, so this exact write — found by firing
   the live gate — landed a memory file with nothing asked. The `/memory/` it spells out is enough. */
test("a guarded path held by a variable of a variable is refused", () => {
  assert.equal(decide(`M="$HOME/p/memory"\nprintf x > "$M/trap.md"`).allowed, false);
  assert.equal(decide(`printf x > "$HOME/p/memory/trap.md"`).allowed, false);
  assert.equal(decide(`M=$(mktemp -d)\nprintf x > $M/trap.md`).allowed, true, "a value only the run knows");
});

/* Measured escaping after that fix: a value naming a second value, a use before the name is
   reassigned, a brace modifier, and an assignment a prefix or a subshell hid. A use resolves
   against the assignment before it, so the last one in the file no longer answers for all of them. */
test("a path resolves through a second name, a reassignment, a modifier and a prefix", () => {
  assert.equal(decide(`A=${MEMORY}\nB=$A\nprintf x > $B/trap.md`).allowed, false, "one name holding another");
  assert.equal(decide(`M=${MEMORY}\ncp a "$M/trap.md"\nM=/tmp`).allowed, false, "the assignment before the use");
  assert.equal(decide(`M=${MEMORY}\ncp a \${M:-/tmp}/trap.md`).allowed, false, "a brace modifier");
  assert.equal(decide(`( M=${MEMORY} ; cp a $M/trap.md )`).allowed, false, "inside a subshell");
  /* Measured: `$M` expands before `env` sets it, so this lands in `/trap.md` and is nothing to refuse. */
  assert.equal(decide(`env M=${MEMORY} cp a $M/trap.md`).allowed, true, "a prefix is unset on its own line");
  assert.equal(decide(`env M=${MEMORY} sh -c 'cp a $M/trap.md'`).allowed, false, "the shell it starts reads it");
});

/* An assignment is what a shell would set — a line, a separator, a command that takes one — because
   a phantom out of quoted data answers for a name the shell leaves unset. */
test("text that looks like an assignment but sets nothing resolves nothing", () => {
  assert.equal(decide(`echo DEST=${MEMORY} ; printf y > "$DEST/trap.md"`).allowed, true);
  assert.equal(decide(`node -e "const s = 'M=${MEMORY}'" ; printf y > $M/trap.md`).allowed, true);
});

test("an assignment reaches the shell a wrapper starts, and no interpreter beyond it", () => {
  assert.equal(decide(`env A=1 M=${MEMORY} sh -c 'cp a $M/trap.md'`).allowed, false, "beside another assignment");
  const inner = 'writeFileSync("$M/trap.md", "x")';
  assert.equal(decide(`env M=${MEMORY} node -e '${inner}'`).allowed, true, "a literal `$M` is no directory");
});

/* What a substitution returns is unknowable; a directory its text names is one the write reaches. */
test("a directory a command substitution spells out is still refused", () => {
  assert.equal(decide(`M=$(dirname ${MEMORY}/a.md)\nprintf x > $M/trap.md`).allowed, false);
  assert.equal(decide(`M=$(mktemp -d)\nprintf x > $M/trap.md`).allowed, true, "a value only the run knows");
});

/* A verb answers for its own command, not for the line: any of them made every `.md` token a target. */
test("a write in one command does not answer for a path named in another", () => {
  assert.equal(decide(`cat ${MEMORY}/a.md | grep -c x && touch /tmp/done.md`).allowed, true);
  assert.equal(decide(`sed -n 1,5p ${MEMORY}/a.md && cp notes.md /tmp/`).allowed, true);
  assert.equal(decide(`wc -l ${MEMORY}/a.md ; truncate -s 0 /tmp/log.md`).allowed, true);
  assert.equal(decide(`cp notes.md ${MEMORY}/trap.md && echo done`).allowed, false, "its own target still counts");
  assert.equal(decide(`echo start ; touch ${MEMORY}/trap.md`).allowed, false, "in whichever command it is");
});

/* Read as a quote, an escaped one split the verb from its target and the write was lost. */
test("a quote the shell escapes does not end a command", () => {
  assert.equal(decide(`cp "a\\";b" ${MEMORY}/trap.md`).allowed, false);
});

/* Two ways a target reaches a verb in another command, both of which a plain split would let through. */
test("a command that hands the next one its target is one command", () => {
  assert.equal(decide(`printf '%s' ${MEMORY}/trap.md | xargs touch`).allowed, false, "a pipe is not a boundary");
  assert.equal(decide(`python3 -c 'p="${MEMORY}/trap.md"; open(p, "w")'`).allowed, false, "nor a program's own `;`");
  assert.equal(decide(`printf '%s' ${MEMORY}/trap.md |& xargs touch`).allowed, false, "nor the `&` in `|&`");
});

test("a `-c` body inside a `-c` body is unwrapped too", () => {
  assert.equal(decide(`sh -c 'sh -c "cp a ${MEMORY}/trap.md"'`).allowed, false);
});

/* A verb belongs here only with a target the command spells out: `tar -x` is the backstop's business. */
test("the write verbs an agent reaches for are writes", () => {
  for (const command of [
    `touch ${MEMORY}/trap.md`,
    `install -m 644 a.md ${MEMORY}/trap.md`,
    `rsync a.md ${MEMORY}/trap.md`,
    `dd if=a.md of=${MEMORY}/trap.md`,
    `curl -sS https://x/a.md -o ${MEMORY}/trap.md`,
    `wget -O ${MEMORY}/trap.md https://x/a.md`,
  ]) {
    assert.equal(decide(command).allowed, false, command);
  }
});

/* `open(…, "w")` was read and `"a"` was not: the shape that keeps the file was the one that passed. */
test("a call that appends or copies is a write, in whichever language reached for it", () => {
  for (const program of [
    `open("${MEMORY}/trap.md", "a").write("x")`,
    `appendFileSync("${MEMORY}/trap.md", "x")`,
    `await writeFile("${MEMORY}/trap.md", "x")`,
    `Deno.writeTextFile("${MEMORY}/trap.md", "x")`,
    `Bun.write("${MEMORY}/trap.md", "x")`,
    `shutil.copyfile("a.md", "${MEMORY}/trap.md")`,
  ]) {
    assert.equal(decide(`python3 -c '${program}'`).allowed, false, program);
  }
});

/* Read as a quoted argument, a `-c` body let every verb through: `sh -c 'cp …'` was not a write. */
test("a verb inside a `-c` body is where the shell puts it", () => {
  assert.equal(decide(`sh -c 'cp a ${MEMORY}/trap.md'`).allowed, false);
  assert.equal(decide(`bash -lc "tee ${MEMORY}/trap.md < a"`).allowed, false);
  assert.equal(decide(`ls | xargs -I{} sh -c 'cp {} ${MEMORY}/trap.md'`).allowed, false);
  assert.equal(decide(`sh -c 'grep -c x ${MEMORY}/a.md'`).allowed, true, "reading is still free");
});

/* The tracker holds project memory too, and the MCP tool was guarded while the CLI that reaches the
   same endpoint was not. One decision, both routes. */
test("the tracker's own memory write is the same decision through the shell", () => {
  const { allowed, reason } = decide(`forge call forge_memory_write '{"source":"note","text":"x"}'`);
  assert.equal(allowed, false);
  assert.match(reason, /Record only what cost a cycle/u);
  assert.match(reason, /code cannot hold/u, "the hold sends a fixable fact to the code first");
  assert.match(reason, /which of the five conditions/u, "the tracker route counts them as the brief does");
  assert.match(reason, /metadata\.checked/u);
  assert.equal(decide(`forge call forge_memory_search '{"q":"x"}'`).allowed, true, "recall is free");
});

/* Naming a thing is not calling it: a grep for the endpoint was refused as a write to it. */
test("a command that only names the tracker's endpoint is not writing to it", () => {
  const named = `forge${"_"}memory${"_"}write`;
  assert.equal(decide(`grep -rn ${named} plugin/hooks`).allowed, true);
  assert.equal(decide(`forge call ${named} '{"source":"note"}'`).allowed, false, "the call is");
});

/* One endpoint, two routes, two rules: the payload was searched for the word rather than read, so a
   field set to false cleared it, and a source the tracker authors was refused here and not there. */
test("the payload is read, not searched, and the tracker's own sources pass either way", () => {
  const named = `forge${"_"}memory${"_"}write`;
  const call = (payload) => decide(`forge call ${named} '${JSON.stringify(payload)}'`);
  assert.equal(call({ source: "note", metadata: { checked: false } }).allowed, false, "false is not checked");
  assert.equal(call({ source: "note", metadata: { checked: "trap" } }).allowed, true, "a category clears it");
  assert.equal(call({ source: "issue", text: "x" }).allowed, true, "the tracker authors this one");
  assert.equal(decide(`forge call ${named} @body.json`).allowed, false, "a payload it cannot read");
});

/* A wrapper's own flags let `sudo -u touch <path>` inside an echo read as a write; only `xargs` needs them. */
test("a wrapper's flags are not a licence for every quoted mention", () => {
  assert.equal(decide(`echo "sudo -u me touch ${SKILL}"`).allowed, true);
  assert.equal(decide(`sudo touch ${MEMORY}/trap.md`).allowed, false, "the wrapper itself still counts");
});

/* A wrapper counts where a verb counts: promoting a `-c` body promoted one quoted in a message too. */
test("a `-c` body quoted inside an argument is not the shell running one", () => {
  assert.equal(decide(`git commit -m "ran sh -c 'cp a b'" -- ${MEMORY}/a.md`).allowed, true);
  assert.equal(decide(`sh -c 'cp a ${MEMORY}/trap.md'`).allowed, false, "at the start it is");
  assert.equal(decide(`ls | xargs -I{} sh -c 'cp {} ${MEMORY}/trap.md'`).allowed, false, "after a wrapper too");
});

test("a heredoc through a variable-held memory path is refused", () => {
  const { allowed, reason } = decide(
    `M=${MEMORY}\ncat > $M/coolify-deploy-log-location.md <<'EOF'\nbody\nEOF`,
  );
  assert.equal(allowed, false);
  assert.match(reason, /coolify-deploy-log-location\.md/);
  assert.match(reason, /Record only what cost a cycle/, "the rule, not only the tool");
  assert.match(reason, /Do this: if all five hold, write it with Write/);
});

test("the braced form resolves too", () => {
  assert.equal(decide(`M=${MEMORY}\ncat > \${M}/trap.md <<'EOF'\nx\nEOF`).allowed, false);
});

test("a relative write after cd into the guarded directory is refused", () => {
  assert.equal(decide(`cd ${MEMORY} && cat > trap.md <<'EOF'\nx\nEOF`).allowed, false);
});

/* Three gates ask which directory a command runs in and this one kept its own answer: the last `cd`
   in the text won, whatever preceded it, and the shell's own cwd was no tree at all (ISS-260). */
test("a relative write is placed against every tree the shell could be standing in", () => {
  assert.equal(
    decide(`cd ${dirname(MEMORY)} && cd memory && cat > trap.md <<'EOF'\nx\nEOF`).allowed,
    false,
    "two relative moves compose, where the last of them alone names nothing guarded",
  );
  const doubted = decide(`cd ${MEMORY} || cd /tmp/a && echo x > trap.md`);
  assert.equal(doubted.allowed, false, "a cd in front of a || may have run, so its tree is still live");
  assert.match(doubted.reason, /could run in more than one tree/u, "and the refusal names the doubt");
  assert.match(doubted.reason, /Join them with .&&./u, "with the one action that settles it");
  assert.equal(decide(`(cd ${MEMORY}; echo hi); echo x > trap.md`).allowed, true, "a subshell's move died with it");
  assert.equal(decide(`pushd ${MEMORY} && echo x > trap.md`).allowed, false, "a pushd moves this shell too");
  assert.equal(
    decide(`pushd ${MEMORY} && popd && echo x > trap.md`).allowed,
    true,
    "and the stack it returns to is what the reading declines to model, so that tree is named nowhere",
  );
});

/* Refusing on this doubt would refuse every relative `.md` write behind a `cd -`, and a gate refusing too much is one somebody switches off. */
test("a tree the command does not name leaves the token to decide alone", () => {
  assert.equal(decide(`cd - && echo x > notes.md`).allowed, true);
  assert.equal(decide(`cd - && echo x > ${MEMORY}/trap.md`).allowed, false, "while the token still counts");
  assert.equal(decide(`cd /tmp/a || cd /tmp/b && echo x > notes.md`).allowed, true, "and doubt alone refuses nothing");
});

/* The shell stands somewhere before any `cd`, and that tree was read as no tree: a relative write
   from a session already inside the directory it guards was the write nobody was asked about. */
test("the call's own cwd is a tree the write resolves against", () => {
  const at = (cwd, command) => answered(ask({ tool_name: "Bash", tool_input: { command }, cwd }));
  assert.equal(at(MEMORY, `echo x > trap.md`).allowed, false);
  assert.equal(at(`${SKILL_DIR}`, `sed -i s/a/b/ references/plan.md`).allowed, false, "a skill's own text too");
  assert.equal(at(MEMORY, `echo x >> MEMORY.md`).allowed, true, "the index is still not a memory");
  assert.equal(at("/tmp/notes", `echo x > trap.md`).allowed, true, "and a tree guarding nothing refuses nothing");
});

test("a literal path is still refused", () => {
  assert.equal(decide(`sed -i s/a/b/ ${MEMORY}/trap.md`).allowed, false);
});

test("a skill file through a variable is refused", () => {
  assert.equal(decide("S=plugin/skills/issue-flow\ncat > $S/SKILL.md <<'EOF'\nx\nEOF").allowed, false);
});

test("MEMORY.md is the index, not a memory", () => {
  assert.equal(decide(`M=${MEMORY}\ncat > $M/MEMORY.md <<'EOF'\n- a line\nEOF`).allowed, true);
});

test("reading a memory is free", () => {
  assert.equal(decide(`M=${MEMORY}\ncat $M/trap.md | head -5`).allowed, true);
});

test("an unrelated variable-held markdown write is free", () => {
  assert.equal(decide("D=/tmp/docs\ncat > $D/notes.md <<'EOF'\nx\nEOF").allowed, true);
});

test("an unresolvable variable does not deny by accident", () => {
  assert.equal(decide("cat > $UNSET/notes.md <<'EOF'\nx\nEOF").allowed, true);
});

test("a `-i` inside the filename is not an in-place edit", () => {
  assert.equal(decide(`sed -n 1,7p ${MEMORY}/erp-issue-workflow.md`).allowed, true);
});

test("a real in-place edit of the same file is still refused", () => {
  assert.equal(decide(`sed -i s/a/b/ ${MEMORY}/erp-issue-workflow.md`).allowed, false);
  assert.equal(decide(`sed --in-place s/a/b/ ${MEMORY}/erp-issue-workflow.md`).allowed, false);
  assert.equal(decide(`sed -i.bak s/a/b/ ${MEMORY}/erp-issue-workflow.md`).allowed, false);
});

test("a commit trailer's `>` is not a redirect", () => {
  const body = "msg\n\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>";
  const { allowed, reason } = decide(
    `git add plugin/skills/issue-flow/SKILL.md && git commit -F - <<'EOF'\n${body}\nEOF`,
  );
  assert.equal(allowed, true, reason);
});

test("an arrow in a commit message is not a redirect", () => {
  assert.equal(decide('git add plugin/skills/forge/SKILL.md && git commit -m "list -> table"').allowed, true);
});

test("a quoted write target is still found", () => {
  assert.equal(decide(`M=${MEMORY}\ncat > "$M/trap.md" <<EOF\nx\nEOF`).allowed, false);
});

test("a python write through the shell is still found", () => {
  assert.equal(decide(`python3 -c "open('${MEMORY}/trap.md','w').write('x')"`).allowed, false);
});

/* A heredoc body is data — but `python3 - <<PY` executes it, and stripping it as data let a memory
   file be rewritten with no question asked. Found by doing it. */
test("a body an interpreter executes is command, not data", () => {
  const write = `import pathlib\npathlib.Path("${MEMORY}/trap.md").write_text("x")`;
  assert.equal(decide(`python3 - <<'PY'\n${write}\nPY`).allowed, false);
  assert.equal(decide(`node - <<'JS'\nwriteFileSync("${MEMORY}/trap.md", "x")\nJS`).allowed, false);
});

/* The prose case below reads the same dropped or kept; a body holding a write shape is what asks. */
test("a write shape inside a data body is text, not a write", () => {
  assert.equal(decide(`cat > /tmp/note.md <<'MD'\ncp a ${MEMORY}/x.md\nMD`).allowed, true);
});

test("the same shape aimed anywhere else stays free", () => {
  assert.equal(decide(`python3 - <<'PY'\nimport pathlib\npathlib.Path("docs/HOOKS.md").write_text("x")\nPY`).allowed, true);
  /* `cat` executes nothing, so its body is data again and only the operator line is read. */
  assert.equal(decide(`cat > docs/X.md <<'MD'\nsee ${MEMORY}/a.md for the fact\nMD`).allowed, true);
});

/* Twelve refusals in three days: a python body editing one file, its replacement string a sentence. */
test("a sentence inside a string is prose, and the line that writes the file is a write", () => {
  const prose = `s = s.replace('''the route is write_text; see ${SKILL} for the rule''', "x")`;
  assert.equal(decide(`python3 - <<'PY'\nfrom pathlib import Path\np = Path("plugin/src/tools/vi.mjs")\ns = p.read_text()\n${prose}\np.write_text(s)\nPY`).allowed, true);
  assert.equal(decide(`python3 - <<'PY'\nfrom pathlib import Path\nPath("${SKILL}").write_text("x")\nPY`).allowed, false, "the path is the argument");
  assert.equal(decide(`python3 -c 'p = "${MEMORY}/trap.md"; open(p, "w")'`).allowed, false, "a -c body with spaces is code");
  const escaped = `python3 -c "open(\\"${MEMORY}/trap.md\\", \\"w\\").write(\\"x\\")"`;
  assert.equal(decide(escaped).allowed, false, "a body quoting with escapes is one body");
});

test("a heredoc keeps the rest of its own operator line", () => {
  assert.equal(decide(`M=${MEMORY}\ncat <<EOF > $M/trap.md\nx\nEOF`).allowed, false);
});

/* A redirect is aim, not coexistence. Anchoring `>` to the start of a token made `2>/dev/null`
   a write shape, so reading a skill file with stderr silenced was refused — this suite's own
   harness hit it first. */
test("stderr redirection is not a write", () => {
  assert.equal(decide(`ls -la ${SKILL} 2>/dev/null | head`).allowed, true);
  assert.equal(decide(`cat ${MEMORY}/a.md 2>&1 | head -5`).allowed, true);
});

test("a read of a guarded file that writes somewhere else is free", () => {
  assert.equal(decide(`sed -n 1,5p ${MEMORY}/a.md > /tmp/out.txt`).allowed, true);
});

test("a redirect aimed at a guarded file is refused, appended or truncated", () => {
  assert.equal(decide(`cat > ${MEMORY}/trap.md`).allowed, false);
  assert.equal(decide(`echo x >> ${MEMORY}/trap.md`).allowed, false);
  assert.equal(decide(`echo x > ${SKILL}`).allowed, false);
});

/* A memory write is judged on content, so these need a real directory to compare against. */
const room = join(tempRoom("memory-gate-"), "memory");
mkdirSync(room);
const KNOWN = `---
name: background-work-survives-tool-timeout
metadata:
  type: feedback
---

A Bash tool timeout stops the waiting and never the process, so an empty output file beside a live
pid means the work is still running rather than killed.
`;
writeFileSync(join(room, "background-work-survives-tool-timeout.md"), KNOWN);

const write = (name, content, tool = "Write") => {
  const key = tool === "Write" ? "content" : "new_string";
  const session = randomUUID();
  const once = () => {
    const run = callHook(
      HOOK,
      { session_id: session, tool_name: tool, tool_input: { file_path: join(room, name), [key]: content } },
      HOME,
    );
    assert.equal(run.status, 0, run.stderr);
    return run.stdout.trim() ? JSON.parse(run.stdout).hookSpecificOutput.permissionDecisionReason : null;
  };
  return { first: once(), again: once() };
};

/* The shape of a second copy is not what is wrong with it, so a declared type buys no pass: a
   well-formed write is stopped exactly like a malformed one. */
test("every memory write is stopped once, well-formed or not", () => {
  const fact = "Zed opens a worktree without its main checkout, so a project-wide search misses vendored files.";
  const { first, again } = write("zed-typed.md", `---\nname: zed\nmetadata:\n  type: reference\n---\n\n${fact}\n`);
  assert.match(write("zed-untyped.md", `---\nname: zed\n---\n\n${fact}\n`).first, /Record only what cost/);
  assert.match(first, /Record only what cost a cycle/);
  assert.match(first, /One file, one fact/, "the shape, so re-sending is not guesswork");
  assert.match(first, /one pointer line in MEMORY\.md/);
  assert.match(first, /Do this: if a memory already states this, fix that file/);
  assert.equal(again, null, "the re-send passes, or the file could never be written");
});

test("a fact already written names the file that has it", () => {
  const { first } = write("killed-jobs-keep-running.md", KNOWN);
  assert.match(first, /Already in `background-work-survives-tool-timeout\.md`/);
  assert.match(first, /fix that file if its rule is wrong/);
  assert.doesNotMatch(first, /One file, one fact/, "the shape belongs where a file is being shaped");
});

test("editing an existing memory is told to replace, not append", () => {
  const { first } = write("background-work-survives-tool-timeout.md", "a corrected sentence", "Edit");
  assert.match(first, /never append a second version/);
  assert.doesNotMatch(first, /Already in/, "a file is not a copy of itself");
});

/* A refusal on every edit reprinted the same 300 tokens; the document it restated is one file. */
const skillWrite = (session, name) => {
  const room = tempRoom("skill-gate-");
  const file = join(room, "skills", "demo", name);
  mkdirSync(dirname(file), { recursive: true });
  const run = callHook(
    HOOK,
    { session_id: session, tool_name: "Write", tool_input: { file_path: file, content: "a line of method" } },
    HOME,
  );
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout).hookSpecificOutput.permissionDecisionReason;
};

test("the refusal names the categories and does not reprint the test", () => {
  const first = skillWrite(randomUUID(), "SKILL.md");
  assert.match(first, /trap \| method \| invariant \| discovery \| boundary/);
  assert.doesNotMatch(first, /it cost a cycle, not a thought/, "the five conditions belong to one file");
  assert.ok(first.split("\n").length <= 10, `five lines, not twenty-five: got ${first.split("\n").length}`);
});

/* A duplicate is refused before the once-per-file stamp, so this route has its own fixture: the
   skill already says the sentence being written into a second file. */
const skillDuplicate = () => {
  const room = join(tempRoom("skill-dup-gate-"), "skills", "demo");
  const line = "A refusal names the shape it refused and the one action that clears it.";
  mkdirSync(join(room, "references"), { recursive: true });
  writeFileSync(join(room, "SKILL.md"), `# demo\n\n${line}\n`);
  const run = callHook(
    HOOK,
    {
      session_id: randomUUID(),
      tool_name: "Write",
      tool_input: { file_path: join(room, "references", "shape.md"), content: `${line}\n` },
    },
    HOME,
  );
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout).hookSpecificOutput.permissionDecisionReason;
};

/* Every route, not the one that was easiest to reach: the memory write fires most and shipped
   without the pointer, and the duplicate refusal named a repository script — a path the project a
   gate fires in cannot resolve or run. A file in the user's own tree is fair to name. */
test("every refusal ends by naming where the argument is, and no path of this repository's", () => {
  const session = randomUUID();
  const reasons = [
    skillWrite(session, "SKILL.md"),
    skillWrite(session, "SKILL.md"),
    skillDuplicate(),
    write("a-new-trap.md", "A pnpm workspace resolves a symlinked package twice.").first,
    write("background-work-survives-tool-timeout.md", KNOWN).first,
  ];
  for (const reason of reasons) {
    assert.match(reason, /forge hooks --how learning-gate/u, reason);
    const ours = /(?:^|[\s(`])(?:\.\/)?(?:plugin|packages|scripts|docs|src|tools)\/\S+/u;
    assert.doesNotMatch(reason, ours, `names a path of this repository: ${reason}`);
  }
});
