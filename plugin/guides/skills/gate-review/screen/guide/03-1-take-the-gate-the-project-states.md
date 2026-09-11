## 1. Take the gate the project states

Read it off the project: the scripts its manifest declares, its CI workflow, a make target, the
command its rules file calls the gate. Whichever the project calls the gate is the one under review,
even where a cheaper subset exists.

**Where a project states no gate, say so and stop.** A pipeline assembled from the commands that
happen to be present is nobody's gate.
