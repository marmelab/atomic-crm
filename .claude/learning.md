# Claude Auto-Correction System

> **Questo file NON è documentazione**. È il mio sistema di apprendimento automatico.
> Ogni entry è un trigger che mi costringe a comportarmi diversamente.

---

## 🚨 RITUALE — Da eseguire all'inizio di OGNI sessione

1. ✅ Ho letto questo file? Se no, leggerlo ORA
2. ✅ Ho applicato i trigger alla situazione attuale?
3. ✅ Ricordo: se imparo qualcosa di nuovo, aggiorno questo file PRIMA di chiudere

**Se salti questo rituale, ripeterai errori già commessi.**

---

## ⚡ Auto-Triggers — Quando vedo queste situazioni, AGISCO diversamente

### Trigger 0: Modello fiscale = CASSA, non competenza

**Situazione**: Vedo calcolo base imponibile forfettaria
**Azione automatica**: Verificare che usi `payments` (status=ricevuto, payment_date) e NON `services` (service_date)
**Perché**: Regime forfettario = principio di cassa. Art. 1 commi 54-89, L. 190/2014. I servizi restano per metriche operative (margini, DSO, concentrazione).
**Fonte**: Sessione 2026-03-04, fix in `fiscalModel.ts`

### Trigger 1: `useEffect` + `formState`
**Situazione**: Vedo `formState` nelle dipendenze di un `useEffect`  
**Azione automatica**: Rimuoverlo immediatamente, usare `getFieldState("field")` senza secondo parametro  
**Perché**: Ciclo infinito garantito — `formState` cambia ad ogni render  
**Fonte**: Sessione 2026-03-04, fix in `ServiceInputs.tsx` e `QuoteInputs.tsx`

---

### Trigger 2: Import da `@/components/admin`
**Situazione**: Vedo un import dal barrel file  
**Azione automatica**: Split in import specifici dal file sorgente  
**Perché**: Convenzione progetto — previene bundle bloat e circular deps  
**Esempio**: `import { X } from "@/components/admin"` → `import { X } from "@/components/admin/x"`

---

### Trigger 3: Nuova pagina lista senza `MobilePageTitle`
**Situazione**: Creo/modifico un componente `*List.tsx`  
**Azione automatica**: Aggiungere `<MobilePageTitle title="..." />` come primo figlio  
**Perché**: Su mobile non c'è breadcrumb, utente non sa dove è  
**Check**: Cerco `title={false}` nella lista → devo aggiungere MobilePageTitle

---

### Trigger 4: CHECK constraint vs TypeScript type
**Situazione**: Modifico un enum/tipo che ha corrispondente DB column  
**Azione automatica**: Verificare migration SQL esista per aggiornare CHECK constraint  
**Perché**: Altrimenti l'inserimento fallisce silenziosamente o con errore cryptico  
**Esempio**: `expense_type` ha 5 valori nel tipo ma 4 nel DB CHECK

---

### Trigger 5: Nuova configurazione
**Situazione**: Aggiungo un campo a `ConfigurationContextValue`
**Azione automatica**:
1. Aggiungere a `defaultConfiguration.ts`
2. Aggiungere sezione in `SettingsPage.tsx`
3. Aggiornare `docs/architecture.md` sezione Settings
**Perché**: Se manca uno di questi, la config non funziona o non è editabile

---

### Trigger 6: Forfettario ≠ regime ordinario
**Situazione**: Propongo feature fiscali (deducibilità, IVA, costi deducibili)
**Azione automatica**: FERMARMI e verificare se ha senso nel regime forfettario
**Perché**: Nel forfettario le spese NON si deducono individualmente — il coefficiente di redditività le assorbe forfettariamente. No IVA, no deduzioni singole.
**Fonte**: Sessione 2026-03-04, errore nel suggerire "deducibilità spese con %"

---

### Trigger 6: Edge Function modificata
**Situazione**: Tocco codice in `supabase/functions/`
**Azione automatica**: Ricordare che `git push` NON basta, serve `npx supabase functions deploy`
**Perché**: Altrimenti resta la vecchia versione in produzione
**Check**: Comunicare esplicitamente all'utente il dual-deploy necessario

---

### Trigger 8: Nuova Edge Function creata

**Situazione**: Creo una NUOVA Edge Function in `supabase/functions/`
**Azione automatica**: AGGIUNGERE IMMEDIATAMENTE la entry in `supabase/config.toml`:

```toml
[functions.nome_funzione]
verify_jwt = false
```
**Perché**: Tutte le Edge Functions di questo progetto gestiscono l'auth internamente con JWKS (`_shared/authentication.ts`). Se manca la entry in `config.toml`, il gateway Supabase (Kong) applica il default `verify_jwt = true` e BLOCCA il JWT prima che la funzione possa gestirlo → errore "Invalid JWT" sistematico su OGNI chiamata.
**Bug reale**: `invoice_import_confirm` ha dato 401 "Invalid JWT" su OGNI chiamata per settimane perché mancava dal `config.toml`. La funzione extract (stessa auth) funzionava perché era nel config.
**Check obbligatorio**: Dopo aver creato la funzione, verificare che `grep "functions.nome_funzione" supabase/config.toml` trovi la entry. Se no, aggiungerla.
**Fonte**: Sessione 2026-03-05, bug in produzione

---

### Trigger 7: Migration SQL nuova
**Situazione**: Creo `supabase/migrations/YYYYMMDDHHMMSS_*.sql`  
**Azione automatica**: Verificare che includa:  
- [ ] `IF EXISTS` / `IF NOT EXISTS` per replayability  
- [ ] RLS policies se tabella nuova  
- [ ] Indici su FK  
- [ ] Trigger `updated_at` se serve  
**Perché**: Migration deve essere replayable da zero senza errori

---

## 🔄 Pattern di Auto-Verifica

Prima di dire "fatto", controllo automaticamente:

### Per ogni fix:
```
npm run typecheck  → 0 errori?
npm run lint       → 0 errori?
npm run build      → build success?
```
Se uno fallisce → NON ho finito, continuo.

### Per ogni modifica DB:
```
La migration è nell'ultimo file .sql?
Ho aggiornato types.ts se ho cambiato schema?
Ho verificato che i tipi TypeScript matchino il DB?
```

### Per ogni modifica UI lista:
```
Ho aggiunto MobilePageTitle per mobile?
I filtri funzionano su mobile (Sheet pattern)?
Ho verificato su entrambi i breakpoint?
```

---

## 🧠 Lezioni di Contesto (NON in AGENTS.md)

### Lesson: Import ciclici con `@/components/admin`
**Quando l'ho scoperto**: Sessione 2026-03-04  
**Cosa è successo**: Ho cambiato import in `EditSheet.tsx` e build è fallita perché `save-button` non esiste come file separato  
**Correzione**: Alcuni componenti (come `SaveButton`) sono in `form.tsx`, non hanno file dedicato  
**Regola**: Se import specifico fallisce → tornare al barrel SOLO per quel componente, non per tutti

### Lesson: `is_taxable` era già presente in `Quote`
**Quando l'ho scoperto**: Sessione 2026-03-04  
**Cosa è successo**: Ho segnalato "manca is_taxable in Quote" ma era già a riga 317  
**Correzione**: Leggere il file COMPLETAMENTE prima di segnalare mancanze  
**Regola**: `grep` non basta, serve leggere il contesto

### Lesson: `ContactList.tsx` ha 3 return paths diversi
**Quando l'ho scoperto**: Sessione 2026-03-04  
**Cosa è successo**: Ho applicato lo stesso pattern degli altri List ma `ContactList` ha logica mobile/desktop/empty diversa  
**Correzione**: Non tutte le liste sono uguali — alcune hanno branching complesso  
**Regola**: Leggere la struttura del componente prima di applicare pattern

---

## 📝 Template per Nuove Lezioni

Quando imparo qualcosa che mi ha sorpreso:

```markdown
### Lesson: [Breve descrizione]
**Quando l'ho scoperto**: YYYY-MM-DD  
**Cosa è successo**: [Il problema/sorpresa]  
**Correzione**: [Come ho risolto]  
**Regola**: [Pattern di auto-correzione per il futuro]
**Trigger**: [Cosa guardare per attivare questa lezione]
```

---

## 🔁 Obblighi di Sessione

**ALL'INIZIO**: Leggo questo file → applico i trigger automaticamente  
**DURANTE**: Quando attivo un trigger, agisco immediatamente senza aspettare l'errore  
**ALLA FINE**: Se ho imparato una nuova lezione, aggiungo subito una entry qui  

---

*File di auto-apprendimento — NON duplicare AGENTS.md*
