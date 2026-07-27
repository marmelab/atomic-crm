---
name: grill-me
description: Interrogate a vague or broad feature request BEFORE dispatching the harness orchestrator, to surface what the user has not anticipated. Use in the main thread when a #harness request is underspecified, when scope seems broad, or when a plan would come out too generic. Not for the orchestrator (headless, cannot ask).
---

# grill-me

Ask probing questions about the request before any plan or code, to surface
what the user has NOT anticipated, not just confirm what they already said.

## How

- **One question at a time**, in prose. Never a multiple-choice menu, never a
  batch of five at once.
- Read the answer, then ask the next most valuable question given it.
- **Stop as soon as the scope is answerable** (roughly: you could write the
  orchestrator dispatch prompt without guessing). Do not interrogate for its
  own sake.

## Cover, at minimum

1. **Scope-out**: what is explicitly NOT in scope? What might look included but isn't?
2. **Edge cases**: empty / invalid input, network or backend error, two users at once.
3. **Existing interactions**: does this touch behavior already in place (permissions,
   RLS, cached data, shared views, another resource)?
4. **Definition of done**: what manual check confirms it works? Who validates before merge?
5. **Reversibility**: if it turns out wrong, how hard is it to undo?

If the user answers "I don't know" to a structural question, propose an explicit
hypothesis and ask them to confirm rather than silently choosing.

## After grilling

Fold the answers into the orchestrator dispatch prompt (scope-out and
acceptance become ticket constraints). Then dispatch the harness as usual.

The orchestrator never invokes this skill: it runs headless and cannot hold an
interactive back-and-forth. Grilling is a main-thread, pre-dispatch step.
