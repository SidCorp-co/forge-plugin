/* Everything this gate's help says about the gates already running when it starts: the second gate of one tree it
   refuses, the ceiling it declines at, what it counts and what the number sizes. Its own file because the runner's is at
   the line limit its own checker sets, and this is the section ISS-1705 grew. `tools/gates.mjs -h` prints it in place. */
import { DECLINED, LANDING_ENV, RAISE, WAIT } from "../machine.mjs";
import { LANDING_WAIT_ENV } from "../landing.mjs";
import { DEFAULT_MINUTES } from "../verdict.mjs";
import { WAIT_COMMAND } from "../../../plugin/src/hooks/wait-idiom.mjs";

export const MACHINE_HELP = `Before all of it, a gate of this same tree already running refuses this one, whatever number is
declared: two gates over one tree read and write one record at once, and the later answers about
neither (ISS-1705). The refusal exits ${DECLINED}, writes no line to the record a wait reads, and
names the earlier gate's pid, its tree and the file its output is written to. Its route is the
one-call wait on that pid, \`${WAIT_COMMAND.replace("<seconds>", String(DEFAULT_MINUTES * 60))}\`,
after which ${WAIT} reads its verdict. Which of the two is earlier is the kernel's start order, so
the first is never refused for the second. A gate of another worktree of this checkout is not this
case: its tree differs, and the ceiling below is what counts it.

Before any of that, before the table and before the first step, it counts the gates of this checkout
already running and declines where they have reached the number this project declares — one number,
${RAISE}, absent which nothing is counted and nothing declines. A decline exits ${DECLINED}
rather than 1, names each gate it counted and the tree that gate is judging, records no pass and no
figure, and says no verdict about this tree: a run that spent twenty-five minutes and then reported
the tree is what this exists to stop, and a refusal costing the caller a step has already lost the
argument.

A landing's gate is ahead of a builder's for the next free place, because what lands is ahead of
what is being readied (ISS-2461). land-ready starts it with ${LANDING_ENV} naming its issue keys and
${LANDING_WAIT_ENV} its minutes, and a gate reads the first off every other gate's environment: a
builder's gate counts each landing's gate as ahead of it whenever that one started, and names the
landing where it took a place the gates started earlier had left free. A landing's gate counts only
the gates started before it, so it never adds a gate past the number; declined, it waits for a
place up to its minutes instead of exiting, and past them exits ${DECLINED} saying how long it
waited and which gates held the places. Neither variable reaches a step, so a gate a step starts is
never a landing's, and a wait of the same runner is counted by no gate, a landing's included.

What it counts is gates, not load. Four whole runs of this gate at one-minute loads of 5.6, 5.9,
10.5 and 24.7 did not order by whether they passed (ISS-917), and three whole gates at once, at load
27, were all green. What it counts them off is the process table: a gate is a node process running a
runner of one of this checkout's worktrees, and the order is the kernel's own start time for each,
which is fixed before either gate runs a line. A file left behind would have to be reclaimed when
its holder is killed, and reclaiming a shared name is a race two gates can both win.

The ceiling is advisory and not mutual exclusion. A gate becomes countable when the shell
\`npm run check\` spawned execs node, so two gates starting inside that window — milliseconds, and
only ever a gate's own fork-to-exec — can both admit themselves; the cost of that is one extra gate
on a box measured to carry three with no loss. Not counted at all: a gate of another checkout, a
build of another project, a gate belonging to another user, and every gate on a machine whose
process table cannot be read, which declines nobody. Only the process running a runner is counted,
never one that merely names its path, because a run declined for somebody's \`grep\` costs a wave a
round.

The number also divides the cores a test step spends, and the run prints what it sized itself to, so
a step that took longer for a smaller fan-out cannot be read as a starved machine. A box that has
declared nothing spends every core, as it always did. What that costs is measured here over 175 files
and 2368 cases — the same work took 276s at 3 workers, 223s at 6, 228s at 12 and 231s at 18 — and it
is paid deliberately: a gate that overruns the machine does not come back slower, it comes back
\`unproved\` and is spent again whole.`;
