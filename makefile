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

stop-supabase: ## stop local supabase
	npx supabase stop

stop: stop-supabase ## stop the stack locally

build: ## build the app
	npm run build

build-lib: ## build the library
	npm run build-lib

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
	npm run lint:check
	npm run prettier:check

storybook: ## start storybook
	npm run storybook

publish:
	npm run build-lib
	npm publish