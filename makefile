.PHONY: build help

help:
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

install: package.json ## install dependencies
	npm install;

start-supabase: ## start supabase locally
	npx supabase start

start-supabase-functions: ## start the supabase Functions watcher
	npx supabase functions serve

supabase-migrate-database: ## apply the migrations to the database
	npx supabase migration up

supabase-reset-database: ## reset (and clear!) the database
	npx supabase db reset

start-app: ## start the app locally
	npm run dev

start-app-e2e: ## start the app pointing to the e2e supabase instance
	npx vite --port 5175 --force --mode e2e &

stop-app-e2e:
	kill $$(lsof -t -i:5175)

start-app-e2e-ci: build-e2e ## start the app pointing to the e2e supabase instance in CI mode (no open, no watch)
	npx serve -l 5175 -L -s dist &

start: start-supabase start-app ## start the stack locally

start-demo: ## start the app locally in demo mode
	npm run dev:demo

stop-supabase: ## stop local supabase
	npx supabase stop

stop: stop-supabase ## stop the stack locally

start-supabase-e2e: ## start a separate supabase instance for e2e (fresh DB every run)
	npx supabase stop --workdir .supabase-e2e --no-backup 2>/dev/null || true
	rm -rf .supabase-e2e/supabase
	mkdir -p .supabase-e2e/supabase
	cp supabase/config.e2e.toml .supabase-e2e/supabase/config.toml
	cp -r supabase/migrations .supabase-e2e/supabase/migrations
	cp -r supabase/schemas .supabase-e2e/supabase/schemas
	cp -r supabase/functions .supabase-e2e/supabase/functions
	cp -r supabase/templates .supabase-e2e/supabase/templates
	cp supabase/seed.sql .supabase-e2e/supabase/seed.sql
	cp supabase/signing_keys.json .supabase-e2e/supabase/signing_keys.json
	npx supabase start --workdir .supabase-e2e

stop-supabase-e2e: ## stop the e2e supabase instance
	npx supabase stop --workdir .supabase-e2e --no-backup

start-e2e: start-supabase-e2e start-app-e2e ## start the stack in e2e mode (fresh supabase instance + app pointing to it)

start-e2e-ci: start-supabase-e2e start-app-e2e-ci ## start the stack in e2e mode in CI (fresh supabase instance + built app pointing to it)

stop-e2e: stop-supabase-e2e stop-app-e2e ## stop the stack in e2e mode

build: ## build the app
	npm run build

build-e2e: ## build the app in e2e mode (with the e2e supabase config)
	npm run build:e2e

build-demo: ## build the app in demo mode
	npm run build:demo

prod-start: build supabase-deploy
	open http://127.0.0.1:3000 && npx serve -l tcp://127.0.0.1:3000 dist

prod-deploy: build supabase-deploy
	npm run ghpages:deploy

supabase-remote-init:
	npm run supabase:remote:init
	$(MAKE) supabase-deploy

supabase-deploy:
	npx supabase db push
	npx supabase functions deploy

test-app:
	npm run test:unit:app

test-functions:
	npm run test:unit:functions

test-e2e: start-e2e
	npx playwright test --ui

test-e2e-ci: start-e2e-ci
	npx wait-on http-get://localhost:54341/auth/v1/health http-get://localhost:5175
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

storybook: ## start storybook
	npm run storybook