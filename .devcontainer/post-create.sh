#!/usr/bin/env bash

claude plugin marketplace add anthropics/claude-plugins-official
claude plugin marketplace update claude-plugins-official
claude plugin install typescript-lsp

sudo npm install -g supabase typescript-language-server
