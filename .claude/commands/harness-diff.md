---
description: Show what a harness session changed (the net diff of its work)
---

Show the net set of changes a harness session produced, then stop. This is **read-only** — never modify files or git state.

1. **Pick the session short id.**
   - If the user passed a short id as an argument (`$ARGUMENTS`), use it directly.
   - Else, look for a `<session_dir>…</session_dir>` value in your context (injected at session start). If present, `SESSION_SHORT_ID` = the first dash-separated segment of its basename (e.g. `/tmp/…/46bc14c5-13fb-498b-…` → `46bc14c5`). Confirm it with `git show-ref --verify --quiet refs/heads/session/<short>`; if the ref exists, use it.
   - Otherwise enumerate sessions: `git for-each-ref --format='%(refname:short)' 'refs/heads/session/*'`.
     - none → tell the user there is no harness session to inspect, and stop.
     - exactly one → use it.
     - several → list them and ask which with `AskUserQuestion`. For each, show its short id, its base branch (`git config --local --get sessionbase.<short>.branch`), and its fork date (`git --no-pager log -1 --format=%cr session-base/<short>`). A non-destructive default to the most recent is acceptable, but still show which one you picked.

2. **Show the diff** (the session's net contribution, isolated from any other work on the branch):
   - summary first: `git --no-pager diff --stat session-base/<short>..session/<short>`
   - then full: `git --no-pager diff session-base/<short>..session/<short>`

3. Summarize in plain terms what the session changed. Do **not** edit anything or run any history-mutating git command.
