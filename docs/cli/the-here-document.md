# the here-document — which of its bodies the id readers take out

The readers [the granted id](the-granted-id.md) describes, and the tree reading beside them, each
ask a question of a shell text: which run a write goes under, and where it stands. A here-document
is the one construct whose text is in the command without being the command's, and this page says
what they do with it.

A body is the stdin of the command it stands on. What that process does with its stdin is its own,
exactly as a script file handed to `bash` is, and this reader never opens one of those either. So
where the body can be delimited exactly, every reader here takes it out before reading: the words
in it are no call, no id and no move. A comment written by `cat > file <<'EOF'` can quote the
variable and name every verb it likes, and the `forge` call after it keeps its grant, its reach and
its tree.

Four shapes are read as they were before, with the operator still an opener, because each one is a
body this reader cannot vouch for:

- **An unquoted delimiter whose body runs a substitution** — `$(…)`, a backtick, `${ …; }` or `${| …; }`. The
  invoking shell runs it before the command and without a prefix's assignment. Inside the body a
  quote is data and stops nothing; only a `\` on the `$` or the backtick does, and a
  backslash-newline joins an opener it splits, as it does on a shell line.
- **No delimiter line.** The shell reads to the end of the text; this reader does not guess where the
  author meant it to stop.
- **A quoting the walk guesses at** before the operator's line ends — the `$'…'` and nested-quote
  cases [the granted id](the-granted-id.md) names.
- **An operator inside an open parenthesis.** In `$(…)` or a subshell the body is one the reach
  already stops at.

A `<<` inside `$((…))` or `((…))` is a shift, and no operator at all: the reader steps past it, and
a body after it is taken out like any other.

The same reader places the bodies for two other consumers, each with its own policy over the four
shapes above. The write gates cut every body it places, a nested one included, so a commit message
fed through `"$(cat <<'EOF' … )"` is prose to them, and they read a body a program runs as that
program; what is left is `forge hooks --how writes`. The stats corpus cuts every body it places
before it classifies a call, so a document a run writes names no command it ran.

What that costs: a body a program runs — `bash <<'EOF'`, `node - <<'EOF'` — that calls `forge`
itself is read as data too. Under an export that call inherits the id, so nothing is lost. Under a
prefix on another call it does not, and the grant is wrong by one hold, which is what the lost
name cost every heredoc command before. Put such a call in its own shell call.
