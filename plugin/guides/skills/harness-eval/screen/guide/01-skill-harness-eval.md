# Skill: harness-eval

One session judges the harness by what its own records say, and files what it finds. It writes no
code, changes no weight, threshold or prompt, and takes no lease: a number that moved is a pointer to
a change somebody landed, and the issue that landed it is where the reading goes.

**Arguments.** A project directory names the checkout whose runs are read; without one, the working
directory. A second argument naming a change — a release, an issue key, a prompt version — is the
thing the numbers are read against first.
