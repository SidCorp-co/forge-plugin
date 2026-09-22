# Two levels, and which one wins

A rule lives at one of two levels. Importance does not decide which; the conflict rule at the
bottom does.

## Global — the plugin

Rules that hold wherever the agent works: how a change is verified, what may not be written
through the shell, when a checker is about to hard-code its cases. The plugin owns **when and
where** a rule fires: which tool calls, which write routes, which directories.

The plugin must be installable into a project that has never heard of it and change nothing.
So it carries no threshold, no path, no port, no rule content that belongs to one codebase. A
global plugin that imposed a rule the project never opted into is the thing projects disable,
and a disabled plugin protects nothing.

## Project — the centralized gate

The project owns **what counts as correct**: its lint config and thresholds, its checkers, its
`typecheck | lint | test` scripts, the invariants only its domain has. These live in the repo,
run from the repo, and are the authority on their own subject.

Centralized means one entry point per workspace rather than a rule the reader has to
reassemble: the lint script chains the checkers, so running the gate runs all of them and
there is nothing to remember.

## Where they meet

The plugin fires; the project decides. The clearest case is the code-quality hook: the plugin
notices that a code file was written — through Write, Edit, or a `sed -i` the shipped hook
never saw — resolves the project's OWN installed linter and hook script through its
node_modules, and hands the file over. Every rule applied is the project's. Every route
covered is the plugin's. Neither holds a copy of the other's job.

A project without that dependency gets silence. Silence is the correct answer: it did not opt
in.

## The keys one flow reads, and whose each is

The flow's own settings obey the division above rather than sitting outside it. Every one of them is
the project's, because none of them can be stated without naming the project. Whose a key is and where
the key is kept are two questions: the project's half lives in this machine's record of that
project, at `~/.config/forge/projects/<the checkout's root folder>/config.json`, out of the checkout
and out of git. That is what lets one box differ from the repository and one worktree from another
while the decision itself stays the project's, and it is why a value being the project's does not
put it in a file every clone carries:

- **`feedback`** — whether a run working in this project may file about this plugin, and about the
  project itself. A project that does not want a contractor's plugin reporting on itself from inside
  their checkout can say so, and one that wants the run to do the job and nothing else can say that.
  What it gives up by turning the plugin channel off is real and is the project's to choose: six
  causes reached this plugin's backlog through that channel over one review window, and a project set
  to `off` meets those defects and records them only in a run's report.
- **`flow`** — which flow's text this project is served, `default` for a project with no screen and
  `screen` for one whose change a person looks at. Projects are independent: two on one machine may
  run two flows, a run reads the flow of the checkout it stands in, and a project moves between them
  when it chooses rather than when the plugin releases. The retired `method` and what still answers
  for it: [the flow axis](cli/the-flow-axis.md).
- **`landing`** — where the merge sits, as an override of what the tracker's own record already
  implies. The route itself is derived and not asked for twice.
- **`lease.workingRe`** — what a run working in one of this project's trees is running. A lease's id
  names the tree a run was cut in rather than the run, so two agents standing in one tree resolve it
  alike and the field cannot tell a second run from the first renewing; what is left readable is the
  tree's own processes, and the command that means one of them is a run holding that tree is this
  repository's script here and somebody else's somewhere else. A project that declares nothing gets
  the behaviour it had before the key existed, which is the silence the section above calls correct.
- **`ship`** — whether a run lands its own change or ends at a pushed branch and a landing checkpoint
  for another actor. It was the machine's until 2026-09-22, on the reading that the actor which lands
  runs on this box; what that reading missed is that one value in the machine's own file answered for
  every project on it at once, so a box carrying a tracker whose landings are batched and a tracker
  whose runs land their own could not hold both (ISS-2174). It sits with `landing` and `drainedBy`
  because those two describe the landing this decides the existence of, and a project that declares
  nothing gets `self`, which is what every run did before the key existed.

The machine's own half of the same surface is the verbs it withholds:
[withholding a verb](cli/withholding-a-verb.md) owns that level, and says what happens where a
machine's withholding and a project's key disagree.

## The conflict rule

**Where both could speak, the project wins.** The global level is written to cover what is
common, so a project that disagrees has almost always met something the global rule could not
have known — a threshold its domain forces, a layout its history fixed, an exemption its
users need. Overriding it globally would push that local fact onto every other project.

The corollary bites harder: **when a rule cannot be stated without naming the project, it does
not belong in the plugin at all.** Not as a default, not as a config key with a sensible value.
Move it into the repo, where its reason is visible next to the thing it governs.
