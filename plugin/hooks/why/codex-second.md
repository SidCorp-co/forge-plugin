# codex-second — the second opinion happens

`codex-order` puts the two opinions in order. Neither it nor the prompt makes the *second* one
happen, and it did not: a commit landed, then an hour of hook changes, with the advisor consulted
four times and codex not once. The end-of-turn reminder is `additionalContext` — an agent can ignore
it, and did.

The free opinion is not walled off, deliberately. A gate that refused every write until the built-in
advisor had spoken was tried and removed at the user's instruction: the system prompt already asks
for that call, so a hook repeating it charged a refused write per turn to enforce an instruction that
was already there. This one asks for the thing no prompt asks for — a reading by another provider —
and it arms itself on the advisor call rather than demanding it.

**Where it fires was the user's choice, and the alternatives were measured.** Claude Code 2.1.251
offers `PreToolUse`, `PostToolUse`, `Notification`, `Stop`, `SubagentStop`, `SessionStart`,
`SessionEnd`, `UserPromptSubmit` and `PreCompact`. There is no advisor event: the advisor is a
server-side tool handled in the streaming path, so nothing local is dispatched and no `PostToolUse`
follows it. `Stop` was tried twice — printing, which reached nobody, then blocking, which stopped a
turn whose only change was the hooks' own documentation — and removed. What is left is the write itself, which is
where the user asked for it: a `PreToolUse` on a write *that follows an advisor call*.

So the condition is four facts, all cheap: the call writes, the advisor has spoken this turn, no
consult has spent that advice, and `git status --porcelain` is non-empty. The last one matters — a
clean tree gives codex nothing to read, and a rule enforced where it cannot be satisfied usefully is
the kind that gets switched off. Before the advisor speaks nothing here fires at all: with no first
opinion there is nothing for this to be second to.

**It decides once per advisor call, not once per write** — and that is a rule change codex named
before it shipped. Standing down when nothing dirty postdates the last consult stops the gate
demanding a review of bytes codex just cleared; alone, it also means the write it allows creates new
dirt, so the *second* write of a turn gets refused and the consult it demands reviews a fragment. So
the decision is stamped: a stand-down is remembered for that advisor call, a refusal is not, and a
new advisor call re-arms the question. The cost, accepted deliberately: work built after a stand-down
is not reviewed in that turn. It is reviewed at the first write of the next turn, when it is finished
rather than half-built. A deletion has no mtime and slips through; a turn that only deletes is not
what this is for.

One consult clears the turn, because the same spend accounting `codex-order` uses says the advice is
answered. `FORGE_CODEX_DISABLE=1` clears the session, and `CLAUDE_CODE_DISABLE_ADVISOR_TOOL=1` stands
it down too — with no advisor there is no first opinion for this to be second to.

The price is stated rather than hidden: a turn that takes advice and touches a dirty tree pays one
consult, around 30–60 seconds, before its first write lands. That is the trade the user asked for
twice — "not relax but forget to run" — after watching the reminder be ignored.

**The write has to be in the tree codex would read.** The root comes from the session's working
directory and the target was never consulted, so a memory file written under `~/.claude/projects/`
demanded a review of a repository that write was not part of. A target resolving outside the root
now stands the gate down — and that stand-down is not stamped: it is a fact about one write, not a
decision about this advice, and stamping it would let one stray write clear the turn.

## What counts as a write, which this gate and `learning-gate` read the same way

Most of this repo's edits arrive as an interpreter writing a file or as `cat > file <<EOF` rather than
through the `Write` tool, so the shared `WRITES` and `REDIRECT` tests cover both — the first version
of the older wall covered only `WRITES`, and the user named the gap before it had fired once. A
redirect counts unless its target is under `/dev/`, so `2>/dev/null` is not a write.

**A verb only counts in command position, and prose is not command.** Three false refusals in one
session came from one matcher: a Cloudflare DNS query (`--name cp.musetools.com` contains `cp`), a
commit message quoting `mv`, and a codex intent whose heredoc body quoted `writeFileSync`. So the
command runs through `bodiless` first, and the shell verbs (`sed -i`, `tee`, `cp`, `mv`, `truncate`)
are anchored the way `bash-guard` anchors `--fix`.

Anchoring is where this gets narrow in the wrong direction, and codex caught it: a first version
allowed only separators and a short wrapper list, which missed `MODE=fast cp a b`, `command mv a b`
and `if cp a b; then`. Command position now means start of string or line, after `;` `&` `|` `(`,
after `-exec`, after an assignment prefix, or after `sudo`, `command`, `nohup`, `time`, `env`,
`xargs`, `do`, `then`, `else`, `if`, `elif`, `while`, `until`. `^` alone was another such miss —
without `/m` it matched only the string start, so `cd repo\ncp a b`, the shape most of this repo's
commands take, was invisible. The library calls — `open(…, "w")`, `write_text`, `writeFileSync`,
`shutil.copy`, `os.replace` — need no anchor, because nothing else looks like them.

The two errors are not symmetric, which is why the anchor is generous: a false refusal costs one
consult, and a missed write is the gate silently not existing.

**Only a redirect names its target.** A write *verb* (`sed -i`, `cp`, `tee`, an interpreter opening a
path) names nothing readable from the line, so it counts as inside the tree — a gate that stands down
on doubt is not a gate. Variables are substituted first: `H=/tmp/d` then a redirect to `$H/t.jsonl`
names the directory in no single token, and that shape was two false refusals of the removed wall.

**The advisor's record reaches the transcript about a round-trip later, and past a hook's timeout.**
Measured: the record generated at 12:18:11, the write dispatched at 12:18:14, the refusal returned at
12:18:15, the transcript file not written until **12:18:26**. So no amount of waiting inside a hook
reaches it — a `settle()` that re-read for a second was tried, never once caught the case, and cost
every honest refusal a second. `codex-order` reads the same lagging record, which is why its refusal
names re-running the command rather than calling the advisor again.
