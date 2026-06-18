# Playwright integration

Installs Playwright system dependencies (via the `playwright-deps` feature) and
persists downloaded browsers in a named volume across container rebuilds.

## Cache folder

The browser cache lives at `PLAYWRIGHT_BROWSERS_PATH` (default
`/mount/.ms-playwright`). This single env var is the source of truth: the
volume mount target (`${containerEnv:PLAYWRIGHT_BROWSERS_PATH}`) and the
`install.sh` setup both read it.

The dev container features spec does not allow a feature `option` to drive
`containerEnv`/`mounts`, so to change the folder, override the env var in your
`devcontainer.json` — the volume mount follows automatically:

```jsonc
{
  "features": { "./playwright": {} },
  "containerEnv": { "PLAYWRIGHT_BROWSERS_PATH": "/custom/path" }
}
```
