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

## 🔥 Rituale di Inizio Sessione — ESEGUIRE SEMPRE

**Questo blocco è un comando. Devo eseguirlo ALL'INIZIO di ogni sessione.**

```
LEGGI: .claude/learning.md
↓
APPLICA: Tutti i trigger attivi nella sezione "⚡ Auto-Triggers"
↓
RICORDA: Se scopro una nuova lezione, aggiorno learning.md PRIMA di chiudere
```

---

## Session Memory — Leggere dopo il rituale

Claude Code ha una directory di memoria persistente tra sessioni.
Dopo il rituale di inizio sessione:

1. Leggere `memory/MEMORY.md` (caricato automaticamente nel contesto)
2. Se il task tocca un'area specifica, leggere i file tematici collegati:
   - `memory/refactoring-patterns.md` — pattern di split e refactoring
   - `memory/local-truth-patterns.md` — rebuild locale e riconciliazione
   - `memory/calendar-spot-research.md` — ricerca calendario spot/early
3. NON ripetere lavoro gia' fatto: la memoria contiene decisioni, pattern e
   stato dei task in corso

### Regola OBBLIGATORIA — Aggiornamento Learning Log

**PRIMA di chiudere una sessione in cui ho imparato qualcosa di nuovo**:

1. Aggiungere una entry a `.claude/learning.md` con:
   - Data della sessione
   - Categoria (Bug Pattern, Architettura, Workflow, etc.)
   - Descrizione del problema/pattern
   - Soluzione corretta (con code snippet)
   - File coinvolti
   - Come prevenirlo in futuro

2. La entry deve essere aggiunta in cima al file, sotto la sessione più recente.

**Questo mi costringe a diventare più intelligente ad ogni sessione.**

## Autonomia decisionale

Vedi sezione `AGENT AUTONOMY` in `AGENTS.md` — vale anche per Claude Code.

## Claude-Specific Notes

- le regole in `.claude/rules/` e le skill in `.claude/skills/` sono parte del
  flusso Claude Code
- usare `CLAUDE.md` solo per delta minimi che non hanno senso in `AGENTS.md`
