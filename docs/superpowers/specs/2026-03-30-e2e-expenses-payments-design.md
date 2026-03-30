# E2E Expenses + Payments Alignment — Design Spec

> Data: 2026-03-30
> Root cause investigation completata con systematic-debugging

## Problema

18 test E2E in 2 suite falliscono per selettori obsoleti, valori numerici
errati, redirect sbagliati e pattern delete cambiato.

## Root Cause

### Expenses (9 test)

| Test | Selettore rotto | Root cause | Fix |
|------|----------------|------------|-----|
| :15 | `toHaveCount(2)` | Seed crea 3 manuali + 2 auto-km (trigger DB-3) = 5 | Count → 5 |
| :15 | `columnheader "Totale"` | Header attuale: "Totale EUR" | `"Totale EUR"` |
| :44 | `toHaveURL(/\/expenses$/)` | Redirect è `"show"` | URL → `/expenses/.+/show$` |
| :78 | `toHaveURL(/\/expenses$/)` | Idem | Idem |
| :142 | `getByLabel("Km percorsi")` | Prima spesa nell'ordine potrebbe non essere km | Navigare a spesa km specifica |
| :159 | filter click | Potrebbe matchare multipli "Spostamento Km" | `.first()` |
| :171 | `toHaveCount(2)` | 5 spese nel progetto (3 manuali + 2 auto-km) | Count → dipende dal filtro |
| :185 | `getByText("644,00")` | Valore reale 653,50 € (include km auto) | Aggiornare valore |
| :195 | redirect dopo save | Come :44 | Idem |
| :215 | `getByText(/Conferma/)` | DeleteButton usa undo toast | Rewrite per undo |

### Payments (9 test)

| Test | Selettore rotto | Root cause | Fix |
|------|----------------|------------|-----|
| :15 | `getByText("Data")` | Ambiguo: sort button + column header | Scope a table o usa columnheader |
| :15 | `getByText("Cliente")` | Ambiguo: navbar "Clienti" | Scope a table |
| :15 | `getByText("Importo")` | Header attuale: "Importo" in ResizableHead | Verificare |
| :34 | `toHaveURL(/\/payments$/)` | Redirect è `"show"` | URL → `/payments/.+/show$` |
| :72-88 | `getByText("Ricevuto")` etc. | Potrebbe matchare filtro sidebar | Scope a table |
| :139 | `"Scadenzario operativo"` | Rinominato "Cosa devi fare" | Aggiornare |
| :139 | `"Segna come incassato"` | Button text potrebbe essere diverso | Verificare da UI |
| :160 | `getByText("Ricevuto").first().click()` | Click sul filtro sidebar, non sulla riga | Usare FilterBadge |
| :199 | `"Pagamenti scaduti"` | Testo attuale: "Scaduti" | Aggiornare |
| :233 | `getByText(/Conferma/)` | DeleteButton usa undo | Rewrite per undo |

## Principi

- Ogni selettore aggiornato corrisponde a testo/struttura verificato nel codice sorgente
- I valori numerici attesi devono corrispondere ai seed data + trigger auto-km
- I test non devono essere disabilitati
- Zero modifiche al codice produzione

## Sorgenti verificate

| File | Dato |
|------|------|
| ExpenseCreate.tsx:40 | redirect="show" |
| PaymentCreate.tsx:51 | redirect="show" |
| ExpenseListContent.tsx:128 | Header "Totale EUR" |
| PaymentListContent.tsx:112-168 | Headers in ResizableHead |
| DashboardDeadlineTracker.tsx:247 | "Scaduti" (non "Pagamenti scaduti") |
| ExpenseShow.tsx:122 | DeleteButton (undo) |
| PaymentShow.tsx:83 | DeleteButton (undo) |
| ExpenseListFilter.tsx:311 | aria-label="Filtra per progetto" |
