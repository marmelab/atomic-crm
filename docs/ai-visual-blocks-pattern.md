# AI Visual Blocks Pattern — "Vista smart"

**Stato del documento:** `canonical`
**Scopo:** documentare il pattern architetturale per le risposte AI a blocchi
visivi, replicabile su qualsiasi superficie del CRM (dashboard annuale,
storico, pagine di dettaglio).

Last updated: 2026-03-08

## Principio

L'AI non risponde con testo libero (markdown), ma con un array JSON di
blocchi tipizzati. Il frontend li renderizza con componenti React dedicati,
garantendo coerenza visiva con il design system.

L'utente attiva la modalita' con un toggle opt-in ("Vista smart"). Quando il
toggle e' spento, il flusso markdown esistente resta immutato.

## Architettura

```
┌─────────────┐     ┌──────────────────┐     ┌────────────────────┐
│  UI toggle  │────▶│  Provider method  │────▶│  Edge Function     │
│  (localStorage)   │  (visualMode)     │     │  (prompt switch)   │
└─────────────┘     └──────────────────┘     └────────┬───────────┘
                                                       │
                              ┌─────────────────────────┘
                              ▼
                    ┌──────────────────┐
                    │  AI (gpt-5.2)    │
                    │  JSON blocks out │
                    └────────┬─────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  AiBlockRenderer │
                    │  (React)         │
                    └──────────────────┘
```

### Flusso dati

1. Il componente UI passa `visualMode: true` al provider method
2. Il provider aggiunge `visualMode: true` nel body della Edge Function
3. La Edge Function costruisce le instructions:
   - `baseInstructions` (semantica, cautela, regole) — sempre uguali
   - se `visualMode`: appende `visualModeInstructions` da
     `_shared/visualModePrompt.ts`
   - se non `visualMode`: appende le istruzioni markdown di output
4. L'AI risponde con un array JSON di `AiBlock`
5. La Edge Function parsa il JSON e ritorna `{ blocks: AiBlock[] }`
6. Il frontend usa `<AiBlockRenderer blocks={blocks} />` invece di
   `<Markdown>`
7. Fallback: se il JSON e' malformato, mostra testo grezzo

## Blocchi disponibili (10 tipi)

| Tipo | Scopo | Valori |
|------|-------|--------|
| `text` | Testo libero (1-3 frasi) | `content: string` |
| `callout` | Box evidenziato | `tone: info/warning/success`, `content` |
| `action` | Azione operativa | `content` |
| `metrics` | Riga numeri grandi (1-4) | `items: [{label, value: string, color?}]` |
| `list` | Lista puntata | `title?`, `items: string[]` |
| `bar-chart` | Barre orizzontali | `title?`, `items: [{label, value: number, color?}]` |
| `progress` | Barra di progresso | `label`, `current: number`, `total: number`, `color?` |
| `trend` | Grafico a linea | `label?`, `points: [{label, value: number}]`, `unit?` |
| `comparison` | Due valori affiancati | `left/right: {label, value}`, `delta?`, `deltaDirection?` |
| `breakdown` | Composizione totale | `title?`, `items: [{label, value: number, color?}]` (2-5 voci, altrimenti bar-chart) |

## Palette colori (8 valori)

| Colore | Significato |
|--------|-------------|
| `emerald` | Positivo, soldi che hai, crescita |
| `red` | Negativo, costi, calo |
| `amber` | Attesa, attenzione, da verificare |
| `sky` | Neutro, informativo |
| `blue` | Confronto, riferimento |
| `violet` | Evidenza, punto focale |
| `rose` | Critico ma non grave |
| `gray` | Secondario, contesto |

## Regole chiave del prompt

Documentazione completa in `supabase/functions/_shared/visualModePrompt.ts`.
Principi fondamentali:

1. **Schema esplicito**: ogni blocco ha campi obbligatori e ammessi definiti;
   l'AI non puo' inventare proprieta' nuove
2. **Anti-array-vuoti**: se non ci sono dati, non usare quel blocco
3. **Numeri vs stringhe**: `metrics.value` e' stringa formattata ("4.972 €"),
   i grafici usano numeri puri (4972)
4. **Composizione libera**: l'AI sceglie ordine e quantita' (2-6 blocchi),
   inizia con `text` salvo domande puramente numeriche
5. **Label brevi**: 1-4 parole nelle etichette
6. **Anti-grafici forzati**: niente grafici se non ci sono dati numerici
7. **Breakdown max 5**: oltre 5 voci diventa illegibile, usare `bar-chart`
8. **Validazione**: checklist pre-output (JSON valido, campi corretti, no
   trailing commas, colori dalla palette)
9. **Due esempi**: uno con grafici, uno senza — insegna all'AI quando NON
   usare visualizzazioni

## File coinvolti

### Tipi

- `src/lib/analytics/annualAnalysis.ts` — `AiBlock` union type,
  `AnnualOperationsVisualSummary`, `AnnualOperationsVisualAnswer`

### Renderer

- `src/components/atomic-crm/dashboard/AiBlockRenderer.tsx` — mappa 10 tipi
  a componenti React (CSS bars, Recharts LineChart, proportional breakdown)

### Prompt

- `supabase/functions/_shared/visualModePrompt.ts` — istruzioni complete
  per l'AI (schema, colori, composizione, validazione, esempi)

### Edge Functions

- `supabase/functions/annual_operations_summary/index.ts` — accetta
  `visualMode`, switcha prompt, parsa JSON
- `supabase/functions/annual_operations_answer/index.ts` — idem

### Provider

- `src/components/atomic-crm/providers/supabase/dataProviderAnalytics.ts` —
  `generateAnnualOperationsAnalyticsSummary(year, { visualMode })`,
  `askAnnualOperationsQuestion(year, question, { visualMode })`

### Toggle UI

- `DashboardAnnualAiSummaryCard.tsx` — pill button "Vista smart" con
  Lightbulb icon, persistenza localStorage, default `true` per nuovi utenti

### Esportazione PDF

- Bottone "PDF" con icona Download nel header del risultato AI
- Funzionamento: clona il nodo DOM del risultato in un portal
  `[data-print-portal]`, chiama `window.print()`, rimuove il portal
- Regole `@media print` in `src/index.css`: nasconde tutto tranne il portal,
  forza colori di stampa con `print-color-adjust: exact`
- Zero dipendenze: l'utente sceglie "Salva come PDF" dal dialog di stampa
- Riusabile: qualsiasi componente puo' usare lo stesso pattern
  (`data-print-portal` + CSS gia' presente)

## Come replicare su una nuova superficie

Per aggiungere Vista smart a un'altra card AI (es. storico, dettaglio
cliente):

1. **Provider**: aggiungere `options?: { visualMode?: boolean }` al metodo,
   passare `visualMode` nel body della Edge Function
2. **Edge Function**: importare `visualModeInstructions` da
   `_shared/visualModePrompt.ts`, estrarre `visualMode` dal body,
   switchare instructions, parsare JSON se `isVisual`, alzare
   `max_output_tokens` a 2500
3. **Componente**: aggiungere toggle con stesso pattern (localStorage key
   diversa), type guard `isVisualSummary`/`isVisualAnswer` con `"blocks" in d`,
   rendering condizionale `<AiBlockRenderer>` vs `<Markdown>`
4. **Tipi**: usare `AiBlock[]` per i blocchi, creare tipo response specifico
   se necessario (es. `HistoricalVisualSummary`)
5. **Test**: aggiornare le chiamate mock per includere `{ visualMode: true }`
6. **PDF export**: aggiungere bottone con stesso pattern `printResult`
   (clone DOM → portal → `window.print()` → cleanup). Il CSS `@media print`
   in `index.css` e' gia' pronto.

Il renderer `AiBlockRenderer` e il prompt `visualModePrompt.ts` sono
condivisi — non duplicarli.
