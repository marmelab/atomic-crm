# English-only in committed files

All content written into the repository is in **English**, regardless of
the conversational language in the chat. This applies to:

- Source code: variable / function / class names, identifiers
- Comments and docstrings
- Markdown docs, agent prompts, skills, rules, hooks
- Commit messages, PR titles, PR bodies
- Hook output strings, log strings, error messages
- Templates and example placeholders inside agent prompts
- Configuration keys (JSON / YAML keys), default config values

The only place where another language may appear in a committed file is a
**runtime data value** that legitimately reflects the user's domain (e.g.
the user's chosen `industry: "boulangerie"` or `entity name: "facture"`
inside `project-context.json` or fake-data fixtures). Even then, prefer
English when it doesn't change the semantics.

## Speaking another language at runtime

Agents that converse with the user (orchestrator, project-manager,
etc.) MUST reply in the user's language at runtime.
Achieve this with English instructions plus a directive like *"reply in
the user's language"* — never by hard-coding non-English templates inside
the agent prompt.

English template inside the prompt:
> *"Project scoping started…"*

Then the agent translates at runtime to French / Spanish / Japanese / etc.
based on the user's most recent message.

## Quick checklist before `Write` / `Edit` / `git commit`

1. Scan the new content for accents (é, à, ç, ñ, ü, …) and non-English
   words (je, tu, le, la, voici, equipo, scrivere, …).
2. If any found, rewrite in English (keep runtime-translation directives
   if user-facing strings are involved).
3. Commit messages: English imperative, e.g. `Add SETUP path to orchestrator`.
