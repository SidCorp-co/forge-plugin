// The one-call wait on work already running, in one home: the command this plugin prescribes for it
// and the pattern that tells one from a read of a file's tail. A gate prints the command to a run
// that has to type it and the corpus reading counts what a run typed, so the two read one statement
// rather than spelling the idiom twice. `plugin/hooks/how/polling.md` carries the same command in
// prose, markdown importing nothing.

/** The command as a refusal prescribes it; `<seconds>` and `<pid>` are the two a run fills in. */
export const WAIT_COMMAND = "timeout <seconds> tail --pid=<pid> -f /dev/null";

/** What makes a `tail` a wait rather than a read: the `--pid` argument, wherever among the options it
 *  stands — `tail -f --pid=N` is the same wait as `tail --pid=N -f`, and a bare `tail -n 30 x.log`
 *  is a read of a file and no wait at all. A fragment, anchored by the caller at whatever a command
 *  position is for it. */
export const WAITS_ON_PID = String.raw`tail(?:[ \t]+-\S+)*[ \t]+--pid`;
