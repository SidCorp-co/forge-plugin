# Running as the Forge driver

Read this when the runner handed you the issue — a `drive` job on a project in autonomous mode —
rather than a person in a terminal. The method is the same nine phases; three things are
different, and each is a literal the workflow elsewhere keeps abstract.

You know you are the driver when the prompt names a run id and tells you to reach Forge with
`forge-runner api`. A person's terminal gets neither. The runner has already exported the token
and the project id that command needs; you never type either.

## The tracker is reached one way

`forge-runner api <path>` — it supplies the `/api/` prefix and the token. `<project>` in the
paths below is the id the runner's prompt gives you; it is the one value you carry. Not the `forge` CLI in
this plugin, not an MCP tool: the runner's prompt names this transport and it names it once, and
a session that reaches the same data two ways is how 4,806 `forge_step_start` calls landed on
autonomous projects from a skill that never mentioned the tool.

```
forge-runner api issues/<id>
forge-runner api issues/<id>/comments -X POST -d '{"body":"..."}'
forge-runner api issues/<id> -X PATCH -d '{"status":"in_progress"}'
forge-runner api projects/<project>/pipeline-config
```

## The claim is already yours

Phase 1 says to take the issue with `forge claim` before the first write. As the driver you do
not: the runner dispatched you for this one issue and minted your credential for it, so the
lease the claim would take is the job itself. There is no other session to refuse you, and
`forge claim` is the plugin CLI — the second transport this document exists to keep you off.

## Five statuses, and which one each park means

Where this workflow says "park it" or "the status the tracker uses for waiting on the reporter",
the Forge driver writes one of exactly five kernel statuses. The board shows other names; write
what is in this column.

| Write | When |
|---|---|
| `open` | claimed and not yet started |
| `in_progress` | you are working it — set this before Phase 2 |
| `needs_info` | **every park and every stop** — a question (Phase 2), a screen for a human to see (Phase 5), an unshippable finding, a condition-3 stop |
| `closed` | Phase 7 done and verified where it runs; stamps `merged_at` |
| `dropped` | the claim was false, or this was never work; no `merged_at` |

`needs_info` is the only park a human's comment restarts. `waiting`, `reopen` and `on_hold` are
rewritten by the kernel the moment a driver writes them, so a park spelled that way lands
somewhere you did not choose. The staged ladder — `confirmed`, `approved`, `developed`,
`testing`, `tested`, `released` — does not exist in this mode; "done" in the skill's description
means `closed` here.

## Declare each phase before you begin it

The journal is what a session that dies restarts from. Find the run once, before Phase 0:

```
forge-runner api "projects/<project>/pipeline-runs?issueId=<issue>&status=running"
forge-runner api pipeline-runs/<run>/resume-point
```

If `resume-point` returns a phase, you are a resumed session — continue there, not at Phase 0.
Then, for every phase in the spine:

```
forge-runner api pipeline-runs/<run>/phases -X POST -d '{"phase":"phase-3"}'
forge-runner api pipeline-runs/<run>/phases/end -X POST -d '{"phase":"phase-3","attempt":1,"outcome":"ok"}'
```

`start` answers with the `attempt` number; pass that exact number to `end` — re-entering a phase
opens a new attempt rather than overwriting. `outcome` is `ok`, `failed` or `abandoned`, and a
`note` is the only extra field `end` accepts. A phase you never declared did not happen as far as
the next session can see. Measured before this rule existed: 76 finished driver jobs sharing one
journal row, every crash restarting from the top.

## The release note is a field, not only a comment

`closed` is refused while `releaseNotes` is null. Seed it in Phase 6, as the field the tracker
holds — `{ section, userFacing, technical }`, `section` one of `Added | Changed | Fixed | Removed |
Security | Skip` — and `{ section: 'Skip', userFacing: '-' }` is a complete answer for a change
with no user-facing half:

```
forge-runner api issues/<id> -X PATCH -d '{"releaseNotes":{"section":"Fixed","userFacing":"..."}}'
```

## What is the same

Everything else. The five rules, the three stops, the decision ledger, the project's own rules
outranking these, and the loop back to Phase 1 — the driver runs until no unblocked issue is left,
exactly as a person's session would.
