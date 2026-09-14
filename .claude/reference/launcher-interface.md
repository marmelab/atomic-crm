# Launcher interface

A "managed launcher" is an external surface that drives the harness (CRM
Builder's chat-service is the reference launcher). The harness core stays neutral:
every launcher-specific fact is an extension point under `config.launcher` in
`harness.config.json`, and each consuming hook is INERT when its point is unset.
CRM Builder / chat-service specifics live in Atomic CRM's project layer (its
`harness.config.json`), never in a core hook.

## Extension points (`config.launcher`)

| Key | Meaning | Consumer | Unset behavior |
|---|---|---|---|
| `sessionDirEnv` | Env var carrying the managed session dir (default `CHAT_SESSION_DIR`) | `context.mjs`, `reviews.mjs`, `session-bootstrap.mjs` read this env directly | falls back to the recomputed `/tmp/<repo>/<id>` session dir |
| `turnSentinelDir` | Dir where `turn-complete.mjs` drops `pty-turn-done-<sid>` so the launcher knows the turn ended | `turn-complete.mjs` | hook writes nothing (inert) |
| `postCheckoutScript` | Script the merger runs after checkout to materialize the app variant | `merger.md` (runs it), `block-orchestrator-merge.mjs` (gates it merger-only) | not run; the guard clause is inert |
| `logsDir` | Managed-launcher log dir agents may redirect into | `bash-guard.mjs` (redirect exemption) | only `/dev/null` is exempt |

`CHAT_SESSION_DIR` is kept as the generic "managed session dir" variable name:
it is set by the launcher, not by the core. Persona injection stays the
launcher's job too, via `--append-system-prompt` (the web-chat orchestrator is
this same `orchestrator` with a non-technical persona layered on at launch); the
core never hardcodes a persona.

## Adding a launcher

Set the four keys under `config.launcher` in your project's `harness.config.json`.
Leave a key unset (or the whole `launcher` block absent) and the matching hook
stays inert, so a project with no managed launcher runs the harness with zero
launcher coupling.
