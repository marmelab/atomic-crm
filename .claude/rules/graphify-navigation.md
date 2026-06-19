# Graphify navigation — locate code through the knowledge graph first

Applies to: planner, developer, simple-developer, quality-reviewer, test-validator.
Any agent that needs to find files, understand relationships, or audit reuse before
reading or editing code.

This project ships a persistent knowledge graph at `graphify-out/graph.json`
(god nodes, community structure, cross-file relationships). It is **git-tracked**,
so it is present on `main`, on every session branch, and inside every task
worktree. Use it to navigate before falling back to raw `Grep` / `Glob`.

## Why

`graphify query` returns a scoped subgraph — the files, symbols, and
`src=<path> loc=<line>` locations relevant to a concept — usually far smaller and
more targeted than a broad grep or a full-file read. It surfaces cross-file
relationships you wouldn't think to grep for. Fewer exploration turns, lower
token cost, fewer missed call sites.

## The three commands (run via Bash — not the Skill tool)

Navigation uses the globally-installed `graphify` CLI directly. Do **not** invoke
`Skill({skill: "graphify"})` — that loads the graph-*building* pipeline, which you
do not need to read the existing graph.

| Command | Use it for |
|---|---|
| `graphify query "<question>"` | Broad: which files/symbols implement or touch a concept ("where is deal stage configured"). |
| `graphify path "<A>" "<B>"` | The relationship/chain between two concepts ("ContactList" → "dataProvider"). |
| `graphify explain "<concept>"` | A focused, plain-language explanation of one node. |

Quote the `src=…` / `loc=…` locations the graph returns, then `Read` the actual
file for authoritative current content — the graph gives you the map, the file
gives you the bytes.

## Worktree agents — always `cd` first

`developer`, `simple-developer`, `quality-reviewer`, `test-validator` run inside a
task worktree. Bash is stateless, so every call needs the prefix (see
`worktree-scope.md`):

```bash
cd <WORKTREE_PATH> && graphify query "<question>"
```

This reads the worktree's own `graphify-out/graph.json` — staying inside worktree
scope. `planner` runs from `$CLAUDE_PROJECT_DIR`; `documentator` (Mode 2) runs on
`main` — both query without the `cd` worktree prefix.

`query` / `path` / `explain` are **read-only** — they write nothing into the
working tree, so they are safe even under `git add -A`, and `bash-guard` does not
block them (they are not validation commands).

## Two limits to respect

1. **The graph reflects committed state**, not your uncommitted edits. Files you
   just created in this ticket are not in the graph yet — find those with
   `Glob` / `Grep` / `Read`. Graphify is for navigating code that already exists.
2. **Never run `graphify update` (or any rebuild) inside a worktree.** It rewrites
   the large tracked `graph.json`, which would pollute the ticket diff and collide
   across parallel worktrees. Keeping the graph fresh is the main thread's job, not
   a ticket agent's.

If `graphify` is not on `PATH` (unexpected), or a query returns nothing useful,
fall back to `Grep` / `Glob` — do not block on it.
