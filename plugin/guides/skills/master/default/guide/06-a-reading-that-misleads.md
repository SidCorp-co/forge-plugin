## One reading that is not what it looks like

`forge stats waves` counts by checkout, not by master. Every session kept for that checkout is
opened, and any of them that wrote a wave or fold record is read as a dispatcher, so an orchestrator
or another agent dispatching in the same tree has its waves counted as though they were the
master's. The count of sessions it opens with is every session it opened, a person's plain work
among them, and never the number whose waves it counted.
