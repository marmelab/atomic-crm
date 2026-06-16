---
paths: []
---

# Coding Style

## Immutability (critical)

Always create new objects, never mutate existing ones:

- Wrong: modify original object in-place
- Correct: return a new copy with the change applied

Rationale: prevents hidden side effects, makes debugging easier,
enables safe concurrency.

## Core principles

KISS — prefer the simplest solution that works. Optimize for clarity
over cleverness.

DRY — extract repeated logic into shared functions. Introduce
abstractions when repetition is real, not speculative.

YAGNI — do not build features before they are needed. Start simple,
refactor when the pressure is real.

## File organization

Many small files over few large files:
- 200-400 lines typical, 800 max
- High cohesion, low coupling
- Organize by feature/domain, not by type
- Extract utilities from large modules
- Grow the file *count*, not the file: when an edit would push a file past
  the ~400-line typical ceiling, extract a new focused module instead of
  appending to the existing one

## Error handling

- Handle errors explicitly at every level
- User-facing code: provide friendly error messages
- Server-side: log detailed error context
- Never silently swallow errors

## Input validation

- Validate all user input before processing
- Use schema-based validation where available
- Fail fast with clear error messages
- Never trust external data (API responses, user input, file content)

## Naming conventions

- Variables and functions: camelCase
- Booleans: is, has, should, or can prefix
- Interfaces, types, components: PascalCase
- Constants: UPPER_SNAKE_CASE
- Custom hooks: camelCase with use prefix

## Code smells to avoid

- Deep nesting (>4 levels) — use early returns
- Magic numbers — use named constants
- Long functions (>50 lines) — split into focused pieces
- Large files (>800 lines) — extract modules