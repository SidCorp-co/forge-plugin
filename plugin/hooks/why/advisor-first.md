# advisor-first — the call that is easy to forget

`codex-order` orders the two opinions, and that is not the failure the user kept hitting. The failure
is simpler: **the advisor is never called at all.** It cannot be automated — a server-side tool is
not dispatched locally, so no hook can invoke it — so the nearest thing is to make forgetting
expensive at the moment forgetting starts. The first write of a turn is what trips it — the plan is
still soft there, and one call costs nothing next to the same point arriving after the work — and it
stays tripped while no `advisor_tool_result` appears after the last prompt.

It is a wall, not a nudge: every write in the turn is refused until the call appears in the
transcript. That is safe here and it would not be in `learning-gate` — this condition is a fact the
agent can clear by calling advisor(), where only the agent can judge whether a memory is worth
recording, so that gate has to let the re-send through. The re-send is the escape hatch there; here
the advisor call is.
The turn boundary is `promptSource`, the same field `codex-order` stopped trusting — and here its
unreliability runs the safe way. A message typed mid-turn reaches the transcript as one of two
shapes: a `queue-operation` record, which moves no boundary, or a `user` record carrying
`promptSource: "queued"`, which moves it like any prompt. When the second shape or a compaction
summary is read as a new turn, the cost here is one extra advisor call; in `codex-order` the same
misreading cost a false refusal.

It reads a write the way `learning-gate` does, through the shared `WRITES` and `REDIRECT` tests,
because most of this repo's edits arrive as an interpreter writing a file or as `cat > file <<EOF`
rather than as the `Write` tool — the first version covered only `WRITES`, and the user named the gap
before the hook had fired once. A redirect counts unless its target is under `/dev/`, so `2>/dev/null`
is not a write. `CLAUDE_CODE_DISABLE_ADVISOR_TOOL=1` stands the gate down.

**The first write after an advisor call is always refused, and the message says so.** The gate
refused writes seconds after live advisor calls, repeatedly, with the user watching. The logic was
right — replaying `advisedThisTurn` against the transcript truncated to what the hook could have read
returns `true` — and the file was wrong. Measured: the record generated at 12:18:11, the write
dispatched at 12:18:14, the refusal returned at 12:18:15, the transcript file not written until
**12:18:26**. The record lands about one tool round-trip later, and past this hook's 10-second
timeout, so no amount of waiting inside the hook can reach it. A `settle()` that re-read for a second
was tried and removed: it never once caught the case and cost every honest refusal a second. So the
refusal names the real move — run any other command, then re-send — and `codex-order`'s first half
says the same, because it reads the same lagging record. The price of the wall is one refused write
per turn. Making a codex consult the suggested escape instead would not work: `codex-order` gates the
consult on that same record, so both go blind together and the consult is refused too.

**A verb only counts in command position, and prose is not command.** Three false refusals in one
session, all from one matcher: a Cloudflare DNS query (`--name cp.musetools.com` contains `cp`), a
commit message quoting `mv`, and the intent of a codex consult whose heredoc body quoted
`writeFileSync`. So `advisor-first` runs `bodiless` first, and the shell verbs (`sed -i`, `tee`,
`cp`, `mv`, `truncate`) are anchored the way `bash-guard` anchors `--fix`.

Anchoring is where this gets narrow in the wrong direction, and codex caught it: a first version
allowed only separators and a short wrapper list, which missed `MODE=fast cp a b`, `command mv a b`
and `if cp a b; then`. Command position now means start of string or line, after `;` `&` `|` `(`,
after `-exec`, after an assignment prefix, or after `sudo`, `command`, `nohup`, `time`, `env`,
`xargs`, `do`, `then`, `else`, `if`, `elif`, `while`, `until`. `^` alone was another such miss —
without `/m` it matched only the string start, so `cd repo\ncp a b`, the shape most of this repo's
commands take, was invisible. The library calls — `open(…, "w")`, `write_text`, `writeFileSync`,
`shutil.copy`, `os.replace` — need no anchor, because nothing else looks like them.

The two errors are not symmetric, which is why the anchor is generous: a false refusal costs one
advisor call, and a missed write is the wall silently not existing.

**A write outside the repository is not work.** The wall fired on `node scripts/gates.mjs >
/tmp/notes.log` — a read-only gate run whose only write was a log in a scratch directory — and on a
memory file under `~/.claude/projects/`, written while the working directory happened to be a
checkout. Neither is what the advisor exists to see, so a write whose every target resolves outside
the repository stands the gate down. Only a redirect names its target: a write *verb* (`sed -i`,
`cp`, `tee`, an interpreter opening a path) names nothing this can read from the line, so it counts
as inside, because a wall that stands down on doubt is not a wall. Variables are substituted first —
`H=/tmp/d` then a redirect to `$H/t.jsonl` named the directory in no single token, and that shape
was two of the false refusals.
