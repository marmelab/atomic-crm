# Dependency safety

Adding a package is a supply-chain decision, so no agent adds one unvetted.

## Rule

- `dependency-gate` (PreToolUse Bash) vets every package an `npm install <pkg>` or
  `npx <pkg>` would fetch: on the npm registry, first published 21+ days ago, 1000+ weekly
  downloads, not deprecated, no install script, no high or critical advisory (defaults).
- A vetted command runs with `--ignore-scripts --min-release-age=<days>` added, so npm
  itself refuses any version younger than the release-age floor, transitive ones included.
- A refusal is not a dead end: build the feature without the package, or use an established
  alternative, before asking the user.
- The thresholds are `dependencies.*` in `harness.config.json`. `dependencies.allow` lists
  the names (or `@scope/*`) a developer approved; they skip the vetting.
- Not vetted: a package already declared in `package.json` or approved, an npx command that
  resolves to a local bin, and a bare `npm install` / `npm ci` restoring the lockfile.
- Refused outright, because they would bypass the vetting: pnpm / yarn / bun installs and
  runners, non-registry specs (git, tarball, path, alias), and `--registry`, `--before`,
  `--min-release-age`, `--no-ignore-scripts`. A developer adds those.
- An unreachable registry means refused, not unvetted.
- A dependency written straight into `package.json`, then installed by a bare
  `npm install`, is not vetted: it only shows up in the diff.
- The project must not keep `Bash(npm install *)` in `permissions.deny`: a deny wins over
  the hook and the gate never runs.

## Third-party skills and MCP servers

- Treat a downloaded skill/plugin (marketplace or external repo) like an npm dependency:
  the same audits apply (they have shipped hardcoded secrets and malicious payloads).
- Pin an MCP server's version once validated; do not let it auto-update without a fresh
  human check.

Automatic blocking reduces risk, it does not remove it: a periodic security review is
still required for anything touching auth, payments, or sensitive data.
