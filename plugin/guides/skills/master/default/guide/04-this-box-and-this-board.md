## This box and this board

- What resolves on this box, and from where: `forge doctor`.
- What the board holds at each status, and whether its work queue is stalled: `forge doctor project`.
- Whether a release batch is running, and for how long: `forge release-batch`.
- Whether this box is refusing work right now: `forge-runner status`. That is the runner's own
  verb, which ships with the runner and not with this CLI, so its own help is where it is read.
