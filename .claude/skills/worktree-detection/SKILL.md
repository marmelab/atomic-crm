---
name: worktree-detection
description: How to find a Git worktree by task number without hardcoding paths. Use in hooks or scripts that need to locate a specific task's worktree.
---

## Pattern

```bash
TASK_NUM="TASK-005"

WORKTREE=$(git worktree list --porcelain \
  | grep "^worktree " \
  | awk '{print $2}' \
  | grep -i "${TASK_NUM}" \
  | head -1)

if [ -z "$WORKTREE" ] || [ ! -d "$WORKTREE" ]; then
  echo "No worktree found for ${TASK_NUM} — skipping"
  exit 0
fi
```

## Why this works

`git worktree list` reads from Git's internal registry — it knows every worktree regardless of where it was created. No assumptions about directory structure or machine-specific paths.

## Extracting TASK_NUM from agent variables

```bash
TASK_NUM=$(echo "$TASK_OWNER $TASK_SUBJECT" | grep -oP 'TASK-\d+' | head -1)
```

Works whether the task number appears in the owner field or the subject line.