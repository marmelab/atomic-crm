---
name: delete-initial-resource
description: Remove one or more of the initial CRM resources (contacts, companies, deals, tags, tasks) from the codebase. Use when the user asks to delete, remove, or strip out one or several of these built-in resources. Runs the delete-initial-resource.ts script to drop each resource's own folder, then guides cleanup of every file that references them.
---

# delete-initial-resource

Removes one or more of the five initial Atomic CRM resources (`contacts`, `companies`, `deals`, `tags`, `tasks`) and every reference to them.

## How to proceed

1. **Read [`core.md`](core.md) first** — the script, the shapes a resource takes, the backend checklist, and the verify gates. These apply to every resource.
2. **Confirm the target(s)** with the user — the deletion is irreversible. For each resource named, read its file:
   - `contacts` → [`contacts.md`](contacts.md) — spine resource, **confirm cascade scope first**
   - `companies` → [`companies.md`](companies.md) — spine/link resource, **confirm cascade scope first**
   - `deals` → [`deals.md`](deals.md)
   - `tags` → [`tags.md`](tags.md)
   - `tasks` → [`tasks.md`](tasks.md)
3. **Run the script** (see core.md), then clean each dependent file it prints — guided by core.md's "shapes" patterns and the per-resource specifics.
4. **Verify** per core.md: `make typecheck && make lint`, targeted greps, and `db reset` if Supabase is running.

Deleting several at once? See "Deleting several at once" in core.md, and read each named resource's file before editing.
