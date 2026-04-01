# Documentation Realignment Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Riallineare tutta la documentazione operativa/canonica del repo eliminando drift, duplicazioni e contraddizioni.

**Architecture:** Audit trasversale completato. I file da toccare sono 5 documenti + 1 rule file. Le modifiche sono tutte testuali (nessun codice prodotto).

**Tech Stack:** Markdown files only.

---

## Audit Findings Summary

### Contraddizioni trovate

1. **AGENTS.md config keys** lista `disableTelemetry` come ConfigurationContext key — e' una prop del CRM component (upstream), non una config key persistita. `businessProfile.*` manca dalla lista ma e' attiva in ConfigurationContext.
2. **AGENTS.md directory structure** manca 8 directory che esistono: `cloudinary/`, `filters/`, `invoicing/`, `misc/`, `sales/`, `simple-list/`, `suppliers/` (gia' presente), `workflows/`.
3. **AGENTS.md "AI Visual Blocks > Implementazione attuale"** dice "storico pianificato" — ma il redesign storico e' completato (2026-03-08).
4. **docs/README.md reading order** non include `historical-analytics-backlog.md`; il continuity-map non include `architecture.md` — entrambi hanno 8 file ma diversi.
5. **docs/README.md "Current Continuity Intent"** descrive rebuild da `Fatture/` come intent corrente — ma dal 2026-03-04 il DB locale e' un ambiente pulito + seed remoto.
6. **docs/README.md "Last updated: 2026-03-04"** — non aggiornato da quasi un mese.
7. **docs/architecture.md "Cose ancora da verificare"** descrive "3 errori lint pre-esistenti (useGetOne condizionale)" — sono in realta' warning di function length/complexity, non hook condizionali.
8. **docs/architecture.md infrastructure table** usa riferimenti "sessione N" senza contesto.
9. **.claude/rules/session-workflow.md** ha una reading order diversa da README.md (4 file vs 8).
10. **docs/README.md** non indicizza `ai-visual-blocks-pattern.md` (canonical) ne' `docs/superpowers/` (plans/specs).

### Duplicazioni identificate (non da eliminare, solo da allineare)

- Deploy rules: AGENTS.md (canonical) + continuity-map + .claude/rules/supabase.md — tutti coerenti, nessuna azione
- Module structure: AGENTS.md (summary) + architecture.md (detail) — ruoli diversi, OK
- Sweep rules: AGENTS.md (13-point summary) + continuity-map (detailed per-module) — ruoli diversi, OK

---

## Task 1: Fix AGENTS.md config keys and directory structure

**Files:**
- Modify: `AGENTS.md:372-449`

- [ ] **Step 1: Fix directory structure** — add missing directories to the tree

- [ ] **Step 2: Fix config keys section** — clarify heading, add `businessProfile.*`, annotate `disableTelemetry` as CRM prop

- [ ] **Step 3: Fix "AI Visual Blocks > Implementazione attuale"** — update storico from "planned" to "implemented"

---

## Task 2: Fix docs/README.md index and reading order

**Files:**
- Modify: `docs/README.md`

- [ ] **Step 1: Add ai-visual-blocks-pattern.md to Canonical section**

- [ ] **Step 2: Add docs/superpowers/ note**

- [ ] **Step 3: Unify reading order** — include ALL 9 relevant files (adding backlog + architecture)

- [ ] **Step 4: Update "Current Continuity Intent"** to reflect clean DB + remote seed reality

- [ ] **Step 5: Update "Last updated" to 2026-04-01**

---

## Task 3: Fix docs/architecture.md stale items

**Files:**
- Modify: `docs/architecture.md:713-720`

- [ ] **Step 1: Fix lint warnings description** — correct from "useGetOne condizionale" to actual warnings (function length/complexity)

- [ ] **Step 2: Replace "sessione N" references in infrastructure table** — add dates where known, mark rest as "storico"

---

## Task 4: Fix development-continuity-map.md reading order

**Files:**
- Modify: `docs/development-continuity-map.md` (reading order section only)

- [ ] **Step 1: Add architecture.md to the reading order** (currently missing)

---

## Task 5: Align .claude/rules/session-workflow.md reading order

**Files:**
- Modify: `.claude/rules/session-workflow.md`

- [ ] **Step 1: Expand reading order from 4 to 9 files** matching the canonical list in README.md

---

## Task 6: Verify alignment

- [ ] **Step 1: Run `npm run continuity:check` to validate**
- [ ] **Step 2: Cross-check all reading orders are now consistent**
