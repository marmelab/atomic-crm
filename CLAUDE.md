@AGENTS.md

# CLAUDE.md — Gestionale Rosario Furnari

## Relationship With `AGENTS.md`

Questo file e' intenzionalmente complementare, non parallelo.

- fonte canonica condivisa:
  - `AGENTS.md`
- scopo di questo file:
  - aggiungere solo note specifiche di Claude Code
- se una regola vale per tutti gli agenti:
  - va scritta in `AGENTS.md`
- se c'e' conflitto:
  - vince `AGENTS.md`

## Session Memory — LEGGERE SEMPRE PRIMA DI TUTTO

Claude Code ha una directory di memoria persistente tra sessioni.
All'inizio di ogni sessione, PRIMA di qualsiasi altra azione:

1. Leggere `memory/MEMORY.md` (caricato automaticamente nel contesto)
2. Se il task tocca un'area specifica, leggere i file tematici collegati:
   - `memory/refactoring-patterns.md` — pattern di split e refactoring
   - `memory/local-truth-patterns.md` — rebuild locale e riconciliazione
   - `memory/calendar-spot-research.md` — ricerca calendario spot/early
3. NON ripetere lavoro gia' fatto: la memoria contiene decisioni, pattern e
   stato dei task in corso
4. Se impari qualcosa di nuovo e stabile, aggiornare i file di memoria

## Autonomia decisionale

Vedi sezione `AGENT AUTONOMY` in `AGENTS.md` — vale anche per Claude Code.

## Claude-Specific Notes

- le regole in `.claude/rules/` e le skill in `.claude/skills/` sono parte del
  flusso Claude Code
- usare `CLAUDE.md` solo per delta minimi che non hanno senso in `AGENTS.md`
