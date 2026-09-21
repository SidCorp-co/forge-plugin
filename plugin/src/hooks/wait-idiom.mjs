// The one-call wait on work already running, in one home: the command this plugin prescribes for it
// and the pattern that tells one from a read of a file's tail. A gate prints the command to a run
// that has to type it and the corpus reading counts what a run typed, so the two read one statement
// rather than spelling the idiom twice. `plugin/hooks/how/polling.md` carries the same command in
// prose, markdown importing nothing.

/** The command as a refusal prescribes it; `<seconds>` and `<pid>` are the two a run fills in. */
export const WAIT_COMMAND = "timeout <seconds> tail --pid=<pid> -f /dev/null";

/** What makes a `tail` a wait rather than a read: the `--pid` argument, wherever in the command it
 *  stands. Anything may stand in front of it — an option, an option's separate value, an operand —
 *  `tail -n 0 --pid=N -f /dev/null` and `tail /dev/null -f --pid=N` being the same wait as
 *  `tail --pid=N -f /dev/null`, while a bare `tail -n 30 x.log` is a read of a file and no wait at
 *  all. Three bounds: nothing crosses a separator, so the argument belongs to this `tail` and not to
 *  a later command; nothing past a bare `--`, after which a word is a filename and `tail -- --pid=N`
 *  reads a file with an odd name; and the option ends where its own name does, so `--pidfile=x` is
 *  some other option. A fragment, anchored by the caller at a command position. */
export const WAITS_ON_PID = String.raw`tail(?:[ \t]+(?!--(?:[ \t]|$))[^\s;|&()<>]+)*?[ \t]+--pid(?![\w-])`;
