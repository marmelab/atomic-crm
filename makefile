.PHONY: build help

# Run silently, show output on failure
run-silent = $1 >/tmp/atomic-crm-$2.log 2>&1 || (cat /tmp/atomic-crm-$2.log && false)

help:
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

install: package.json ## install dependencies
	npm install

install-playwright-browsers: install ## install the playwright browsers matching the repo's pinned version
	npx playwright install chromium chromium-headless-shell

install-claude-plugins:
	claude plugin marketplace update claude-plugins-official
	claude plugin install typescript-lsp@claude-plugins-official

install-lsp:
	npm install -g typescript-language-server

start-server: ## start the backend API (Turso/libSQL)
	npm run dev:server

db-apply: ## apply db/schema.sql (+ seed) to the configured Turso database
	npm run db:apply

start-app: ## start the frontend dev server only
	npm run dev

start: ## start the full stack locally (backend API + frontend)
	npm run dev:all

start-demo: ## start the app locally in demo mode (in-browser FakeRest data)
	npm run dev:demo

stop: ## stop the local backend API if it is still running
	@kill $$(lsof -t -i:$${API_PORT:-3001}) 2>/dev/null || true

build: ## build the app
	npm run build

build-demo: ## build the app in demo mode
	npm run build:demo

prod-start: build ## build then serve the app (backend API + static frontend)
	npm run serve

test-unit: test-app

test: test-unit

test-app:
	npm run test:unit:app

test-e2e: ## run the Playwright end-to-end suite (start the stack first with `make start`)
	npx playwright test

lint:
	npm run lint
	npm run prettier

publish:
	npm publish

typecheck:
	npm run typecheck

doc-install:
	@(cd doc && npm install)

doc: doc-dev

doc-dev:
	@(cd doc && npm run dev)

doc-build:
	@(cd doc && npm run build)

doc-preview: doc-build
	@(cd doc && npm run preview)

doc-deploy:
	@(cd doc && npx gh-pages -b gh-pages -d dist -e doc -m "Deploy docs" --remove doc)

registry-build: ## build the shadcn registry
	npm run registry:build

registry-deploy: registry-build ## Deploy the shadcn registry (Automatically done by CI/CD pipeline)
	@(cd public/r && npx gh-pages -b gh-pages -d ./ -s atomic-crm.json -e r -m "Deploy registry" --remove r)

registry-gen: ## Generate the shadcn registry (ran automatically by a pre-commit hook)
	npm run registry:gen
	npx prettier --config ./.prettierrc.json --write "registry.json"

update-changelog: ## Update the changelog with the unreleased changes (ran automatically by a pre-commit hook)
	npm run update-changelog
	npx prettier --config ./.prettierrc.json --write "CHANGELOG.md"

storybook: ## start storybook
	npm run storybook

watch: ## live monitor of the most recent agent session (agents, hooks, diagnosis)
	node scripts/harness-monitor.mjs --watch

monitor: ## one-shot summary of the most recent agent session (pass SESSION=<id> to pick one)
	@node scripts/harness-monitor.mjs $(if $(SESSION),--session $(SESSION),)

sessions: ## list known agent sessions, newest first
	@node scripts/harness-monitor.mjs --list
