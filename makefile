.PHONY: build help

help:
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

install: package.json ## install dependencies
	npm install;

start-supabase: ## start supabase locally
	npx supabase start

start-supabase-functions: ## start the supabase Functions watcher
	npx supabase functions serve --env-file supabase/functions/.env.development

supabase-migrate-database: ## apply the migrations to the database
	npx supabase migration up

supabase-reset-database: ## reset (and clear!) the database
	npx supabase db reset

start-app: ## start the app locally
	npm run dev

start: start-supabase start-app ## start the stack locally

start-demo: ## start the app locally in demo mode
	npm run dev:demo

stop-supabase: ## stop local supabase
	npx supabase stop

stop: stop-supabase ## stop the stack locally

build: ## build the app
	npm run build

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

test:
	npm test

test-ci:
	CI=1 npm test

lint:
	npm run lint
	npm run prettier

publish:
	npm publish

typecheck:
	npm run typecheck

doc-install:
	@(cd doc && npm install)

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
