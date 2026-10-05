# Dependency safety

Adding a package is a supply-chain decision.

## Rule

- Add a dependency only through `npm install <pkg>`, and prefer a well-established package
  over a niche one.
- The project's `.npmrc` sets `min-release-age`, so npm refuses any version published too
  recently, transitive ones included. Never override it on the command line.
- That needs npm 11.10+ (Node 24, see `.nvmrc`): older npm ignores the setting.

## Third-party skills and MCP servers

- Treat a downloaded skill/plugin (marketplace or external repo) like an npm dependency:
  the same audits apply (they have shipped hardcoded secrets and malicious payloads).
- Pin an MCP server's version once validated; do not let it auto-update without a fresh
  human check.

Automatic blocking reduces risk, it does not remove it: a periodic security review is
still required for anything touching auth, payments, or sensitive data.
