## One reading that is not what it looks like

`forge stats waves` counts by checkout, not by master. It reads every session under the checkout's
directory, so a person or another agent working in that tree is inside its figures, and on a
checkout an orchestrator also works in, one of the sessions it read was the orchestrator's. Its
first line says how many sessions it read and under which directory: a count above the master's own
is the sign that somebody else is in the number.
