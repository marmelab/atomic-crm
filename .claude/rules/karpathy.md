# Karpathy guidelines (all code work in this repo)

Complements `coding-style.md` and the ponytail skills. Bias to caution over speed; for trivial edits use judgment.

1. **Think before coding.** State assumptions in the plan. If two readings of a request exist, list them with one recommendation instead of picking silently. If confused, stop and ask.
2. **Simplicity first.** Minimum code that meets the feature's `acceptance` lines. No speculative options, no abstraction until there are 3 real uses, no error handling for cases that cannot happen. Would a senior engineer call it overcomplicated? Then cut it.
3. **Surgical changes.** Touch only files the feature needs. Match existing style even if you prefer another. Mention unrelated dead code or bugs; do not fix them in the same change. Remove only the orphans your change created.
4. **Goal-driven execution.** Turn each task into checks before writing code: tests that map to `acceptance` lines, plus the feature's `verify` command. Loop until they pass; report evidence (command + output), never "it should work".
