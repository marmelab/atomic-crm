# ask-state cartouche

The chat-service shows a yes/no cartouche when the orchestrator writes this file.
**Only the orchestrator writes it** never (simple-)developer (worktree scope).

`<session_dir>` is `TICKETS_DIR` (e.g. `/chat-service/logs/<uuid>`). Write **valid JSON** (quoted, escaped values), in the same turn as the question, all values in the user's language except `kind`:

```
Write("<session_dir>/ask-state.json",
  '{"kind":"satisfaction","header":"Preview ready","body":"Everything is visible in the demo but hasn'\''t been saved to your data yet. Happy with the result?","yes":"Yes, save the changes","no":"No, I want to adjust something"}')
```

`header` ≤ 30 chars; `body` one plain sentence (no "database"/"migration"/"Supabase").

`kind` picks the question (not interchangeable):

| `kind` | When | Asks |
|---|---|---|
| `satisfaction` | DB-impacting change, before migration (S-DONE non-empty, PD-ASK) | save the preview to your data? |
| `live-switch` | demo mode, after migration (PD-LIVE-ASK) | switch the app to your real data? |
