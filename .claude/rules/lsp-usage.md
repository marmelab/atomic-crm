# LSP — use semantic code intelligence when possible

Applies to: developer, quality-reviewer, planner.

This repo has an `LSP` tool backed by a TypeScript language server (configured in
`.claude/settings.json`, covering `.ts`, `.tsx`, `.mjs`, `.js`, and `.jsx`). Use it
for any **semantic** question about TypeScript/JavaScript code. It resolves symbols
through the type system, so it is exact where text search only guesses.

## The reflex to break: `grep`/`rg` in Bash to find a symbol

In practice the `Grep` tool is rarely used — code search here happens through
`grep`/`rg` **inside `Bash`** (`grep -rn "DealStage" src/`). That reflex is the
thing to stop for symbol questions. `grep` matches strings: it can't tell a
definition from a comment, a type from a same-named variable, or one `handleSubmit`
from another, and it silently misses re-exports and aliased imports. The `LSP` tool
resolves the actual symbol.

**Hard rule:** to find where a TypeScript identifier (a PascalCase type/component,
a camelCase function/hook, an exported const) is **defined** or **used** in
`.ts/.tsx/.js/.jsx`, call `LSP` — never `grep -rn "<Symbol>" src/` in Bash and never
the `Grep` tool. Reach for LSP first whenever the question is "where / what / who",
not "which files contain this string".

| Instead of this bash-grep… | …use this LSP call |
|---|---|
| `grep -rn "DealStage" src/` (every use of a type) | `findReferences` (impact/blast radius) |
| `grep -rn "mergeContacts" src/` (where defined) | `goToDefinition` |
| `grep -rn "LatestNotes\|useContactImport" src/` (locate a symbol) | `workspaceSymbol` |
| `grep -n "export" file.tsx` (what a file exports) | `documentSymbol` |
| `grep -rn "buildActivityLog" src/` (who calls it) | `incomingCalls` |

| Operation | Use it to |
|---|---|
| `goToDefinition` | jump to where a symbol is declared (type, function, component, prop) |
| `findReferences` | find every real use of a symbol before changing or renaming it — impact analysis |
| `hover` | get a symbol's resolved type / signature / JSDoc without opening its file |
| `documentSymbol` | outline a file's exports/functions/components before reading it whole |
| `workspaceSymbol` | locate a symbol by name across the repo (`query` required) — faster than grepping for a file path |
| `goToImplementation` | find concrete implementations of an interface or abstract member |
| `prepareCallHierarchy` | get the call-hierarchy anchor at a position (precedes incoming/outgoing calls) |
| `incomingCalls` / `outgoingCalls` | trace the call graph into / out of a function |

Positions are **1-based** (`line`, `character`), exactly as shown in `Read` output
and editors.

## Per-agent fit

- **developer** — before editing a symbol's signature,
  `findReferences` to size the blast radius; `hover` to confirm a type;
  `goToDefinition` to reach the source. Do not `grep -rn "<Symbol>" src/` in Bash
  to answer these — that is the exact reflex this rule replaces.
- **quality-reviewer** — `findReferences` / `incomingCalls` to check that every
  call site of a changed function is handled; `goToDefinition` to confirm a type
  is what the diff assumes; `findReferences` / `workspaceSymbol` to confirm a new
  component or resource is actually wired into the app (imported, registered),
  not merely created.
- **planner** — `workspaceSymbol` to locate probable `files_to_modify` faster than
  grep. Still light discovery — no deep reading.

## When `grep`/`rg` IS the right tool

LSP is for TS/JS symbols. Keep using `grep`/`rg` (in Bash) — and do not try LSP — for:

- **Non-TS/JS files**: `.sql`, `.md`, `.json`, `.css` — no server covers them.
- **Text / domain-word sweeps** that deliberately include strings, comments, and
  non-code: e.g. deleting a resource with `grep -rniE "\bdeals?\b|deal_notes?"`,
  which must catch SQL, fixtures, and labels — not just the TS symbol.
- **Database identifiers** (column / view names like `company_id`,
  `contacts_summary`) that live in SQL and string literals, not as TS symbols.
- Plain "which files mention 'boulangerie'" lookups.

LSP is **read-only code intelligence, not a validation command** — it does not run
`tsc`, so it is exempt from `validation-commands.md` and you may use it freely. It
does not replace the hook-run typecheck.

## Worktree note

Pass **absolute paths inside your own worktree** (`<WORKTREE_PATH>/src/...`), per
`worktree-scope.md` — never the base-branch checkout under `$CLAUDE_PROJECT_DIR`.
Fall back to `grep` / `Read` only when LSP returns an actual error or empty result
for a worktree file — not as the default. Do not block on it.
