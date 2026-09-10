# Skill: issue-flow

One session takes an issue from its title to a deployed and closed change, and then the next issue.
Nothing here dispatches to a runner or hands off to another agent.

**Arguments.** An issue key, or several, starts at Phase 1 on those. No argument means take the open
issues that are not blocked, in the order `forge next` gives, until none are left.

**Method only, never project facts.** No repository's ports, deploy targets, paths or credentials
appear here, and no payload's shape: `forge -h` and each verb's own `-h` are where a write is
looked up.
