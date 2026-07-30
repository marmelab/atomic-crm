# Dependency safety

Adding a new package is a supply-chain decision, so agents never do it silently.

## Rule

- New-package installs are denied by permissions (`settings.json` -> `permissions.deny`:
  `Bash(npm install *)`, `Bash(npm i *)`, `Bash(pnpm add *)`, `Bash(yarn add *)`). A
  deny is ~100% respected; a CLAUDE.md rule or a post-action warning is not.
- Bare `npm install` / `pnpm install` / `yarn install` (no package argument, restoring
  the lockfile) stays allowed: the literal space in the deny glob requires an argument,
  so an argument-less install is not matched.
- To add a package, the human validates THAT specific package first: minimum 21 days
  since publication, healthy download/maintainer count, no open advisory
  (`npm audit`, Snyk).

## Third-party skills and MCP servers

- Treat a downloaded skill/plugin (marketplace or external repo) like an npm dependency:
  the same audits apply (they have shipped hardcoded secrets and malicious payloads).
- Pin an MCP server's version once validated; do not let it auto-update without a fresh
  human check.

Automatic blocking reduces risk, it does not remove it: a periodic security review is
still required for anything touching auth, payments, or sensitive data.
